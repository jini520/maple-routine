/**
 * 떠 있는 캡슐 하단바 — [[ADR-132]] 결정 3·11(결정 9 의 광고 게이트는 [[ADR-150]] 에서 폐기).
 *
 * ## 이 파일이 하는 일은 «그리기 + 배선» 뿐이다
 *
 * 층 판정과 기록 규칙은 전부 `bar-model.ts` 의 순수 함수가 갖는다. 여기서는 그 결과를 그리고,
 * 리듀서가 돌려준 페이지로 이동시키고, 기록을 저장소에 넣는다. 규칙을 여기 두면 사용자가 준 예시
 * 셋을 화면 조작으로만 검증할 수 있게 되어 명세가 흐려진다.
 *
 * ## 왜 절대 배치인가
 *
 * 바가 **떠 있어야** 하고(콘텐츠가 그 아래로 지나간다), `BottomTabView` 는 탭바를 flex 자식으로
 * 두므로 그냥 두면 화면 높이를 그만큼 먹는다. 루트를 `position: absolute` 로 빼면 흐름에서 빠져
 * 화면이 전체 높이를 갖고, 콘텐츠의 여백은 `ScreenScroll` 이 따로 준다(`bottom-inset.ts`).
 *
 * ## 치수는 «계산» 한다 — 재는 것이 하나도 없다
 *
 * 항목마다 `onLayout` 을 달아 실측하면 전환 중간값이 잡혀 알약이 목표를 지나쳤다 돌아온다. 그래서
 * 한때는 캡슐 하나만 쟀는데(그 값은 전환 중에 안 변한다), 정정 30 으로 **바 폭 자체가 창 폭의
 * 함수**가 되면서 그것마저 필요 없어졌다(`lib/bottom-bar-metrics.ts`). 칸은 균등 분할이라 나눗셈으로
 * 나오고, 계산은 **첫 프레임부터 맞다** — 측정은 첫 프레임에 0 이라 알약이 한 프레임 접혀 있었다.
 *
 * ## 유리 — **플랫폼의 재질을 쓴다** (정정 13)
 *
 * `expo-blur` 위에 불투명한 색을 덮는 판을 한 번 만들었다가 «글라스 느낌이 전혀 안 난다» 로 반려됐다.
 * 당연했다 — 유리를 깔고 그 위를 90% 불투명 색으로 덮으면 남는 것은 색뿐이다.
 *
 * 지금은 `expo-glass-effect` 의 `GlassView`(iOS 26 `UIGlassEffect`)를 쓴다. 블러가 아니라 **재질**
 * 이라 배경을 굴절시키고 가장자리에 하이라이트가 돈다 — 레퍼런스의 그 «Liquid Glass» 다. 색은
 * 얹지 않고 `tintColor` 로만 아주 옅게 넣는다.
 *
 * ## 재질이 없는 쪽은 **흉내 내지 않는다 — 색만 맞춘다** (정정 29)
 *
 * `expo-glass-effect` 는 iOS 26 이상에서만 산다. 그 아래 iOS 와 안드로이드에는 이 재질이 없고,
 * **없는 것을 흉내 내지 않는다**(사용자 지시) — 그쪽은 불투명 캡슐로 두고 **색 관계만** 유리와
 * 같은 자리에 세운다(`bar-colors.ts` 의 `neutralPlate`).
 *
 * 블러로 흉내 내는 판을 한 번 만들어 봤고 되돌렸다. 재질은 흉내가 되는데 대가가 셋이었다 —
 * 대상을 잘못 주면 네이티브가 무한 재귀로 죽고(실기기 크래시), 스크롤 자크가 3.0 → 11.0% 로 뛰고,
 * 그 모든 것이 **플랫폼이 주지 않는 것을 억지로 만든** 값이다. 자세한 것은 [[ADR-132]] 정정 29.
 *
 * ## 층 전환 애니메이션
 *
 * 그룹 행 ↔ 하위 행은 **같은 자리에 겹쳐 두고 크로스페이드**한다(둘 다 절대 배치). 하나만 마운트해
 * 갈아 끼우면 «사라졌다 나타난다» 가 되어 두 층의 관계가 안 보인다. 전환을 모는 값은 `visual`
 * 하나이고 **전부 네이티브 드라이버**다 — 레이아웃 값을 하나도 건드리지 않기 때문이다(← 자리는
 * 상자를 넓히는 대신 행을 한 칸 «옮겨» 만든다). 그래서 탭 직후 화면 마운트로 JS 가 막혀도
 * 전환이 끝까지 매끄럽다.
 *
 * 보이지 않는 행에는 `aria-hidden` 을 준다 — 스크린 리더뿐 아니라 **테스트가 «지금 보이는 층»을
 * 물을 수 있게** 하는 값이다(`queryByTestId` 기본이 숨은 요소를 거른다).
 *
 * ## 키보드
 *
 * `tabBarHideOnKeyboard` 는 라이브러리 탭바의 기능이라 커스텀 바에는 오지 않는다([[ADR-132]] 대가).
 * `use-keyboard-shown.ts` 가 라이브러리와 **같은 이벤트**를 구독해 그 자리를 메운다 — 입력 중엔
 * 바가 키보드 위에 얹혀 의미도 없고 시야만 가린다.
 */

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'

