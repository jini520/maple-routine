// 고가 아이템 드롭 시 전체화면 연출([[ADR-038]]). 웹의 구성은 이렇다 — ScreenEff 가 전 프레임
// 동일 배율로 화면을 채우고, 8프레임 시점에 중앙 아이템이 팝인하며 DropEff(pre → loop ∞)가 아이템
// 하단에서 올라온다. 화면을 탭하면 end 를 재생하고 닫힌다.
//
// ══ 이 파일은 아직 **정적 구조**다 ══════════════════════════════════════════════════
//
// 3단계 step 5 의 범위는 *"구조·레이어·props 계약까지"* 이고, 실제로 두 축이 통째로 빠져 있다.
//
//   ⓐ **프레임 에셋이 없다.** `DROP_EFFECT_FRAMES` 가 RN 에서 네 단계 모두 빈 배열이다
//      (`src/lib/rn-drop-effect-frames.ts`). 빈 배열은 원본이 정의해 둔 정상 경로라
//      (*"프레임이 없으면 연출 없이 닫기만 가능하게 둔다"*) 웹과 **같은 분기**를 탄다.
//   ⓑ **재생 엔진과 모션이 없다.** 웹은 `requestAnimationFrame` 루프가 단계별 고정 fps
//      ([[ADR-103]] 이 1.5배로 올린 값 — screen 22.5 / pre 21 / loop 17.25 / end 18)로 `img.src` 를
//      갈아끼우고, 프레임마다 [[ADR-048]] 의 origin 테이블로 좌표를 함께 옮긴다. 그 엔진은 DOM
//      (`new Image()` 프리로드 · `el.complete` · `el.style.transform`) 위에 서 있어 RN 에서는
//      다시 써야 하고, 중앙 아이템의 팝인·부유(`fx-drop-float`)는 `@keyframes` 8종에 속한다 —
//      **step 7(animations)** 몫이다.
//
// **[[ADR-103]] 의 판정 근거는 성능이 아니라 눈이다.** 그 ADR 은 2배로 올렸다가 *"너무 빨랐다"* 는
// 사용자 반려로 1.5배로 되돌아왔고("배율은 계측이 아니라 눈으로 정하는 값임이 확인됐다"), 네 단계에
// **같은 배율**을 걸어 둔 덕에 정정이 값 다섯 개 재계산으로 끝났다. RN 에서 엔진을 되살릴 때도 그
// 구조(단계별 fps 표 + 한 배율)를 먼저 세우고 값은 실기기에서 눈으로 확정해야 한다. 팝인은 fps 가
// 아니라 별도 트랜지션이라 **같은 배율로 함께** 바꿔야 한다([[ADR-103]] 결정 2) — 안 그러면 버스트가
// 사라진 뒤에도 아이템만 계속 커진다. `DROP_START_FRAME=8` 은 시간이 아니라 그림에 묶인 값이라
// 배율과 무관하다(결정 3).
//
// ── RN 으로 옮기며 갈린 것 넷 ─────────────────────────────────────────────────────
//
// ① **`createPortal(document.body)` → `react-native` 의 `Modal`.** 웹에서 이 오버레이는 시트의
//    **형제**로 포털 렌더돼 `z-[70]` 으로 시트(z-60) 위에 섰다. RN 에서는 별도 네이티브 윈도우가
//    같은 일을 하고, 덤으로 [[ADR-039]] 정정 1·2 가 다루던 문제가 **사라진다** — 탭이 시트에
//    닿지 않으므로 `pointer-events-auto` 도 `data-sheet-keep-open` 마커도 필요 없다(그 둘은 Radix
//    `dismissable-layer` 가 만든 웹 전용 결함이었다).
// ② **`radial-gradient` 는 `react-native-svg` 로 그린다.** RN 의 스타일에는 그라디언트가 없고
//    `expo-linear-gradient` 는 이름 그대로 선형뿐이다. CSS 의 `farthest-corner` 기본값을 SVG 의
//    비율 반지름으로 옮기는 것이라 반지름은 **근사**다(정사각형 기준 √2/2 ≈ 0.707).
// ③ **`mix-blend-screen` 짝이 없다.** 빛 효과 스프라이트가 검은 배경 위 가산 합성이라 그 블렌드가
//    빠지면 검은 사각형이 그대로 보인다 — 프레임이 도착할 때 함께 풀어야 하는 자리라 지금은
//    레이어 자리만 잡아 둔다(`react-native-svg` 의 마스크나 `experimental_mixBlendMode` 가 후보).
// ④ 오버레이의 색은 **테마를 따르지 않는다**([[ADR-064]] 적용 범위 밖) — 스프라이트가 어두운
//    바탕을 전제로 그려져서, 밝은 테마에서 표면색으로 바꾸면 연출 자체가 사라진다. 웹과 같은
//    고정 hex 를 그대로 쓴다.
import { useId } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import { getItemIconUrl } from '@core/lib/item-icons'

