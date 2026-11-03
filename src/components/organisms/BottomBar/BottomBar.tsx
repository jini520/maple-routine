/**
 * 떠 있는 캡슐 하단바. 층 판정과 기록 규칙은 `bar-groups.ts` 가 갖고 여기는 그리기와 배선만 하는 뷰.
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

import { useBarOrderStore } from '../../../features/bar-order/store'
import { useKeyboardShown } from '../../../hooks/useKeyboardShown'
import { tapFeedback } from '../../../native/haptics'
import { scrollPageToTop } from '../../../navigation/scroll-to-top'
import { isSecondTap, type TapRecord } from './double-tap'
import { BAR_LIFT, resolveBottomBarMetrics } from '../../../lib/bottom-bar-metrics'
import { useBottomSafeAreaPx } from '../../../lib/safe-area'
import { boxShadowOf } from '../../../lib/shadow'
import { useThemeAppearance } from '../../../theme/context'
import { resolveBarColors } from './bar-colors'
import { BarBackGlyph, BarGlyph } from './BarGlyph'
import { BACK_CIRCLE_RATIO, BAR_PADDING, BAR_SHADOW, PILL_OVERHANG, PLATE_SHADOW } from './bar-shape'
import {
  BAR_GROUPS,
  barLayer,
  canGoBack,
  groupById,
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
} from '../../../navigation/bar-groups'
import { setLastSub, useLastSub } from './bar-store'
import type { LayerRouteName, TabRouteName } from '../../../navigation/routes'

/**
 * 바가 아는 이동은 둘뿐이다.
 *
 * 층 화면 이름과 중첩 파라미터의 모양은 `LayerStack` 에서 끝난다. 바가 내비게이션 구조를 직접 알면
 * 구조를 바꿀 때마다 바가 함께 움직인다.
 */
export interface BarNavigation {
  /** 그 층 화면으로 가며 안쪽 페이지를 지정하는 이동. 스택에 없으면 한 단 쌓이고, 있으면 그리로 돌아간다. */
  openLayer(layer: LayerRouteName, page: TabRouteName): void
  /** 한 단 올라가는 이동. 가장자리 스와이프가 만드는 것과 같은 결과다. */
  goBack(): void
}

export interface BottomBarProps {
  /** react-navigation 이 알려 주는 지금 화면(`page-from-layer-state.ts`). 바는 사본을 들지 않는다. */
  page: TabRouteName
  navigation: BarNavigation
}

/**
 * 알약이 같은 층 안에서 미끄러지는 시간. 화면이 통째로 밀려 들어오는 전환값(340ms)은
 * 70~145pt 를 움직이는 작은 판에 길다.
 */
const TRAVEL_MS = 240

/** 층 전환(페이드·← 열림). 알약보다 조금 짧아 알약이 마지막에 자리를 잡는다. */
const LAYER_MS = 280
/** 들어오는 행이 오른쪽에서 밀려 들어오는 거리. 크면 날아온다 가 되어 층 관계가 흐려진다. */
const ROW_SHIFT = 10
/** 앱이 이미 쓰는 스택 전환 커브와 같은 가족. */
const EASE = Easing.bezier(0.32, 0.72, 0, 1)

interface BarItemProps {
  id: GroupId | TabRouteName
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
  id,
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
      <BarGlyph id={id} label={label} active={active} accent={accent} muted={muted} />
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
  const order = useBarOrderStore((state) => state.order)
  const isKeyboardShown = useKeyboardShown()
  // 바의 세로는 창 폭에서 나온다. 콘텐츠가 남기는 몫도 같은 함수를 보므로
  // (`ScreenScroll` → `bottom-inset.ts`) 두 값이 어긋날 자리가 없다.
  const { width: windowWidth } = useWindowDimensions()
  const metrics = resolveBottomBarMetrics(windowWidth)
  const barHeight = metrics.heightPx
  /** 바 높이에서 위아래 여백을 뺀 값. 둘은 함께 움직인다. 따로 두면 알약이 바 안에서 떠 버린다. */
  const pillHeight = barHeight - BAR_PADDING * 2
  const backCircle = Math.round(pillHeight * BACK_CIRCLE_RATIO)

  const bar: BarState = useMemo(() => ({ page, lastSub, order }), [page, lastSub, order])

  const colors = resolveBarColors(definition)
  // iOS 26 이상에서만 Liquid Glass 가 있다. 그 밖(안드로이드 · iOS 26 미만)은 블러 재질이고,
  // 재질이 아예 없는 불투명 캡슐로 떨어지지는 않는다.
  const glass = isLiquidGlassAvailable()
  const layer = barLayer(bar)
  const subs = visibleSubs(bar)
  const hasBack = canGoBack(bar)