import { GearIcon } from '../components/atoms/GearIcon/GearIcon'
import { ProfitIcon } from '../components/atoms/ProfitIcon/ProfitIcon'
import { BAR_LIFT, resolveBottomBarMetrics } from '../lib/bottom-bar-metrics'
import { useBottomSafeAreaPx } from '../lib/bottom-safe-area'
import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  CrosshairIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  SwordsIcon,
  WalletIcon,
  WrenchIcon,
} from '../lib/icons'
import { useThemeAppearance } from '../theme/context'
import { resolveBarColors } from './bar-colors'
import {
  BAR_GROUPS,
  barLayer,
  canGoBack,
  groupOfPage,
  pressBack,
  pressGroup,
  pressSub,
  visibleSubs,
  type BarState,
  type GroupId,
} from './bar-model'
import { registerBarBackHandler, setBarRecord, toBarRecord, useBarRecord } from './bar-store'
import { useKeyboardShown } from './use-keyboard-shown'
import type { TabRouteName } from './routes'

/** 치수 — `design-system.md` 「하단바」 표와 같은 값이어야 한다. */
/**
 * **알약이 칸보다 넓은 정도** — 이 값 하나가 나머지 셋을 정한다(사용자 지시, 2026-08-13).
 *
 * 요구가 셋이었다: ① 항목 간 간격을 줄인다 ② 알약은 칸 경계를 넘어도 된다 ③ **끝 칸에서 알약이
 * 바 가장자리로부터 위아래와 «같은» 여백을 남긴다.** 셋이 서로 묶여 있어 값을 따로 고를 수 없다 —
 * 하나를 정하면 나머지는 계산으로 나온다.
 *
 * ```
 * 칸  S = (바폭 − 패딩×2 − O) ÷ 항목수      ← O 가 클수록 칸이 좁아진다(= 간격이 준다)
 * 알약 W = S + O
 * 들여 T = 패딩 + O ÷ 2                     ← 끝 칸 알약이 정확히 «패딩» 만큼 남기는 자리
 * ```
 *
 * 402pt 기기에서 O=23 이면 칸 69 · 알약 92 · 들여쓰기 14.5 이고, 양 끝 여백이 위아래와 같은 3 이다.
 * 세 값을 손으로 적어 두면 기기 폭이 바뀌는 순간 균형이 깨진다 — 그래서 **상수는 이것 하나**다.
 */
const PILL_OVERHANG = 23
/**
 * 바 안쪽 여백 — 6 에서 **3** 으로 줄였다(사용자 지시 + 레퍼런스 실측, 2026-08-13).
 *
 * 레퍼런스 두 장에서 «활성 알약 높이 ÷ 바 높이» 가 0.89 인데 우리는 0.80 이었다. 그 차이가 곧
 * 이 여백이고, 좁힐수록 알약이 바를 꽉 채워 «항목이 바 안에 떠 있는» 느낌이 사라진다.
 *
 * **바 높이가 기기마다 달라져도 이 값은 상수다**([[ADR-132]] 정정 30) — 여백은 «판 둘레의 선» 이라
 * 판이 커진다고 함께 커질 이유가 없고, 커지면 위 비율(0.92)이 작은 기기에서 먼저 무너진다.
 */
const BAR_PADDING = 3
/**
 * ← 원이 **알약 높이에서 차지하는 비율** — 402pt 기기의 «48 / 66» 이다([[ADR-132]] 정정 30).
 *
 * 한때 48 «고정» 이었고, 그 지시가 겨눈 것은 **바 안쪽 여백**이었다(여백을 줄여도 원은 그대로).
 * 기기 폭은 다른 축이라 그대로 두면 하한(높이 64 · 알약 58)에서 원이 알약을 거의 채우고 태블릿
 * (81 · 알약 75)에서는 점이 된다. 비율로 두면 402pt 에서 값이 **48 그대로**다.
 *
 * 원이 차지하는 **폭**은 이것이 아니라 **한 칸(`itemWidth`)** 이다 — 위치와 너비는 메뉴 하나와 같게
 * 두고 배경만 원으로 남긴다. 그래야 ← 도 «이 바의 항목 하나» 로 읽히고, 하위 행이 둘째 칸에서
 * 시작해 그룹 행의 격자와 어긋나지 않는다.
 */
const BACK_CIRCLE_RATIO = 48 / 66
/**
 * 알약이 **같은 층 안에서** 미끄러지는 시간.
 *
 * 340ms 였다가 240 으로 줄였다(사용자 판정, 2026-08-13). 그 값은 앱의 «화면이 통째로 밀려 들어오는»
 * 전환에서 온 것이라, 70~145pt 를 움직이는 작은 판에는 길다.
 */
const TRAVEL_MS = 240

/**
 * 그림자 한 겹 — **불투명도 · 반경 · 아래로 민 거리**.
 *
 * `shadowOpacity` 가 이름에 남아 있는 것은 그 값이 테마 `shadowColor` 의 알파(`59` = 0.35)와
 * **곱해지는** 자리이기 때문이다(아래 `boxShadow`). 0.65 는 과한 값이 아니라 실효 0.23 이다.
 */
interface ShadowLayer {
  readonly opacity: number
  readonly radius: number
  readonly y: number
}

/**
 * `shadow*` → `boxShadow` **번역기** ([[ADR-132]] 정정 28).
 *
 * ## 왜 옮기는가
 *
 * `shadowOpacity` · `shadowRadius` · `shadowOffset` 은 **iOS 전용 프롭**이다. 그것으로 쓰는 동안
 * 정정 22 가 맞춰 둔 층은 **안드로이드에 하나도 도달하지 않았고**, 거기서는 `elevation` 의 기본
 * 그림자가 바 · 알약 · ← 셋을 같은 세기로 그렸다. 폴백 알약이 분홍이라 그 부재가 안 보였을 뿐이고
 * (색으로 이미 갈렸으니까), 그 색을 빼는 순간(`bar-colors` 의 `neutralPlate`) **그림자가 유일한
 * 층 장치**가 된다 — 그래서 이 변경과 그 변경은 한 쌍이다.
 *
 * `boxShadow` 는 RN 0.76+ 가 양 플랫폼에 같은 그림자를 그리는 자리다(안드로이드는 새 아키텍처
 * 전용 — 이 앱은 `newArchEnabled=true`).
 *
 * ## 옮기면서 **두 값이 번역된다** — 그대로 옮기면 다른 그림자가 된다
 *
 * - **블러는 두 배다.** `boxShadow` 의 반경은 CSS 정의이고, RN 의 iOS 구현이 그것을
 *   `shadowRadius = blurRadius / 2` 로 되돌린다(`RCTBoxShadow.mm`). 그래서 여기서 ×2 로 낸다.
 * - **알파는 미리 곱한다.** iOS 는 `shadowColor` 의 알파와 `shadowOpacity` 를 곱하는데
 *   `boxShadow` 는 색의 알파를 그대로 쓴다. 곱을 여기서 한 번 해 두면 실효값이 안 변한다.
 */