import { Svg } from '../../../lib/nativewind-interop'

/** 중앙 아이템 세로 위치(값 ↑ = 아래로). DropEff 지면 앵커도 이 값 기준으로 계산한다. */
const ITEM_CENTER_TOP = '66%'
const ITEM_SIZE_PX = 72
/** DropEff 기둥만 아이템과 무관하게 세로 이동(양수 = 아래로). */
const DROP_OFFSET_Y_PX = 8

/** 배경 방사 그라디언트 — 테마 밖 고정색(파일 머리 ④). */
const BACKDROP_INNER = '#1b0f29'
const BACKDROP_OUTER = '#05010a'
/** CSS `farthest-corner` 의 근사(파일 머리 ②). */
const BACKDROP_RADIUS = '70.7%'

interface DropEffectOverlayProps {
  itemName: string
  slot?: string
  onClose: () => void
}

export function DropEffectOverlay(props: DropEffectOverlayProps): React.JSX.Element {
  const gradientId = `drop-effect-backdrop-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const itemUrl = getItemIconUrl(props.itemName, props.slot)

  // 탭하면 곧바로 닫는다 — 웹도 `frames.end.length === 0` 이면 재생 없이 `finish()` 로 간다.
  // 엔진이 붙으면 이 자리에서 end 를 재생한 뒤 `onClose` 를 부른다(파일 머리 ⓑ).

  return (
    <Modal
      testID="drop-effect-overlay-modal"
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      <Pressable testID="drop-effect-overlay" onPress={props.onClose} className="flex-1 overflow-hidden">
        <Svg className="absolute inset-0" width="100%" height="100%">
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" r={BACKDROP_RADIUS}>
              <Stop offset="0%" stopColor={BACKDROP_INNER} />
              <Stop offset="100%" stopColor={BACKDROP_OUTER} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>

        {/* DropEff 기둥 자리 — `left/top` 이 기둥의 지면 앵커다. 프레임별 origin 정합
            ([[ADR-048]])과 그림은 엔진과 함께 온다(파일 머리 ⓑ). */}
        <View
          testID="drop-effect-pillar"
          pointerEvents="none"
          className="absolute left-1/2"
          style={{ top: ITEM_CENTER_TOP, marginTop: ITEM_SIZE_PX / 2 + DROP_OFFSET_Y_PX, zIndex: 2 }}
        />

        {/* 중앙 아이템(투명 PNG). 지금은 `getItemIconUrl` 이 항상 `null` 이라 그려지지 않는다 —
            웹에서 아이콘 매핑이 없는 아이템이 타던 분기 그대로다(에셋 레이어). */}
        {itemUrl !== null && (
          <View
            testID="drop-effect-item"
            pointerEvents="none"
            className="absolute left-1/2"
            style={{ top: ITEM_CENTER_TOP, zIndex: 3 }}
          />
        )}

        {/* ScreenEff 자리 — 전 프레임 동일 배율 + 중앙 정렬([[ADR-048]] 결정 5). */}
        <View
          testID="drop-effect-screen"
          pointerEvents="none"
          className="absolute left-1/2 top-1/2"
          style={{ zIndex: 4 }}
        />

        <View className="absolute inset-x-0 bottom-6" pointerEvents="none" style={{ zIndex: 5 }}>
          <Text
            className="text-center text-xs font-semibold"
            style={{
              color: 'rgba(255,255,255,0.8)',
              textShadowColor: 'rgba(0,0,0,0.7)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
            }}
          >
            화면을 터치하면 닫힙니다
          </Text>
        </View>
      </Pressable>
    </Modal>
  )
}
