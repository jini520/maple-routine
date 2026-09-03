/**
 * 떠 있는 캡슐 하단바. 층 판정과 기록 규칙은 `bar-model.ts` 가 갖고 여기는 그리기와 배선만 하는 뷰.
 *
 * 지키는 것 셋.
 *
 * ① 루트가 `position: absolute` 다. flex 자식으로 두면 화면 높이를 그만큼 먹는다.
 * ② 치수는 창 폭에서 계산한다(`lib/bottom-bar-metrics.ts`). 재면 첫 프레임이 0 이라 알약이 접힌다.
 * ③ 유리(`expo-glass-effect`)는 iOS 26 이상뿐이다. 그 아래와 안드로이드는 흉내 내지 않고 색만
 *    맞춘다(`bar-colors.ts` 의 `neutralPlate`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'

import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  CalendarIcon,
  GearIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ProfitIcon,
  SlidersHorizontalIcon,
  SwordsIcon,
  Text,
  WalletIcon,
  WrenchIcon,
} from '../components/atoms'
import { BAR_LIFT, resolveBottomBarMetrics } from '../lib/bottom-bar-metrics'
import { useBottomSafeAreaPx } from '../lib/safe-area'
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
  layerOfPage,
  rememberSub,
  visibleSubs,
  type BarIntent,
  type BarState,
  type GroupId,
} from './bar-model'
import { setLastSub, useLastSub } from './bar-store'
import { useKeyboardShown } from './use-keyboard-shown'
import type { LayerRouteName, TabRouteName } from './routes'

/**
 * 바가 아는 이동은 둘뿐이다.
 *
 * 층 화면 이름과 중첩 파라미터의 모양은 `Main` 에서 끝난다. 바가 내비게이션 구조를 직접 알면
 * 구조를 바꿀 때마다 바가 함께 움직인다.
 */
export interface BarNavigation {
  /** 그 층 화면으로 가며 안쪽 페이지를 지정한다. 스택에 없으면 한 단 쌓이고, 있으면 그리로 돌아간다. */
  openLayer(layer: LayerRouteName, page: TabRouteName): void
  /** 한 단 올라간다. 가장자리 스와이프가 만드는 것과 같은 결과다. */
  goBack(): void
}

export interface BottomBarProps {
  /** react-navigation 이 알려 주는 지금 화면(`current-page.ts`). 바는 사본을 들지 않는다. */
  page: TabRouteName
  navigation: BarNavigation
}

/** 치수. `design-system.md` 하단바 표와 같은 값이어야 한다. */
/**
 * 알약이 칸보다 넓은 정도. 이 값 하나가 나머지 셋을 정한다.
 *
 * 요구가 셋이고 서로 묶여 있어 값을 따로 고를 수 없다. ① 항목 간 간격을 줄인다 ② 알약은
 * 칸 경계를 넘어도 된다 ③ 끝 칸에서 알약이 바 가장자리로부터 위아래와 같은 여백을 남긴다.
 *
 * ```
 * 칸  S = (바폭 − 패딩×2 − O) ÷ 항목수      ← O 가 클수록 칸이 좁아진다(= 간격이 준다)
 * 알약 W = S + O
 * 들여 T = 패딩 + O ÷ 2                     ← 끝 칸 알약이 정확히 패딩 만큼 남기는 자리
 * ```
 *
 * 402pt 기기에서 O=23 이면 칸 69 · 알약 92 · 들여쓰기 14.5 이고 양 끝 여백이 위아래와 같은 3 이다.
 * 세 값을 손으로 적어 두면 기기 폭이 바뀌는 순간 균형이 깨지므로 상수는 이것 하나다.
 */
const PILL_OVERHANG = 23
/**
 * 바 안쪽 여백. 레퍼런스 두 장에서 활성 알약 높이 ÷ 바 높이 가 0.89 이고, 그 차이가 곧 이
 * 여백이다. 좁힐수록 알약이 바를 꽉 채워 항목이 바 안에 떠 있는 느낌이 사라진다.
 *
 * 바 높이가 기기마다 달라져도 이 값은 상수다. 여백은 판 둘레의 선이라 판이 커진다고 함께
 * 커질 이유가 없고, 커지면 그 비율이 작은 기기에서 먼저 무너진다.
 */
