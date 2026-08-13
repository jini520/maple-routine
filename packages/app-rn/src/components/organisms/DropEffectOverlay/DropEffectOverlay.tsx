// 고가 아이템 드롭 시 전체화면 연출([[ADR-038]]). 웹의 구성은 이렇다 — ScreenEff 가 전 프레임
// 동일 배율로 화면을 채우고, 8프레임 시점에 중앙 아이템이 팝인하며 DropEff(pre → loop ∞)가 아이템
// 하단에서 올라온다. 화면을 탭하면 end 를 재생하고 닫힌다.
//
// ══ 이 파일은 아직 **정적 구조**다 ══════════════════════════════════════════════════
//
// 3단계 step 5 의 범위는 *"구조·레이어·props 계약까지"* 이고, 실제로 두 축이 통째로 빠져 있다.
//
//   ⓐ ~~**프레임 에셋이 없다.**~~ → [[ADR-129]] 가 채웠다. `DROP_EFFECT_FRAMES` 는 이제 네 단계가
//      전부 차 있다(웹과 같은 목록·같은 순서). 남은 것은 ⓑ 하나다.
//   ⓑ **재생 엔진이 없다.** 웹은 `requestAnimationFrame` 루프가 단계별 고정 fps
//      ([[ADR-103]] 이 1.5배로 올린 값 — screen 22.5 / pre 21 / loop 17.25 / end 18)로 `img.src` 를
//      갈아끼우고, 프레임마다 [[ADR-048]] 의 origin 테이블로 좌표를 함께 옮긴다. 그 엔진은 DOM
//      (`new Image()` 프리로드 · `el.complete` · `el.style.transform`) 위에 서 있어 RN 에서는
//      다시 써야 한다.
//
//      **step 7(animations)이 이것을 못 되살린 이유는 ⓐ였고, 그 벽은 사라졌다.** RN 의 `Image` 는
//      원격 URI 를 주면 고유 크기를 모르지만 **번들 에셋은 스스로 안다** — 프레임이 번들에 들어온
//      지금은 `Image.resolveAssetSource` 로 그 크기를 읽을 수 있다. 프레임 배치는 [[ADR-048]] 의
//      origin 을 **그 프레임 비트맵 크기** 위에서 해석하는 일이므로(`dropFrameTransform` 은 origin 을
//      되미는 것이고, 되밀 대상의 크기가 필요하다) 이제 쓸 수 있는 조건이 갖춰졌다. 크기 표는
//      `DROP_EFFECT_ORIGINS` 의 **주석에만** 있고 데이터가 아니라는 것은 그대로다.
//
//   중앙 아이템의 **부유(`fx-drop-float`)는 step 7 에서 붙였다** — `@keyframes` 이고 붙일 자리(래퍼)가
//   이미 있다. **팝인(scale/opacity 트랜지션)은 안 붙였다**: 그 대상이 아직 없는 `<Image>` 이고,
//   그것을 켜는 트리거가 위의 엔진(8프레임 시점)이라 지금은 걸 곳도 켤 것도 없다.
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
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Image, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import { DROP_EFFECT_FRAMES } from '@core/lib/drop-effect-frames'
import {
  DROP_EFFECT_ORIGINS,
  DROP_PILLAR_SCALE,
  screenEffectScale,
} from '@core/lib/drop-effect-layout'
import { getItemIconUrl } from '@core/lib/item-icons'

import { AnimatedView, Svg } from '../../../lib/nativewind-interop'
import {
  advanceDropEffect,
  createDropEffectState,
  requestDropEffectClose,
  type DropEffectFrameCounts,
} from './drop-effect-player'
import { FLOAT_ANIMATION, POP_IN_ANIMATION } from './float-animation'
import { centerDropFrame, placeDropFrame, type FrameBitmapSize } from './frame-layout'

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

/**
 * 프레임 비트맵 크기 — 번들 에셋은 스스로 안다([[ADR-129]] 이후). 모르면 `null` 이고, 그때는
 * 아예 안 그린다(`frame-layout.ts` — 크기 없이 그리면 프레임마다 최대 26px 튄다).
 */