function boxShadow(shadowColor: string, { opacity, radius, y }: ShadowLayer): string {
  const base = shadowColor.slice(0, 7)
  const themeAlpha = Number.parseInt(shadowColor.slice(7, 9) || 'ff', 16) / 255
  const alpha = Math.round(themeAlpha * opacity * 255)
    .toString(16)
    .padStart(2, '0')

  return `0px ${y}px ${radius * 2}px ${base}${alpha}`
}

/** 바 자신의 그림자 — **아주 약하게**(사용자 지시). 층은 알약 쪽에서 만든다. */
const BAR_SHADOW: ShadowLayer = { opacity: 0.22, radius: 14, y: 5 }

/**
 * 활성 알약과 ← 가 **공유하는** 층 그림자.
 *
 * 둘은 «바 위에 한 겹 떠 있는 판» 이라는 같은 물건이라 같은 값을 써야 한다(사용자 지시, 2026-08-13 —
 * ← 도 알약과 같은 디자인으로, 크기만 그대로). 값을 각자 적어 두면 한쪽만 손볼 때 조용히 갈린다.
 *
 * **값이 큰 것은 과해서가 아니라 두 번 깎이기 때문이다.** 테마의 `shadowColor` 알파(0.35)와
 * 곱해져 실효 0.23 이다 — 0.26(실효 0.09)일 때 라이트에서는 **층이 아예 안 보였다**(사용자 판정 —
 * *"라이트 테마에 active 가 다른 것들이랑 구분이 잘 안돼"*).
 *
 * **유리와 폴백이 같은 값을 쓴다**(정정 28). 갈라 뒀던 근거는 *"폴백 알약은 불투명 색이라 이미
 * 갈린다"* 였는데, 그 알약에서 색을 뺐으므로 근거 자체가 사라졌다.
 */
const PLATE_SHADOW: ShadowLayer = { opacity: 0.65, radius: 10, y: 3 }
/** 층 전환(페이드·← 열림). 알약보다 조금 짧아 알약이 마지막에 자리를 잡는다. */
const LAYER_MS = 280
/** 들어오는 행이 오른쪽에서 밀려 들어오는 거리. 크면 «날아온다» 가 되어 층 관계가 흐려진다. */
const ROW_SHIFT = 10
/** 앱이 이미 쓰는 스택 전환 커브([[ADR-120]])와 같은 가족. */
const EASE = Easing.bezier(0.32, 0.72, 0, 1)

/**
 * 아이콘 선 굵기 — 사용자가 시안 조절기로 확정한 값이다(2026-08-13).
 *
 * 크기·간격·라벨은 클래스에 박혀 있는데 이것만 상수인 이유는 `strokeWidth` 가 **className 이 아니라
 * 프롭**이기 때문이다(`lib/nativewind-interop`). 항목 아이콘과 ← 가 같은 값을 써야 해서 이름을 준다.
 */
const ICON_STROKE = 1.5
/**
 * 활성인데 **채울 수 없는** 그림의 획 굵기 ([[ADR-132]] 정정 27).
 *
 * 채우기가 통하는 다섯(대시보드·렌치·장바구니·톱니·수익)은 면으로 활성을 말한다. 나머지
 * (달력·지갑·목록·검·조준경)는 안쪽 선이 의미를 져서 채울 수 없으므로 **굵기**로 말한다.
 * 둘을 같이 주면 채운 그림이 과해지므로 **배타**다 — `activeStroke` 가 그것을 한 자리에서 고른다.
 */
const ICON_STROKE_ACTIVE = 2.75

type IconComponent = React.ComponentType<{
  className?: string
  color?: string
  fill?: string
  strokeWidth?: number
}>

/**
 * 그룹·하위가 쓰는 아이콘.
 *
 * 컨텐츠·보스·설정과 **보스 수익**은 앱이 이미 쓰던 그림 그대로다(보스 수익은 커스텀 `ProfitIcon` —
 * [[ADR-066]] 이 금지한 «도메인 아이덴티티를 임의의 lucide 로 대체» 를 하지 않는다).
 * 나머지 다섯은 이번에 생긴 자리라 제안값이고, [[ADR-132]] 열린 질문에 그대로 적혀 있다.
 */
const ICONS: Readonly<Record<GroupId | TabRouteName, IconComponent>> = {
  today: LayoutDashboardIcon,
  schedule: CalendarCheckIcon,
  ledger: WalletIcon,
  utility: WrenchIcon,
  settings: GearIcon,
  Today: LayoutDashboardIcon,
  Content: ListChecksIcon,
  Boss: SwordsIcon,
  // 검(보스)·목록(컨텐츠)과 겹치지 않으면서 «값을 맞추는 자리» 를 말하는 그림이다([[ADR-145]]
  // 결정 1) — 위 다섯과 같은 **제안값**이고 확정은 실기기에서 나란히 보고 한다.
  BossManage: SlidersHorizontalIcon,
  Profit: ProfitIcon,
  HuntingProfit: CrosshairIcon,
  Spend: ShoppingCartIcon,
  Utility: WrenchIcon,
  Settings: GearIcon,
}