const BAR_PADDING = 3
/**
 * ← 원이 알약 높이에서 차지하는 비율. 402pt 기기의 48 / 66 이다.
 *
 * 고정 48 로 두면 하한(높이 64 · 알약 58)에서 원이 알약을 거의 채우고 태블릿(81 · 알약 75)
 * 에서는 점이 된다. 비율로 두면 402pt 에서 값이 48 그대로다.
 *
 * 원이 차지하는 폭은 이것이 아니라 한 칸(`itemWidth`)이다. 위치와 너비를 메뉴 하나와 같게
 * 두어야 ← 도 이 바의 항목 하나로 읽히고, 하위 행이 둘째 칸에서 시작해 그룹 행의 격자와
 * 어긋나지 않는다.
 */
const BACK_CIRCLE_RATIO = 48 / 66
/**
 * 알약이 같은 층 안에서 미끄러지는 시간. 화면이 통째로 밀려 들어오는 전환값(340ms)은
 * 70~145pt 를 움직이는 작은 판에 길다.
 */
const TRAVEL_MS = 240

/**
 * 그림자 한 겹. 불투명도 · 반경 · 아래로 민 거리.
 *
 * `shadowOpacity` 라는 이름이 남은 것은 그 값이 테마 `shadowColor` 의 알파(`59` = 0.35)와
 * 곱해지는 자리이기 때문이다. 0.65 는 과한 값이 아니라 실효 0.23 이다.
 */
interface ShadowLayer {
  readonly opacity: number
  readonly radius: number
  readonly y: number
}

/**
 * `shadow*` → `boxShadow` 번역기.
 *
 * `shadowOpacity`·`shadowRadius`·`shadowOffset` 은 iOS 전용 프롭이라 그것으로 맞춘 층은
 * 안드로이드에 하나도 도달하지 않는다. 거기서는 `elevation` 의 기본 그림자가 바·알약·← 셋을
 * 같은 세기로 그린다. `boxShadow` 는 RN 0.76+ 가 양 플랫폼에 같은 그림자를 그리는 자리다
 * (안드로이드는 새 아키텍처 전용. 이 앱은 `newArchEnabled=true`).
 *
 * 옮기면서 두 값이 번역된다. 그대로 옮기면 다른 그림자가 된다.
 *
 * - 블러는 두 배다. `boxShadow` 의 반경은 CSS 정의이고 RN 의 iOS 구현이 그것을
 *   `shadowRadius = blurRadius / 2` 로 되돌린다(`RCTBoxShadow.mm`). 그래서 여기서 ×2 로 낸다.
 * - 알파는 미리 곱한다. iOS 는 `shadowColor` 의 알파와 `shadowOpacity` 를 곱하는데
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

/** 바 자신의 그림자. 아주 약하게. 층은 알약 쪽에서 만든다. */
const BAR_SHADOW: ShadowLayer = { opacity: 0.22, radius: 14, y: 5 }

/**
 * 활성 알약과 ← 가 공유하는 층 그림자.
 *
 * 둘은 바 위에 한 겹 떠 있는 판 이라는 같은 물건이라 같은 값을 쓴다. 값을 각자 적어 두면
 * 한쪽만 손볼 때 조용히 갈린다.
 *
 * 값이 큰 것은 과해서가 아니라 두 번 깎이기 때문이다. 테마의 `shadowColor` 알파(0.35)와
 * 곱해져 실효 0.23 이다. 0.26(실효 0.09)이면 라이트에서 층이 아예 안 보인다.
 */
const PLATE_SHADOW: ShadowLayer = { opacity: 0.65, radius: 10, y: 3 }
/** 층 전환(페이드·← 열림). 알약보다 조금 짧아 알약이 마지막에 자리를 잡는다. */
const LAYER_MS = 280
/** 들어오는 행이 오른쪽에서 밀려 들어오는 거리. 크면 날아온다 가 되어 층 관계가 흐려진다. */
const ROW_SHIFT = 10
/** 앱이 이미 쓰는 스택 전환 커브와 같은 가족. */
const EASE = Easing.bezier(0.32, 0.72, 0, 1)