function bitmapSizeOf(source: number | { uri?: string }): FrameBitmapSize | null {
  const resolved = Image.resolveAssetSource(source as never)
  if (resolved === null || resolved === undefined) return null
  if (!Number.isFinite(resolved.width) || !Number.isFinite(resolved.height)) return null
  return { width: resolved.width, height: resolved.height }
}

export function DropEffectOverlay(props: DropEffectOverlayProps): React.JSX.Element {
  const gradientId = `drop-effect-backdrop-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const itemUrl = getItemIconUrl(props.itemName, props.slot)
  const reduceMotion = useReducedMotion()
  const { width: viewportW, height: viewportH } = useWindowDimensions()

  const counts: DropEffectFrameCounts = useMemo(
    () => ({
      screen: DROP_EFFECT_FRAMES.screen.length,
      pre: DROP_EFFECT_FRAMES.pre.length,
      loop: DROP_EFFECT_FRAMES.loop.length,
      end: DROP_EFFECT_FRAMES.end.length,
    }),
    [],
  )

  const [state, setState] = useState(createDropEffectState)

  // 상태를 ref 로도 들고 있는 이유: tick 은 `requestAnimationFrame` 콜백이라 **자기 클로저의 옛
  // state 를 본다.** 웹판이 `st` 객체 하나를 변이하며 돌던 자리와 같은 역할이다.
  //
  // **ref 가 원본이고 state 는 그림자다** — 렌더 때 `stateRef.current = state` 로 되맞추지 않는다.
  // 그 방향이면 렌더 중 ref 를 건드리게 되고(React 규칙 위반), 무엇보다 필요가 없다: 값을 바꾸는
  // 곳이 tick 과 탭 둘뿐이고 둘 다 ref 를 먼저 고친 뒤 `setState` 로 화면에 흘린다.
  const stateRef = useRef(state)

  const onCloseRef = useRef(props.onClose)
  useEffect(() => {
    onCloseRef.current = props.onClose
  }, [props.onClose])

  // 재생 루프. **`requestAnimationFrame` 인 이유는 `drop-effect-player.ts` 머리에 적었다** —
  // 스프라이트 재생은 «몇 번째 그림인가» 를 정하는 일이라 JS 스레드를 벗어날 수 없다.
  useEffect(() => {
    let raf = 0
    let last = 0

    const tick = (ts: number): void => {
      if (last === 0) last = ts
      const dt = ts - last
      last = ts

      const next = advanceDropEffect(stateRef.current, dt, counts)
      stateRef.current = next
      setState(next)

      if (next.finished) {
        onCloseRef.current()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [counts])

  // 탭 → end 재생 → 닫힘. 이미 닫는 중이면 즉시 끝난다(웹과 같은 «두 번 탭하면 건너뛴다»).
  const handlePress = useCallback(() => {
    const next = requestDropEffectClose(stateRef.current, counts)
    stateRef.current = next
    setState(next)
    if (next.finished) onCloseRef.current()
  }, [counts])

  // ── 이번 프레임에 그릴 것들
  const screenScale = screenEffectScale(viewportW, viewportH)
  const screenSource = state.screenDone ? null : (DROP_EFFECT_FRAMES.screen[state.screenIndex] ?? null)
  const screenPlacement =
    screenSource === null ? null : centerDropFrame(screenScale, bitmapSizeOf(screenSource))

  const pillarPhase = state.pillarPhase
  const pillarSource = pillarPhase === null ? null : (DROP_EFFECT_FRAMES[pillarPhase][state.pillarIndex] ?? null)
  const pillarPlacement =
    pillarPhase === null || pillarSource === null
      ? null
      : placeDropFrame(
          DROP_EFFECT_ORIGINS[pillarPhase][state.pillarIndex] ?? [0, 0],
          DROP_PILLAR_SCALE,
          bitmapSizeOf(pillarSource),
        )

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
      <Pressable testID="drop-effect-overlay" onPress={handlePress} className="flex-1 overflow-hidden">
        <Svg className="absolute inset-0" width="100%" height="100%">
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" r={BACKDROP_RADIUS}>
              <Stop offset="0%" stopColor={BACKDROP_INNER} />
              <Stop offset="100%" stopColor={BACKDROP_OUTER} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>

        {/* DropEff 기둥 — 이 View 의 좌상단이 **기둥의 지면 앵커**이고, 프레임은 자기 origin 이 그
            점에 오도록 음수 좌표로 놓인다([[ADR-048]] · `frame-layout.ts`). 검은 배경 위 가산 합성
            스프라이트라 `mixBlendMode: 'screen'` 이 필수다 — 없으면 검은 사각형이 그대로 보인다.
            블렌드는 `ViewStyle` 에만 있어 **감싸는 View 가 진다**(웹은 `<img>` 하나가 졌다). */}
        <View
          testID="drop-effect-pillar"
          pointerEvents="none"
          className="absolute left-1/2"
          style={{ top: ITEM_CENTER_TOP, marginTop: ITEM_SIZE_PX / 2 + DROP_OFFSET_Y_PX, zIndex: 2 }}
        >
          {pillarSource !== null && pillarPlacement !== null && (
            <View style={{ position: 'absolute', ...pillarPlacement, mixBlendMode: 'screen' }}>
              <Image
                testID="drop-effect-pillar-frame"
                source={pillarSource}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ width: '100%', height: '100%' }}
              />
            </View>
          )}
        </View>

        {/* 중앙 아이템(투명 PNG). [[ADR-129]] 이후 매핑이 있는 아이템은 여기까지 오지만, 그림을
            앉히는 `<Image>` 는 재생 엔진(파일 머리 ⓑ)과 함께 온다 — 팝인 트리거가 8프레임 시점이라
            엔진 없이는 켤 것이 없다. 매핑이 없는 아이템은 웹과 같은 분기로 그대로 비어 있다. */}
        {itemUrl !== null && state.itemVisible && (
          <View
            testID="drop-effect-item"
            pointerEvents="none"
            className="absolute left-1/2"
            style={{
              top: ITEM_CENTER_TOP,
              zIndex: 3,
              marginLeft: -ITEM_SIZE_PX / 2,
              marginTop: -ITEM_SIZE_PX / 2,
            }}
          >
            {/* 웹이 레이어를 셋으로 가른 이유가 RN 에서도 그대로다 — 중앙정렬(바깥)·부유(가운데)·
                팝인(안쪽)이 한 요소에 겹치면 서로의 transform 을 덮어쓴다.
                모션 줄이기면 둘 다 안 건다(웹의 `prefers-reduced-motion` 짝). */}
            <AnimatedView
              testID="drop-effect-item-float"
              style={reduceMotion ? undefined : FLOAT_ANIMATION}
            >
              <AnimatedView
                testID="drop-effect-item-pop"
                style={reduceMotion ? undefined : POP_IN_ANIMATION}
              >
                <Image
                  testID="drop-effect-item-image"
                  source={itemUrl}
                  accessibilityLabel={props.itemName}
                  resizeMode="contain"
                  style={{ width: ITEM_SIZE_PX, height: ITEM_SIZE_PX }}
                />
              </AnimatedView>
            </AnimatedView>
          </View>
        )}

        {/* ScreenEff — 전 프레임 동일 배율 + 화면 중앙([[ADR-048]] 결정 5). 기둥과 같은 이유로
            가산 합성이다. */}
        <View
          testID="drop-effect-screen"
          pointerEvents="none"
          className="absolute left-1/2 top-1/2"
          style={{ zIndex: 4 }}
        >
          {screenSource !== null && screenPlacement !== null && (
            <View style={{ position: 'absolute', ...screenPlacement, mixBlendMode: 'screen' }}>
              <Image
                testID="drop-effect-screen-frame"
                source={screenSource}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ width: '100%', height: '100%' }}
              />
            </View>
          )}
        </View>

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
