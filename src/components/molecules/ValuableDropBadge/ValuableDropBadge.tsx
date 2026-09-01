import { getItemIconUrl } from '../../../lib/item-icons'
import type { RecordedDrop } from '../../../types/drops'
import { Image, View } from 'react-native'

import { SparklesIcon } from '../../../lib/icons'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import { LinearGradient } from '../../../lib/nativewind-interop'
import { Text } from '../../atoms'

// 실제 획득한 고가 아이템 아이콘(최대 3개 + 나머지 개수)을 골드 반짝임 칩으로 보여준다([[ADR-045]]).
// 배치·라벨은 호출부가 정한다([[ADR-046]]) — 캐릭터 카드는 우상단 절대배치, 총 수익 헤드라인은
// 라벨행 우측 인라인, 드롭 히스토리는 미획득 기간 요약 줄 안([[ADR-071]] 결정 4).
// **외형·아이콘 스택 규칙은 이 단일 구현이 전부다** — 세 화면이 쓰므로 화면 파일이 아니라 여기 산다.
//
// ── 이 배지에는 모션이 없다 (step 사양 정정) ──────────────────────────────────────
//
// 이 phase 의 지시는 *"`ValuableDropBadge` 의 모션은 step 7"* 이었으나 **전제가 틀렸다.**
// `index.css` 의 `.valuable-drop-badge` 는 **그라디언트 pill + 글자색 + 글로우 그림자 셋뿐**이고
// `@keyframes` 가 하나도 없다. 움직이는 것은 이 배지를 **얹는 쪽**이다 —
// `valuable-drop-glow`(카드 맥동)·`valuable-drop-spin`(회전 샤인 링, [[ADR-045]] 결정 2·4)·
// `valuable-drop-row-pulse`(보스 행 틴트, 결정 5). 전부 캐릭터 카드와 보스 행이라 step 5~6 이
// 만나고, 그때 step 7 의 몫이 된다. **그래서 이 컴포넌트는 정지 상태가 아니라 완성된 상태다.**
//
// ── RN 으로 옮기며 바뀐 것 여섯 ─────────────────────────────────────────────────────
//
// ① `linear-gradient(135deg, …)` → `LinearGradient` 의 대각선 두 점. CSS 135deg 는 "왼쪽 위 →
//    오른쪽 아래"라 `start {0,0}` · `end {1,1}` 이다. 두 점을 **둘 다 명시**한다(기본값에 기대면
//    뒤집혔을 때 조용히 다른 그림이 된다 — `Badge` 의 난이도 variant 와 같은 규칙).
// ② `box-shadow` 글로우 → `boxShadow`(RN 0.76+). iOS 전용 `shadow*` 로 쓰면 안드로이드에서는
//    `elevation` 밖에 없어 **색 있는 글로우가 통째로 사라진다**. 고가 신호는 골드 색 자체라 그것을
//    잃으면 뜻이 안 남는다.
// ③ `ring-[1.5px] ring-white/80` → 같은 크기의 `boxShadow` 확산(spread). Tailwind 의 ring 은
//    **박스 바깥**에 그려져 레이아웃을 안 건드리는데, `borderWidth` 로 옮기면 20px 원 안쪽을 깎아
//    아이콘이 작아진다. `spreadDistance` 는 ring 과 같은 자리에 그려진다.
// ④ `role="img"`·`title` → `accessibilityRole="image"` + `aria-label`. `title`(마우스 툴팁)은 RN 에
//    짝이 없어 사라진다 — 터치 기기에서는 웹에서도 뜨지 않았다.
// ⑤ `tabular-nums` 는 클래스로 안 나와 스타일 값으로 준다(`lib/text-styles.ts` — NativeWind 가 그
//    클래스를 스타일 없이 통과시킨다). `+N` 이 한 자리에서 두 자리로 늘 때 배지 폭이 튀지 않는다.
// ⑥ **아이콘이 붙었다 (2026-08-14)** — 이 자리는 오래 «전부 회색 원» 이었다. 이 컴포넌트가
//    `getItemIconUrl` 을 **아예 부르지 않았기** 때문이고, [[ADR-129]] 로 에셋이 온 뒤에도 *"에셋
//    레이어는 값을 대는 데까지"* 라며 그림 붙이기를 화면 작업 몫으로 미뤄 둔 자리다. 그 폴백 원은
//    **어두운 테마에서 새까맣게** 보여 «아이템 이미지가 안 나온다» 로 보고됐다(사용자).
//
//    변환은 예고된 대로 기계적이었다 — `source` 에는 **조회 결과를 그대로** 넣고(번들 에셋이라
//    원격 URI 처럼 `{ uri }` 로 감싸지 않는다, `CharacterTrackingGrid` 주석 ⑤), `object-contain` 은
//    `resizeMode="contain"` 이다. **바탕색이 갈리는 것까지 웹과 같다** — 그림이 있으면 `bg-surface`,
//    폴백 원만 `bg-surface-2` 다. 매핑에 없는 이름은 **여전히 폴백**이라 «에셋이 왔으니 무조건
//    그린다» 로 굳지 않는다.
//
//    상자는 `h-5 w-5` 로 **두 축이 다 적혀 있어** [[ADR-135]] 의 «안 적은 축에 고유 크기가 남는»
//    함정에 걸리지 않는다.
//
//    **`aria-hidden` 을 달지 않는다.** 웹의 `alt=""` 짝은 «접근성 트리에서 숨김» 이 아니라 «이름이
//    없음» 이고, 이름 없는 RN `<Image>` 는 애초에 접근성 요소가 아니다(배지 전체가 ④의 `aria-label`
//    을 이미 진다). 달면 폴백 `View` 와 **두 갈래의 접근성이 갈리고**, RNTL 기본 질의에서도 한쪽만
//    빠져 테스트가 갈래마다 다른 질의를 써야 한다.