/**
 * 아이콘 선 굵기.
 *
 * 크기·간격·라벨은 클래스에 박혀 있는데 이것만 상수인 것은 `strokeWidth` 가 className 이
 * 아니라 프롭이기 때문이다. 항목 아이콘과 ← 가 같은 값을 써야 해서 이름을 준다.
 */
const ICON_STROKE = 1.5
/**
 * 활성인데 채울 수 없는 그림의 획 굵기.
 *
 * 채우기가 통하는 다섯(대시보드·렌치·장바구니·톱니·수익)은 면으로 활성을 말한다. 나머지
 * (달력·지갑·목록·검·조준경)는 안쪽 선이 의미를 져서 채울 수 없으므로 굵기로 말한다. 둘을
 * 같이 주면 채운 그림이 과해지므로 배타다. `activeStroke` 가 그것을 한 자리에서 고른다.
 *
 * 안쪽에 선이 많은 그림일수록 굵은 획이 칸을 메워 형태가 뭉갠다. 값이 전 탭 공통인 것은
 * 자리마다 다르면 같은 바 안에서 활성의 무게가 갈리기 때문이다.
 */
const ICON_STROKE_ACTIVE = 2.2

type IconComponent = React.ComponentType<{
  className?: string
  color?: string
  fill?: string
  strokeWidth?: number
}>

/**
 * 그룹·하위가 쓰는 아이콘.
 *
 * 컨텐츠·보스·설정과 보스 수익은 앱이 이미 쓰던 그림 그대로다(보스 수익은 커스텀
 * `ProfitIcon`. 도메인 아이덴티티를 임의의 lucide 로 대체하지 않는다).
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
  // 검(보스)·목록(컨텐츠)과 겹치지 않으면서 값을 맞추는 자리 를 말하는 그림이다.
  BossManage: SlidersHorizontalIcon,
  Profit: ProfitIcon,
  // 가계부 = 장부. 달력 계열(`CalendarCheck` = 스케줄러 그룹)과 겹치지 않게 골랐다.
  Cashbook: CalendarIcon,
  Utility: WrenchIcon,
  Settings: GearIcon,
}

/**
 * 활성일 때 면으로 채우는 아이콘. 나머지는 선 그대로 둔다.
 *
 * 채우기가 통하는 것은 안쪽에 의미가 없는 그림뿐이다. fill 과 stroke 가 같은 색이라 안쪽에
 * 선이 있는 아이콘은 채우는 순간 그 선이 통째로 사라진다.
 *
 * 살아남는 것은 대시보드(사각 넷) · 렌치(실루엣 하나) · 검(칼날이 면으로 차고 손잡이 선은
 * 남는다). 무너지는 것은 톱니(가운데 구멍이 메워진다) · 달력·지갑(안쪽 체크·주머니를 잃는다) ·
 * 목록·장부(선뿐이라 채울 면이 없다) · 수익(`ProfitIcon` 은 열린 호로 그린 커스텀이라
 * `fill="none"` 이 규격이다).
 *
 * 아이콘 컴포넌트로 잡는 이유는 같은 그림이 두 자리에 쓰이기 때문이다(today 는 그룹과 페이지,
 * 렌치는 유틸리티 그룹과 페이지). 라우트 키로 잡으면 한쪽만 채워지는 사고가 난다.
 */
const FILLED_ICONS: ReadonlySet<IconComponent> = new Set([
  LayoutDashboardIcon,
  WrenchIcon,
  SwordsIcon,
  // 아래 둘은 우리가 그린 아이콘이라 **채울 자리를 고를 수 있다**. 수익은 동전 두 개만 면이
  // 되고 단을 그리는 호는 선으로 남으며, 톱니는 몸통만 차고 가운데가 구멍으로 남는다.
  ProfitIcon,
  GearIcon,
])

/** 활성 아이콘이 쓸 `fill`. 채우지 않는 그림은 `none` 그대로다. */
function activeFill(Icon: IconComponent, active: boolean, accent: string): string {
  return active && FILLED_ICONS.has(Icon) ? accent : 'none'
}