/**
 * 활성일 때 **면으로 채우는** 아이콘 — 나머지는 선 그대로 둔다(사용자 지시, 2026-08-14).
 *
 * 채우기가 통하는 것은 **안쪽에 의미가 없는** 그림뿐이다. fill 과 stroke 가 같은 색이라, 안쪽에
 * 선이 있는 아이콘은 채우는 순간 그 선이 통째로 사라진다 — 시뮬레이터에서 열 개를 다 채워 보고
 * 골랐다.
 *
 *   살아남음  대시보드(사각 넷) · 렌치(실루엣 하나) · 장바구니(윤곽 자체가 그림) ·
 *             검(칼날이 면으로 차고 손잡이 선은 남는다 — 사용자 판정으로 뒤늦게 편입)
 *   무너짐    톱니 → 가운데 구멍이 메워져 덩어리 · 조준경 → 십자선이 사라져 원판
 *             달력·지갑 → 안쪽 체크·주머니를 잃음 · 목록 → 선뿐이라 채울 «면» 이 없음
 *             수익(`ProfitIcon`) → 열린 호로 그린 커스텀이라 `fill="none"` 이 규격이다([[ADR-066]])
 *
 * 아이콘 **컴포넌트**로 잡는 이유는 같은 그림이 두 자리에 쓰이기 때문이다(today 는 그룹과 페이지,
 * 렌치는 유틸리티 그룹과 페이지). 라우트 키로 잡으면 한쪽만 채워지는 사고가 난다.
 */
const FILLED_ICONS: ReadonlySet<IconComponent> = new Set([
  LayoutDashboardIcon,
  WrenchIcon,
  ShoppingCartIcon,
  SwordsIcon,
  // 아래 둘은 우리가 그린 아이콘이라 **채울 자리를 고를 수 있다** — 수익은 동전 두 개만 면이
  // 되고 단을 그리는 호는 선으로 남으며, 톱니는 몸통만 차고 가운데가 구멍으로 남는다.
  ProfitIcon,
  GearIcon,
])

/** 활성 아이콘이 쓸 `fill` — 채우지 않는 그림은 `none` 그대로다. */
function activeFill(Icon: IconComponent, active: boolean, accent: string): string {
  return active && FILLED_ICONS.has(Icon) ? accent : 'none'
}

/** 채우지 못하는 그림만 활성일 때 굵어진다 — 채우는 그림은 기본 굵기 그대로다(배타). */
function activeStroke(Icon: IconComponent, active: boolean): number {
  return active && !FILLED_ICONS.has(Icon) ? ICON_STROKE_ACTIVE : ICON_STROKE
}

interface BarItemProps {
  icon: IconComponent
  label: string
  active: boolean
  /** 활성일 때 아이콘·라벨이 **함께** 쓰는 색(`bar-colors.ts` 의 `accent`). */
  accent: string
  /**
   * 비활성 색 — `text-muted` 가 아니라 **채도를 뺀** 값이다(`bar-colors.ts` 의 `muted`).
   *
   * 바 안에서 색을 지는 자리는 활성 하나다. 클래스(`text-text-muted`)로 두면 레테처럼 `textMuted`
   * 자체가 연보라인 테마에서 비활성까지 같은 색 계열로 읽힌다([[ADR-132]] 정정 24).
   */
  muted: string
  /** 층과 무관하게 같은 값이다 — 그룹 다섯이 꽉 찼을 때의 칸 폭(`BottomBar` 의 `itemWidth`). */
  width: number
  /**
   * 알약 높이 = 바 높이 − 여백×2. **상수가 아니라 프롭인 것이 [[ADR-132]] 정정 30 이다** — 바
   * 세로가 기기 폭에서 나오므로 이 항목의 과녁도 함께 자란다(글리프는 안 자란다).
   */
  height: number
  testID: string
  onPress: () => void
}

function BarItem({
  icon: Icon,
  label,
  active,
  accent,
  muted,
  width,
  height,
  testID,
  onPress,
}: BarItemProps): React.JSX.Element {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width, height }}
      className="items-center justify-center"
    >
      <View className="items-center gap-[4px]">
        {/* 아이콘과 라벨은 **같은 색**이다. 강조색을 그대로 쓰면 테마에 따라 대비가 1.89 까지
            내려가므로, «읽힐 때까지 민» 값을 `bar-colors.ts` 가 계산해 준다. */}
        <Icon
          className="h-[25px] w-[25px]"
          color={active ? accent : muted}
          fill={activeFill(Icon, active, accent)}
          strokeWidth={activeStroke(Icon, active)}
        />
        <Text
          numberOfLines={1}
          // `includeFontPadding` 은 **안드로이드에서만 읽히는 값**이고, 기본(참)일 때 글자 상자에
          // 폰트 메트릭 여백을 더해 iOS 보다 큰 상자를 만든다 ([[ADR-132]] 정정 28). 실측으로
          // 아이콘→라벨이 27 → 30px 이 되고 블록이 5px 자라 **아이콘이 3px 위로 밀렸다** — 두
          // 플랫폼이 같은 리듬을 쓰려면 여기서 꺼야 한다(iOS 는 이 값을 무시한다).
          style={{ color: active ? accent : muted, includeFontPadding: false }}
          className="text-[10.5px] font-normal tracking-[-0.01em]"
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