  const groupItems = order.groups.map(groupById).map((group) => ({
    key: group.id,
    label: group.label,
    active: group.id === groupOfPage(page).id,
  }))
  const subItems = subs.map((sub) => ({
    key: sub.page,
    label: sub.label,
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

  /** 마지막 누름. 짝을 이루거나 이동이 일어나면 비운다. */
  const lastTap = useRef<TapRecord | null>(null)

  /**
   * 항목 하나를 눌렀을 때.
   *
   * 활성 항목은 갈 곳이 없다(`pressGroup`·`pressSub` 가 `none` 을 낸다). 그 빈 자리가 **두 번
   * 두드렸는가** 를 묻는 자리이고, 손끝은 화면이 실제로 바뀔 때만 답한다.
   */
  const pressItem = useCallback(
    (key: string, active: boolean, toIntent: (bar: BarState) => BarIntent) => {
      if (active) {
        const now = Date.now()
        if (isSecondTap(lastTap.current, key, now)) {
          // 짝을 이뤘으면 지운다. 안 지우면 빠르게 세 번 두드릴 때 2·3 번째가 또 한 쌍이 된다.
          lastTap.current = null
          scrollPageToTop(barRef.current.page)
          return
        }

        lastTap.current = { key, at: now }
        return
      }

      // 이동한 누름은 짝의 앞이 될 수 없다. 남겨 두면 유틸리티에서 today 로 건너온 직후 today 를
      // 한 번 누르는 것이 더블 터치가 된다.
      lastTap.current = null
      tapFeedback()
      applyRef.current(toIntent(barRef.current))
    },
    [],
  )

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
        // 페이지와 바를 가르는 것은 색이 아니라 그림자다. 선은 긋지 않는다.
        boxShadow: boxShadowOf(definition.shadowColor, BAR_SHADOW),
      }}
    >
      {glass ? (
        <GlassView
          testID="bar-glass"
          // 바는 `clear` 로 두지 않는다. 유리 느낌은 세지지만 바쁜 콘텐츠 위에서 비활성 라벨
          // 대비가 1.07 까지 떨어진다. 바는 글자를 얹는 판이고 층은 알약 쪽에서 만든다.
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
            boxShadow: boxShadowOf(definition.shadowColor, PLATE_SHADOW),
          }}
        >
          {glass ? (
            <>
              <GlassView
                // 알약은 `clear`. 바(`regular`)보다 얇은 재질이라 뒤가 더 비친다. 바에는 쓰지
                // 않는다. 글자를 얹는 판이라 투과를 올리면 비활성 라벨 대비가 무너진다(1.07 까지 내려간다).
                glassEffectStyle="clear"
                colorScheme={definition.mode}
                tintColor={colors.pillOnGlass}
                style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
              />
              {/* 유리 위에 덮는 얇은 판. 재질이 두 겹으로 올려 놓은 하이라이트를 덜어낸다.
                  tint 로는 안 움직여서 뷰로 덮는다(`bar-colors.ts` 의 `pillVeil`). */}
              {colors.pillVeil === null ? null : (
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    { borderRadius: 999, backgroundColor: colors.pillVeil },
                  ]}
                />
              )}
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
              id={item.key}
              label={item.label}
              active={item.active}
              accent={colors.accent}
              muted={colors.muted}
              width={itemWidth}
              height={pillHeight}
              testID={`bar-group-${item.key}`}
              onPress={() => {
                pressItem(item.key, item.active, (bar) => pressGroup(bar, item.key))
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
              id={item.key}
              label={item.label}
              active={item.active}
              accent={colors.accent}
              muted={colors.muted}
              width={itemWidth}
              height={pillHeight}
              testID={`bar-sub-${item.key}`}
              onPress={() => {
                pressItem(item.key, item.active, (bar) => pressSub(bar, item.key))
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
          boxShadow: boxShadowOf(definition.shadowColor, PLATE_SHADOW),
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
            {/* 알약과 같은 판이다. 한쪽만 덮으면 하위 층에서 원이 알약보다 밝아진다. */}
            {colors.pillVeil === null ? null : (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: 999, backgroundColor: colors.pillVeil },
                ]}
              />
            )}
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
            // ← 도 화면이 바뀌는 이동이라 항목 누름과 **같은 값**으로 답한다. 뒤로 가기라고
            // 다른 촉감을 주면 바 안에서 두 가지 언어가 생긴다. 짝의 기록도 함께 비운다.
            lastTap.current = null
            tapFeedback()
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
            <BarBackGlyph color={colors.muted} />
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