/** 채우지 못하는 그림만 활성일 때 굵어진다. 채우는 그림은 기본 굵기 그대로다(배타). */
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
   * 비활성 색. `text-muted` 가 아니라 **채도를 뺀** 값이다(`bar-colors.ts` 의 `muted`).
   *
   * 바 안에서 색을 지는 자리는 활성 하나다. 클래스(`text-text-muted`)로 두면 레테처럼 `textMuted`
   * 자체가 연보라인 테마에서 비활성까지 같은 색 계열로 읽힌다.
   */
  muted: string
  /** 층과 무관하게 같은 값이다. 그룹 다섯이 꽉 찼을 때의 칸 폭(`BottomBar` 의 `itemWidth`). */
  width: number
  /**
   * 알약 높이 = 바 높이 − 여백×2. 상수가 아니라 프롭인 것은 바 세로가 기기 폭에서 나오기
   * 때문이다. 이 항목의 과녁도 함께 자란다(글리프는 안 자란다).
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
            내려가므로, **읽힐 때까지 민** 값을 `bar-colors.ts` 가 계산해 준다. */}
        <Icon
          className="h-[25px] w-[25px]"
          color={active ? accent : muted}
          fill={activeFill(Icon, active, accent)}
          strokeWidth={activeStroke(Icon, active)}
        />
        <Text
          fixed
          numberOfLines={1}
          // `includeFontPadding` 은 안드로이드에서만 읽히는 값이고, 기본(참)일 때 글자 상자에
          // 폰트 메트릭 여백을 더해 iOS 보다 큰 상자를 만든다. 실측으로 아이콘→라벨이 27 → 30px
          // 이 되고 블록이 5px 자라 아이콘이 3px 위로 밀린다. iOS 는 이 값을 무시한다.
          style={{ color: active ? accent : muted, includeFontPadding: false }}
          className="text-[10.5px] font-normal tracking-[-0.01em]"
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