/** `.valuable-drop-badge` — 전 테마 공통 골드([[ADR-045]] 결정 3). 테마 토큰이 아니라 고정 신호색이다. */
const BADGE_GRADIENT = ['#ffe98a', '#f7c400'] as const
const BADGE_INK = '#6b4e00'
const BADGE_GLOW = [{ offsetX: 0, offsetY: 0, blurRadius: 8, color: 'rgba(247, 208, 13, 0.55)' }]

/** 아이콘 원의 흰 링 — 웹의 `ring-[1.5px] ring-white/80`. */
const ICON_RING = [
  { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: 'rgba(255, 255, 255, 0.8)' },
]

export function ValuableDropBadge(props: {
  drops: RecordedDrop[]
  label: string
  className?: string
}): React.JSX.Element {
  const shown = props.drops.slice(0, 3)
  const extra = props.drops.length - shown.length

  return (
    <LinearGradient
      testID="valuable-drop-badge"
      accessibilityRole="image"
      aria-label={props.label}
      colors={BADGE_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ boxShadow: BADGE_GLOW }}
      className={`flex-row shrink-0 items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2${
        props.className !== undefined ? ` ${props.className}` : ''
      }`}
    >
      <SparklesIcon className="h-3 w-3 shrink-0" color={BADGE_INK} strokeWidth={2.5} aria-hidden />
      <View className="flex-row items-center">
        {shown.map((drop, index) => {
          const url = getItemIconUrl(drop.itemName, drop.slot)
          // 스택·링은 **두 갈래가 같다**(파일 머리 ⑥) — 웹도 두 분기에 같은 클래스를 적어 두었다.
          const stackStyle = {
            marginLeft: index === 0 ? 0 : -6,
            zIndex: shown.length - index,
            boxShadow: ICON_RING,
          }

          return url === null ? (
            <View
              key={`${drop.itemName}-${index}`}
              testID="valuable-drop-icon"
              style={stackStyle}
              className="h-5 w-5 shrink-0 rounded-full bg-surface-2"
            />
          ) : (
            <Image
              key={`${drop.itemName}-${index}`}
              testID="valuable-drop-icon"
              source={url}
              resizeMode="contain"
              style={stackStyle}
              className="h-5 w-5 shrink-0 rounded-full bg-surface"
            />
          )
        })}
      </View>
      {extra > 0 && (
        <Text
          className="text-10 font-bold leading-none"
          style={{ color: BADGE_INK, ...TABULAR_NUMS }}
        >
          +{extra}
        </Text>
      )}
    </LinearGradient>
  )
}