export function BottomBar({ state, navigation }: BottomTabBarProps): React.JSX.Element | null {
  // **인셋이 아니라 하한이 깔린 값이다**([[ADR-132]] 정정 31) — 결정 11 의 들어올림이 0 이라 이
  // 값이 곧 «캡슐이 바닥에서 뜨는 높이» 이고, 안드로이드 제스처 기기(15)에서는 그것이 iOS 의 절반도
  // 안 됐다. 콘텐츠가 남기는 몫(`ScreenScroll`)과 토스트도 같은 함수를 본다.
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const { definition } = useThemeAppearance()
  const record = useBarRecord()
  const isKeyboardShown = useKeyboardShown()
  // **바의 세로는 창 폭에서 나온다**([[ADR-132]] 정정 30). 콘텐츠가 남기는 몫도 같은 함수를 보므로
  // (`ScreenScroll` → `bottom-inset.ts`) 두 값이 어긋날 자리가 없다.
  const { width: windowWidth } = useWindowDimensions()
  const metrics = resolveBottomBarMetrics(windowWidth)
  const barHeight = metrics.heightPx
  /** 바 높이에서 위아래 여백을 뺀 값. 둘은 함께 움직인다 — 따로 두면 알약이 바 안에서 떠 버린다. */
  const pillHeight = barHeight - BAR_PADDING * 2
  const backCircle = Math.round(pillHeight * BACK_CIRCLE_RATIO)

  const page = state.routes[state.index].name as TabRouteName
  const bar: BarState = useMemo(() => ({ page, ...record }), [page, record])

  const colors = resolveBarColors(definition)
  // iOS 26 이상에서만 **Liquid Glass** 가 있다. 그 밖(안드로이드 · iOS 26 미만)은 블러 재질이다
  // (정정 29) — 재질이 아예 없는 «불투명 캡슐» 로 떨어지지는 않는다.
  const glass = isLiquidGlassAvailable()
  const layer = barLayer(bar)
  const subs = visibleSubs(bar)
  const hasBack = canGoBack(bar)

  const groupItems = BAR_GROUPS.map((group) => ({
    key: group.id,
    label: group.label,
    icon: ICONS[group.id],
    active: group.id === groupOfPage(page).id,
  }))
  const subItems = subs.map((sub) => ({
    key: sub.page,
    label: sub.label,
    icon: ICONS[sub.page],
    active: sub.page === page,
  }))

  const items = layer === 'sub' ? subItems : groupItems
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.active),
  )

  // ── 알약과 층 ────────────────────────────────────────────────────────────────
  //
  // ## 재는 것이 **하나도 없다**
  //
  // 처음에는 트랙(항목이 들어가는 상자)을 재고 거기에 ← 몫을 더해 바 폭을 역산했다. 그런데 트랙
  // 폭은 **애니메이션이 바꾸는 값**이라, 그 측정으로 `itemWidth` 를 정하면 애니메이션 → 측정 →
  // `itemWidth` → 애니메이션 범위로 도는 고리가 된다. 실제로 그 고리가 **잘못된 값에 고착**되는
  // 것을 사용자가 잡았다(2026-08-13 — 그룹 행인데 왼쪽 한 칸이 비고 알약이 원으로 남았다).
  //
  // 그다음 판은 바 루트 하나만 쟀다(좌우가 고정이라 폭이 안 변한다). 정정 30 이 그것마저 걷는다 —
  // 바 폭이 **창 폭의 함수**라 계산으로 나오고, 계산은 첫 프레임부터 맞다(측정은 첫 프레임에 0 이라
  // 알약이 한 프레임 접혀 있었다). 위 고리는 이제 원인 자체가 없다.
  //
  // ## 그래서 **폭을 움직이는 애니메이션이 하나도 없다**
  //
  // ← 자리는 «상자를 넓히는» 대신 **행을 한 칸 옆으로 옮겨** 만든다. 이동·불투명도·크기는 전부
  // 네이티브 드라이버가 나를 수 있으므로, 탭 직후 화면 마운트로 JS 가 막혀도 전환이 끝까지
  // 매끄럽다(그것이 «부르르» 의 원인이었다).
  const itemWidth = (metrics.widthPx - BAR_PADDING * 2 - PILL_OVERHANG) / BAR_GROUPS.length
  /** 항목 영역을 바 안쪽에서 들여쓰는 양 — 끝 칸 알약이 `BAR_PADDING` 만큼만 남기게 하는 값. */
  const trackInset = PILL_OVERHANG / 2
  /**
   * ← 원이 바 가장자리에서 남기는 여백 — **위아래와 같은 값**(사용자 지시, 2026-08-13).
   *
   * 원은 알약 높이의 행 안에서 세로 가운데라 위아래로 `패딩 + (행 − 원)/2` 만큼 남는다. 가로도 그
   * 값이어야 «사방이 같은» 원이 된다. 전에는 칸 안에서 가로 가운데였고(= 25) 그래서 왼쪽만 두 배쯤
   * 넓었다. **다른 항목은 이 값과 무관하다** — ← 는 절대 배치라 하위 행의 자리를 밀지 않는다.
   */
  const backCircleMargin = BAR_PADDING + (pillHeight - backCircle) / 2
  const pillWidth = itemWidth + PILL_OVERHANG
  /** 하위 행은 ← 가 차지한 첫 칸 다음에서 시작한다 — 그룹 행의 격자를 그대로 쓴다. */
  const rowOffset = layer === 'sub' ? itemWidth : 0
  const pillX = rowOffset + activeIndex * itemWidth + (itemWidth - pillWidth) / 2

  // `useRef(new Animated.Value(…)).current` 가 아니라 **lazy `useState`** 다. 값이 마운트 동안
  // 고정이라는 뜻은 같은데, 그쪽은 «렌더 중 ref 읽기» 라 `react-hooks/refs` 가 막는다.
  const [x] = useState(() => new Animated.Value(0))
  /** 0 = 그룹 행 · 1 = 하위 행. **전부 네이티브 드라이버다** — 레이아웃 값을 하나도 안 건드린다. */
  const [visual] = useState(() => new Animated.Value(layer === 'sub' ? 1 : 0))
  const settled = useRef(false)
  const previousLayer = useRef(layer)

  // 첫 배치를 «측정이 도착하면» 으로 미루던 가드(`itemWidth === 0`)가 이 앞에 있었다. 정정 30 으로
  // 폭이 계산이 되면서 그 0 이 존재하지 않는다 — 첫 렌더부터 제자리다.
  useEffect(() => {
    const layerChanged = previousLayer.current !== layer
    previousLayer.current = layer

    // **층을 넘는 이동은 미끄러지지 않는다**(사용자 판정, 2026-08-13 — *"가계부 지출 → today 로
    // 이동할 때 너무 오래 걸린다"*). 두 행은 서로 다른 항목 집합이라 「지출」 자리와 「today」 자리
    // 사이에 이어지는 관계가 없다 — 그 미끄러짐은 거짓이고, 층이 바뀌는 사건은 행 교차가 이미
    // 말한다. 첫 배치도 같은 처리다(앱을 켜자마자 알약이 날아오면 안 된다).
    if (!settled.current || layerChanged) {
      settled.current = true
      x.setValue(pillX)
      return
    }

    Animated.timing(x, {
      toValue: pillX,
      duration: TRAVEL_MS,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }, [layer, pillX, x])

  useEffect(() => {
    Animated.timing(visual, {
      toValue: layer === 'sub' ? 1 : 0,
      duration: LAYER_MS,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }, [layer, visual])

  // **겹쳐서 섞지 않고, 비운 뒤 채운다**(fade-through). 두 행을 같은 구간에 함께 흐리면 항목 수가
  // 다른 두 줄(5 vs 2~3)이 반투명으로 포개져 **글자가 이중으로** 보인다.
  const groupOpacity = visual.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] })
  const subOpacity = visual.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] })
  const groupShift = visual.interpolate({ inputRange: [0, 1], outputRange: [0, -ROW_SHIFT] })
  // 하위 행은 «한 칸 옆» 이 제자리다. 들어올 때만 거기서 조금 더 오른쪽에서 온다.
  const subShift = visual.interpolate({
    inputRange: [0, 1],
    outputRange: [itemWidth + ROW_SHIFT, itemWidth],
  })
  // ← 는 전환의 **뒷절반에만** 존재한다 — 나갈 땐 먼저 비키고, 들어올 땐 자리가 다 생긴 뒤에 든다.
  // ← 는 **투명도가 아니라 마운트로** 나타나고 사라진다 ([[ADR-132]] 정정 26).
  //
  // 판이 `opacity: 0` 인 채로 마운트되면 iOS 가 그 `GlassView` 의 효과를 끄고, 뒤에 1 로 돌아와도
  // **되살리지 않는다.** 앱은 늘 그룹 행(← 없음)에서 시작하므로 매 실행마다 ← 만 재질을 잃었다 —
  // 콜드 재시작 실측: `opacity: 0` 출발이면 안 그려지고(들림 +0), `1` 로 두면 +34.3 이다.
  // 0.01 로 «0 만 피하는» 판도 안 통했다(마운트 시점에 **정확히 1** 이어야 한다).
  //
  // 그래서 `hasBack` 으로 마운트를 가른다. 잃는 것은 페이드고, 등장·퇴장은 `backScale` 이 진다.
  const backScale = visual.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.82, 0.82, 1] })
  const backShift = visual.interpolate({ inputRange: [0, 1], outputRange: [-ROW_SHIFT, 0] })

  // ── 이동 ─────────────────────────────────────────────────────────────────────
  // 등록한 핸들러가 옛 상태를 붙들지 않도록 최신 값을 ref 로 둔다. **쓰기는 렌더가 아니라
  // 이펙트에서** 한다 — 렌더 중 ref 쓰기는 `react-hooks/refs` 가 막고, 실제로도 렌더가 버려질 수
  // 있어 위험하다. 이펙트는 매 렌더 뒤에 도므로 사용자가 누를 시점엔 언제나 최신이다.
  const barRef = useRef(bar)
  useEffect(() => {
    barRef.current = bar
  })

  // 여기서 [[ADR-132]] 결정 9 의 광고 게이트를 태웠다(그래서 «무엇을 눌렀는가» 를 인자로 받았다).
  // [[ADR-150]] 이 전면광고를 걷으며 함께 지웠다 — 지금 이 함수가 하는 일은 이동뿐이다.
  const apply = useCallback(
    (next: BarState) => {
      const before = barRef.current

      setBarRecord(toBarRecord(next))
      if (next.page !== before.page) navigation.navigate(next.page)
    },
    [navigation],
  )

  const applyRef = useRef(apply)
  useEffect(() => {
    applyRef.current = apply
  })

  useEffect(() => {
    registerBarBackHandler({
      canGoBack: () => canGoBack(barRef.current),
      goBack: () => {
        applyRef.current(pressBack(barRef.current))
      },
    })

    return () => {
      registerBarBackHandler(null)
    }
  }, [])

  if (isKeyboardShown) return null

  return (
    <View
      testID="bottom-bar"
      style={{
        position: 'absolute',
        // **좌우 여백은 «남는 폭을 가른» 값이다**([[ADR-132]] 정정 30). 상한(420)에 안 걸리는
        // 기기에서는 그냥 14 이고, 걸리면 남는 폭이 좌우로 갈라져 바가 가운데 선다. `width` 대신
        // 좌우를 주는 이유는 전제를 한 곳에 모으기 위해서다 — 어차피 «부모가 창 전체» 를 전제로
        // 폭을 계산했고, 여기서도 같은 전제를 쓰면 둘이 어긋날 수 없다.
        left: metrics.sideMarginPx,
        right: metrics.sideMarginPx,
        bottom: bottomSafeAreaPx + BAR_LIFT,
        height: barHeight,
        flexDirection: 'row',
        alignItems: 'center',
        padding: BAR_PADDING,
        borderRadius: 999,
        // 유리일 때는 바탕을 `GlassView` 가 그린다 — 여기에 색을 주면 그 재질이 가려진다
        // (이전 판이 정확히 그 실수였다). 유리가 없는 쪽은 **불투명 캡슐**이고, 그쪽을 유리처럼
        // 흉내 내지 않는 것이 정정 29 다.
        backgroundColor: glass ? 'transparent' : colors.bar,
        // **페이지와 바를 가르는 것은 색이 아니라 이 선이다**(정정 12). 유리에서도 같은 선이
        // 가장자리를 잡아 준다 — Liquid Glass 자체의 하이라이트에 더해지는 얇은 테두리다.
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: glass ? colors.glassEdge : colors.edge,
        // **그림자는 «아주 약하게»**(사용자 지시). 예전 값(radius 22 · y 9 · 불투명도 1)은 떠 있음을
        // 넘어 «두껍다» 로 읽혔다. 유리가 이미 층을 만들어 주므로 그림자는 바닥에서 살짝 띄우는
        // 몫만 한다.
        // **약하되 «떠 있음» 은 남는 값**(사용자 지시 둘을 함께 만족). 예전 값(불투명도 1 · radius 22 ·
        // y 9)은 «두껍다» 였고, 0.18/10/3 까지 내렸더니 이번엔 **입체감이 사라졌다**. 그림자는 층을
        // 만드는 세 장치 중 하나일 뿐이라(나머지: 알약 자체 그림자 · 위쪽 광택) 혼자 다 지지 않는다.
        boxShadow: boxShadow(definition.shadowColor, BAR_SHADOW),
      }}
    >
      {glass ? (
        <GlassView
          testID="bar-glass"
          // **바는 `clear` 로 두지 않는다**(사용자 지시, 2026-08-13). 한 번 그렇게 해 봤더니 유리
          // 느낌은 세졌지만 바쁜 콘텐츠 위에서 **비활성 라벨 대비가 1.07** 까지 떨어졌다(실측).
          // 바는 글자를 얹는 판이라 투과를 올릴 자리가 아니다 — 층은 알약 쪽에서 만든다.
          glassEffectStyle="regular"
          // **OS 외형이 아니라 앱 테마를 따른다.** 기본값 `auto` 는 시스템 외형을 보는데, 이 앱은
          // 자체 테마를 쓴다 — 라이트 OS 에서 레테를 켜면 새까만 페이지 위에 밝은 유리판이 떴다
          // (사용자 판정, [[ADR-132]] 정정 19).
          colorScheme={definition.mode}
          tintColor={colors.glassTint}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
        />
      ) : null}

      {/* ── 활성 알약 ────────────────────────────────────────────────────────────
            유리일 때는 **알약도 유리다** — 바 위에 «조금 더 밝은 재질» 한 겹을 더 얹는다. 색으로
            칠한 판을 올리면 그 자리만 불투명해져 재질이 끊긴다(사용자 판정 — 알약 배경이 잘 안
            보인다고 했을 때, 답은 «더 진한 색» 이 아니라 «자기 재질» 이었다).

            그림자는 그 위에 얹혀 **층을 하나 더** 만든다. 유리끼리는 명도 차가 작아서 그림자가
            없으면 두 겹이 한 겹으로 읽힌다. */}
        <Animated.View
          testID="bar-pill"
          pointerEvents="none"
          style={{
            position: 'absolute',
            // 바 루트 기준이다 — 트랙 기준이 아니다(아래 «왜 트랙 밖인가»).
            top: BAR_PADDING,
            left: BAR_PADDING + trackInset,
            height: pillHeight,
            width: pillWidth,
            transform: [{ translateX: x }],
            borderRadius: 999,
            // **유리일 때 뒤판을 깔지 않는다.** 깔아 두면 `GlassView` 가 그 판을 배경으로 삼아
            // 뒤 콘텐츠 대신 그 색을 굴절시킨다 — 재질이 아니라 «흰 알약» 이 된다(사용자 판정,
            // 2026-08-13). 그림자 모양은 `borderRadius` 에서 나오므로 뒤판 없이도 둥글다.
            backgroundColor: glass ? 'transparent' : colors.pill,
            boxShadow: boxShadow(definition.shadowColor, PLATE_SHADOW),
          }}
        >
          {glass ? (
            <>
              <GlassView
                // 알약은 **`clear`** — 바(`regular`)보다 얇은 재질이라 뒤가 더 비친다(사용자 지시).
                // 바에는 쓰지 않는다: 글자를 얹는 판이라 투과를 올리면 비활성 라벨 대비가 무너진다(실측 1.07).
                glassEffectStyle="clear"
                colorScheme={definition.mode}
                tintColor={colors.pillOnGlass}
                style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
              />
              {/* 유리 위 유리는 경계가 흐려진다 — 헤어라인이 그 자리를 잡는다. */}
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: 999,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.glassEdge,
                  },
                ]}
              />
            </>
          ) : null}
        </Animated.View>

      {/* ## 왜 알약이 이 상자 «밖» 인가
          이 트랙은 `overflow: hidden` 이다 — 하위 행이 한 칸 옆으로 밀려 있어 그 넘침을 잘라야
          한다. 알약을 여기 두면 **그 클리핑에 그림자가 함께 잘린다**: 상자 높이가 알약 높이와 같아
          위아래 그림자가 통째로 없어지고, 좌우도 사각 경계로 깎여 «끝이 각진» 그림자가 된다
          (사용자 관찰, 2026-08-13). 그래서 알약은 바 루트가 갖고, 좌표만 패딩만큼 옮긴다. */}
      <View
        style={{
          flex: 1,
          height: pillHeight,
          marginHorizontal: trackInset,
          overflow: 'hidden',
        }}
      >
        {/* 두 층이 **같은 자리에 겹쳐** 있다가 교차한다. 하나만 마운트하면 «갈아 끼우기» 가 된다. */}
        <Animated.View
          aria-hidden={layer !== 'group'}
          pointerEvents={layer === 'group' ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: pillHeight,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: groupOpacity,
            transform: [{ translateX: groupShift }],
          }}
        >
          {groupItems.map((item) => (
            <BarItem
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={item.active}
              accent={colors.accent}
              muted={colors.muted}
              width={itemWidth}
              height={pillHeight}
              testID={`bar-group-${item.key}`}
              onPress={() => {
                applyRef.current(pressGroup(barRef.current, item.key))
              }}
            />
          ))}
        </Animated.View>

        <Animated.View
          aria-hidden={layer !== 'sub'}
          pointerEvents={layer === 'sub' ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: pillHeight,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: subOpacity,
            transform: [{ translateX: subShift }],
          }}
        >
          {subItems.map((item) => (
            <BarItem
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={item.active}
              accent={colors.accent}
              muted={colors.muted}
              width={itemWidth}
              height={pillHeight}
              testID={`bar-sub-${item.key}`}
              onPress={() => {
                applyRef.current(pressSub(barRef.current, item.key))
              }}
            />
          ))}
        </Animated.View>
      </View>

      {/* ── ← 는 **맨 위에서 제자리 페이드**한다 ────────────────────────────────────────
          처음에는 폭이 0 으로 줄어드는 상자 안에 넣어 뒀는데, 그러면 두 가지가 동시에 일어난다:
          `overflow: hidden` 이 화살표를 **오른쪽부터 잘라 먹고**, 트리에서 먼저 그려지므로 밀려
          들어오는 1차 행이 그 위를 **덮는다**. 둘이 합쳐져 «2차 바가 1차 바 뒤에 있다» 로 읽혔다
          (사용자 관찰, 2026-08-13).

          그래서 자리(레이아웃)와 그림(버튼)을 갈랐다 — 자리는 위쪽 스페이서가 잡고, 버튼은 여기
          맨 끝에서 절대 배치로 **아무것에도 안 가린 채** 사라진다. 그리고 **먼저** 사라진다:
          불투명도가 전환의 45% 지점에서 이미 0 이라, 1차 행이 그 자리에 도착할 때는 남아 있는
          것이 없다. 나타날 때는 반대로 45% 를 지나서야 든다. */}
      {/* ## 판은 «알약 옆» 에 둔다 — `Pressable` 안이 아니라

          여기 `GlassView` 를 `Pressable` **안**에 두었더니 **재질이 아예 안 그려졌다**. 코드는
          알약과 한 글자도 다르지 않았고(런타임 props 까지 동일: `clear` · 같은 tint · 같은 style),
          opacity · transform · 크기 · 위치를 하나씩 배제해도 그대로였다. 빨간 tint 를 강제로 넣어도
          원 안이 반응하지 않아 «렌더 자체가 없다» 가 확정됐다(실측 RGB (34,29,33) — 바보다 어둡다.
          보이던 얇은 링은 유리가 아니라 헤어라인이었다).

          남은 차이가 **트리에서의 자리** 하나였다. 알약은 바 루트의 직계 자식이고 ← 판만 두 겹
          안쪽(`Animated.View` → `Pressable` → `View`)에 있었다. 그래서 판을 꺼내 **알약과 같은
          층**에 놓고, `Pressable` 은 그 위에 투명한 과녁으로만 남긴다([[ADR-132]] 정정 21). */}
      {hasBack ? (
      <Animated.View
        testID="bar-back-plate"
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: backCircleMargin,
          top: BAR_PADDING + (pillHeight - backCircle) / 2,
          width: backCircle,
          height: backCircle,
          borderRadius: 999,
          transform: [{ translateX: backShift }, { scale: backScale }],
          backgroundColor: glass ? 'transparent' : colors.pill,
          boxShadow: boxShadow(definition.shadowColor, PLATE_SHADOW),
        }}
      >
        {glass ? (
          <>
            <GlassView
              glassEffectStyle="clear"
              colorScheme={definition.mode}
              tintColor={colors.pillOnGlass}
              style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: 999,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.glassEdge,
                },
              ]}
            />
          </>
        ) : null}
      </Animated.View>
      ) : null}

      {hasBack ? (
      <Animated.View
        pointerEvents={hasBack ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          left: backCircleMargin,
          top: BAR_PADDING,
          transform: [{ translateX: backShift }, { scale: backScale }],
        }}
      >
        <Pressable
          testID="bar-back"
          aria-hidden={!hasBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          disabled={!hasBack}
          onPress={() => {
            applyRef.current(pressBack(barRef.current))
          }}
          // 누르는 자리는 **한 칸 전체**로 남긴다 — 메뉴 항목과 같은 크기의 과녁이라야 손이 같은
          // 규칙으로 움직인다. 다만 화살표는 그 칸의 가운데가 아니라 **왼쪽 끝**의 판 위에 앉는다.
          style={{
            width: itemWidth,
            height: pillHeight,
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: backCircle,
              height: backCircle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeftIcon
              className="h-[25px] w-[25px]"
              color={colors.muted}
              strokeWidth={ICON_STROKE}
            />
          </View>
        </Pressable>
      </Animated.View>
      ) : null}
    </View>
  )
}