export function BottomBar({ page, navigation }: BottomBarProps): React.JSX.Element | null {
  // 인셋이 아니라 하한이 깔린 값이다. 들어올림이 0 이라 이 값이 곧 캡슐이 바닥에서 뜨는 높이이고,
  // 안드로이드 제스처 기기(15)에서는 그것이 iOS 의 절반도 안 된다. 콘텐츠가 남기는 몫
  // (`ScreenScroll`)과 토스트도 같은 함수를 본다.
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const { definition } = useThemeAppearance()
  const lastSub = useLastSub()
  const isKeyboardShown = useKeyboardShown()
  // 바의 세로는 창 폭에서 나온다. 콘텐츠가 남기는 몫도 같은 함수를 보므로
  // (`ScreenScroll` → `bottom-inset.ts`) 두 값이 어긋날 자리가 없다.
  const { width: windowWidth } = useWindowDimensions()
  const metrics = resolveBottomBarMetrics(windowWidth)
  const barHeight = metrics.heightPx
  /** 바 높이에서 위아래 여백을 뺀 값. 둘은 함께 움직인다. 따로 두면 알약이 바 안에서 떠 버린다. */
  const pillHeight = barHeight - BAR_PADDING * 2
  const backCircle = Math.round(pillHeight * BACK_CIRCLE_RATIO)

  const bar: BarState = useMemo(() => ({ page, lastSub }), [page, lastSub])

  const colors = resolveBarColors(definition)
  // iOS 26 이상에서만 Liquid Glass 가 있다. 그 밖(안드로이드 · iOS 26 미만)은 블러 재질이고,
  // 재질이 아예 없는 불투명 캡슐로 떨어지지는 않는다.
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

  // 재는 것이 하나도 없다. 바 폭이 창 폭의 함수라 계산으로 나오고, 계산은 첫 프레임부터 맞다
  // (측정은 첫 프레임에 0 이라 알약이 한 프레임 접힌다). 트랙 폭은 애니메이션이 바꾸는 값이라
  // 그것으로 `itemWidth` 를 정하면 애니메이션 → 측정 → `itemWidth` → 애니메이션 고리가 돈다.
  //
  // 그래서 폭을 움직이는 애니메이션이 하나도 없다. ← 자리는 상자를 넓히는 대신 행을 한 칸
  // 옆으로 옮겨 만든다. 이동·불투명도·크기는 전부 네이티브 드라이버가 나를 수 있어, 탭 직후
  // 화면 마운트로 JS 가 막혀도 전환이 끝까지 매끄럽다.
  const itemWidth = (metrics.widthPx - BAR_PADDING * 2 - PILL_OVERHANG) / BAR_GROUPS.length
  /** 항목 영역을 바 안쪽에서 들여쓰는 양. 끝 칸 알약이 `BAR_PADDING` 만큼만 남기게 하는 값. */
  const trackInset = PILL_OVERHANG / 2
  /**
   * ← 원이 바 가장자리에서 남기는 여백. 위아래와 같은 값이다.
   *
   * 원은 알약 높이의 행 안에서 세로 가운데라 위아래로 `패딩 + (행 − 원)/2` 만큼 남는다.
   * 가로도 그 값이어야 사방이 같은 원이 된다. 다른 항목은 이 값과 무관하다. ← 는 절대
   * 배치라 하위 행의 자리를 밀지 않는다.
   */
  const backCircleMargin = BAR_PADDING + (pillHeight - backCircle) / 2
  const pillWidth = itemWidth + PILL_OVERHANG
  /** 행이 시작하는 칸. 하위 행은 ← 가 차지한 첫 칸 다음이고 격자는 그룹 행과 같다. */
  const rowOffset = layer === 'sub' ? itemWidth : 0
  const pillX = rowOffset + activeIndex * itemWidth + (itemWidth - pillWidth) / 2

  // `useRef(new Animated.Value(…)).current` 가 아니라 **lazy `useState`** 다. 값이 마운트 동안
  // 고정이라는 뜻은 같은데, 그쪽은 **렌더 중 ref 읽기** 라 `react-hooks/refs` 가 막는다.
  const [x] = useState(() => new Animated.Value(0))
  /** 0 = 그룹 행 · 1 = 하위 행. **전부 네이티브 드라이버다**. 레이아웃 값을 하나도 안 건드린다. */
  const [visual] = useState(() => new Animated.Value(layer === 'sub' ? 1 : 0))
  const settled = useRef(false)
  const previousLayer = useRef(layer)

  useEffect(() => {
    const layerChanged = previousLayer.current !== layer
    previousLayer.current = layer

    // 층을 넘는 이동은 미끄러지지 않는다. 두 행은 서로 다른 항목 집합이라 두 자리 사이에
    // 이어지는 관계가 없다. 층이 바뀌는 사건은 행 교차가 이미 말한다. 첫 배치도 같은 처리다.
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

  // 겹쳐서 섞지 않고 비운 뒤 채운다(fade-through). 두 행을 같은 구간에 함께 흐리면 항목 수가
  // 다른 두 줄(5 대 2~3)이 반투명으로 포개져 글자가 이중으로 보인다.
  const groupOpacity = visual.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] })
  const subOpacity = visual.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] })
  const groupShift = visual.interpolate({ inputRange: [0, 1], outputRange: [0, -ROW_SHIFT] })
  // 하위 행은 **한 칸 옆** 이 제자리다. 들어올 때만 거기서 조금 더 오른쪽에서 온다.
  const subShift = visual.interpolate({
    inputRange: [0, 1],
    outputRange: [itemWidth + ROW_SHIFT, itemWidth],
  })
  // ← 는 전환의 뒷절반에만 존재한다. 나갈 땐 먼저 비키고 들어올 땐 자리가 다 생긴 뒤에 든다.
  // 투명도가 아니라 마운트로 나타나고 사라진다.
  //
  // 판이 `opacity: 0` 인 채로 마운트되면 iOS 가 그 `GlassView` 의 효과를 끄고 뒤에 1 로
  // 돌아와도 되살리지 않는다. 0.01 로 0 만 피하는 것도 안 통한다(마운트 시점에 정확히 1
  // 이어야 한다). 그래서 `hasBack` 으로 마운트를 가른다. 등장·퇴장은 `backScale` 이 진다.
  const backScale = visual.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.82, 0.82, 1] })
  const backShift = visual.interpolate({ inputRange: [0, 1], outputRange: [-ROW_SHIFT, 0] })

  // 등록한 핸들러가 옛 상태를 붙들지 않도록 최신 값을 ref 로 둔다. 쓰기는 렌더가 아니라
  // 이펙트에서 한다. 렌더 중 ref 쓰기는 `react-hooks/refs` 가 막고 렌더가 버려질 수도 있다.
  const barRef = useRef(bar)
  useEffect(() => {
    barRef.current = bar
  })

  // 상태가 아니라 지시를 받는다. 층은 스택이 들고 여기가 드는 것은 다시 들어갈 자리(`lastSub`)
  // 하나다.
  const apply = useCallback(
    (intent: BarIntent) => {
      switch (intent.kind) {
        case 'openSubs':
          setLastSub(rememberSub(getLastSubOf(barRef.current), intent.page))
          navigation.openLayer(intent.layer, intent.page)
          return
        case 'switchSub':
          setLastSub(rememberSub(getLastSubOf(barRef.current), intent.page))
          // 같은 단 안의 옆걸음이다. 그 층 화면은 이미 맨 위이므로 스택이 자라지 않는다.
          navigation.openLayer(layerOfPage(intent.page), intent.page)
          return
        case 'switchGroupPage':
          // 하위 행에서 눌렀다면 그룹 층이 아래 단이라 **올라가면서** 옆걸음한다(이동 한 번).
          navigation.openLayer('Groups', intent.page)
          return
        case 'back':
          navigation.goBack()
          return
        case 'none':
          return
      }
    },
    [navigation],
  )

  const applyRef = useRef(apply)
  useEffect(() => {
    applyRef.current = apply
  })

  if (isKeyboardShown) return null

  return (
    <View
      testID="bottom-bar"
      style={{
        position: 'absolute',
        // 좌우 여백은 남는 폭을 가른 값이다. 상한(420)에 안 걸리는 기기에서는 그냥 14 이고,
        // 걸리면 남는 폭이 좌우로 갈라져 바가 가운데 선다. `width` 대신 좌우를 주는 것은 부모가
        // 창 전체를 전제로 폭을 계산했기 때문이다. 같은 전제를 쓰면 둘이 어긋날 수 없다.
        left: metrics.sideMarginPx,
        right: metrics.sideMarginPx,
        bottom: bottomSafeAreaPx + BAR_LIFT,
        height: barHeight,
        flexDirection: 'row',
        alignItems: 'center',
        padding: BAR_PADDING,
        borderRadius: 999,
        // 유리일 때는 바탕을 `GlassView` 가 그린다. 여기에 색을 주면 그 재질이 가려진다.
        // 유리가 없는 쪽은 불투명 캡슐이고 유리를 흉내 내지 않는다.
        backgroundColor: glass ? 'transparent' : colors.bar,
        // 페이지와 바를 가르는 것은 색이 아니라 이 선이다. 유리에서도 같은 선이 가장자리를 잡는다.
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: glass ? colors.glassEdge : colors.edge,
        // 그림자는 약하되 떠 있음은 남는 값이다. 불투명도 1 · radius 22 · y 9 는 두껍게 읽혔고,
        // 0.18/10/3 은 입체감이 사라졌다. 층을 만드는 장치가 셋이라(그림자 · 알약 자체 그림자 ·
        // 위쪽 광택) 그림자 혼자 다 지지 않는다.
        boxShadow: boxShadow(definition.shadowColor, BAR_SHADOW),
      }}
    >
      {glass ? (
        <GlassView
          testID="bar-glass"
          // 바는 `clear` 로 두지 않는다. 유리 느낌은 세지지만 바쁜 콘텐츠 위에서 비활성 라벨
          // 대비가 1.07 까지 떨어진다(실측). 바는 글자를 얹는 판이고 층은 알약 쪽에서 만든다.
          glassEffectStyle="regular"
          // OS 외형이 아니라 앱 테마를 따른다. 기본값 `auto` 는 시스템 외형을 보는데 이 앱은
          // 자체 테마를 쓴다. 라이트 OS 에서 다크 테마를 켜면 새까만 페이지 위에 밝은 유리판이 뜬다.
          colorScheme={definition.mode}
          tintColor={colors.glassTint}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
        />
      ) : null}

      {/* 활성 알약. 유리일 때는 알약도 유리다. 바 위에 조금 더 밝은 재질 한 겹을 더 얹는다.
          색으로 칠한 판을 올리면 그 자리만 불투명해져 재질이 끊긴다.

          그림자가 그 위에 얹혀 층을 하나 더 만든다. 유리끼리는 명도 차가 작아 그림자가
          없으면 두 겹이 한 겹으로 읽힌다. */}
        <Animated.View
          testID="bar-pill"
          pointerEvents="none"
          style={{
            position: 'absolute',
            // 바 루트 기준이다. 트랙 기준이 아니다(아래 **왜 트랙 밖인가**).
            top: BAR_PADDING,
            left: BAR_PADDING + trackInset,
            height: pillHeight,
            width: pillWidth,
            transform: [{ translateX: x }],
            borderRadius: 999,
            // 유리일 때 뒤판을 깔지 않는다. 깔면 `GlassView` 가 그 판을 배경으로 삼아 뒤 콘텐츠
            // 대신 그 색을 굴절시켜 재질이 아니라 흰 알약이 된다. 그림자 모양은 `borderRadius`
            // 에서 나오므로 뒤판 없이도 둥글다.
            backgroundColor: glass ? 'transparent' : colors.pill,
            boxShadow: boxShadow(definition.shadowColor, PLATE_SHADOW),
          }}
        >
          {glass ? (
            <>
              <GlassView
                // 알약은 `clear`. 바(`regular`)보다 얇은 재질이라 뒤가 더 비친다. 바에는 쓰지
                // 않는다. 글자를 얹는 판이라 투과를 올리면 비활성 라벨 대비가 무너진다(실측 1.07).
                glassEffectStyle="clear"
                colorScheme={definition.mode}
                tintColor={colors.pillOnGlass}
                style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
              />
              {/* 유리 위 유리는 경계가 흐려진다. 헤어라인이 그 자리를 잡는다. */}
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

      {/* 알약이 이 트랙 밖인 이유. 트랙은 `overflow: hidden` 이라(하위 행이 한 칸 옆으로 밀려 그
          넘침을 잘라야 한다) 알약을 여기 두면 그림자가 함께 잘린다. 상자 높이가 알약 높이와
          같아 위아래 그림자가 통째로 없어지고 좌우도 사각 경계로 깎인다. 알약은 바 루트가
          갖고 좌표만 패딩만큼 옮긴다. */}
      <View
        style={{
          flex: 1,
          height: pillHeight,
          marginHorizontal: trackInset,
          overflow: 'hidden',
        }}
      >
        {/* 두 층이 **같은 자리에 겹쳐** 있다가 교차한다. 하나만 마운트하면 **갈아 끼우기** 가 된다. */}
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

      {/* ← 는 맨 위에서 제자리 페이드한다. 자리는 위쪽 스페이서가 잡고 버튼은 여기 맨 끝에서
          절대 배치다. 폭이 0 으로 줄어드는 상자에 넣으면 `overflow: hidden` 이 화살표를
          오른쪽부터 자르고, 트리에서 먼저 그려져 밀려 들어오는 1차 행이 그 위를 덮는다.

          먼저 사라진다. 불투명도가 전환의 45% 지점에서 이미 0 이라 1차 행이 그 자리에
          도착할 때 남아 있는 것이 없다. 나타날 때는 반대로 45% 를 지나서야 든다. */}
      {/* ← 판은 알약 옆, `Pressable` 밖이다. 안에 두면 재질이 아예 안 그려진다. 알약은 바 루트의
          직계 자식인데 판만 두 겹 안쪽(`Animated.View` → `Pressable` → `View`)이면 `GlassView` 의
          렌더 자체가 없어진다. `Pressable` 은 그 위에 투명한 과녁으로만 남는다. */}
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
          // 누르는 자리는 **한 칸 전체**로 남긴다. 메뉴 항목과 같은 크기의 과녁이라야 손이 같은
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

/** `apply` 가 최신 `lastSub` 를 ref 에서 꺼내는 한 줄. 옛 값을 붙들면 기억이 한 번씩 밀린다. */
function getLastSubOf(bar: BarState): BarState['lastSub'] {
  return bar.lastSub
}
