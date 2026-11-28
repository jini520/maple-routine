/**
 * 떠 있는 하단바. 행 판정과 기록 규칙은 `bar-groups.ts`, 누르기 · 끌기 판정은 `bar-motion.ts` 가 갖고 여기는 그리기와 배선만 하는 뷰.
 *
 * 모양과 움직임은 iOS 26 시스템 탭 바에 맞췄다. 높이 62 · 테마 색 판 알약 · 누르는 칸으로 바로 가는 알약 · 끌기.
 * iOS 는 누르고 끄는 동안 알약을 Skia 렌즈(`BarLens.tsx`)로 그리고, 안드로이드는 렌즈 없이 알약만 미끄러진다.
 *
 * 지키는 것 셋.
 *
 * ① 루트가 `position: absolute` 다. flex 자식으로 두면 화면 높이를 그만큼 먹는다.
 * ② 치수는 창 폭에서 계산한다(`lib/bottom-bar-metrics.ts`). 재면 첫 프레임이 0 이라 알약이 접힌다.
 * ③ 유리(`expo-glass-effect`)는 iOS 26 이상뿐이다. 그 밖은 흉내 내지 않고 불투명 판에 그림자다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Platform, StyleSheet, View, type ViewStyle } from 'react-native'
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { useBarOrderStore } from '../../../features/bar-order/store'
import { useButtonNavigation } from '../../../hooks/useButtonNavigation'
import { useKeyboardShown } from '../../../hooks/useKeyboardShown'
import {
  BACK_CIRCLE,
  BAR_HEIGHT,
  BAR_PADDING,
  resolveBarRowLayout,
  resolveBottomBarMetrics,
  resolveRailBarMetrics,
} from '../../../lib/bottom-bar-metrics'
import { useBottomSafeAreaPx } from '../../../lib/safe-area'
import { useScreenLayout } from '../../../lib/screen-layout'
import { boxShadowOf } from '../../../lib/shadow'
import { tapFeedback } from '../../../native/haptics'
import { pageCapture } from '../../../navigation/bar-capture'
import {
  BAR_GROUPS,
  barLayer,
  canGoBack,
  groupById,
  groupOfPage,
  layerOfPage,
  pressBack,
  pressGroup,
  pressSub,
  rememberSub,
  visibleSubs,
  type BarIntent,
  type BarState,
  type GroupId,
} from '../../../navigation/bar-groups'
import { scrollPageToTop } from '../../../navigation/scroll-to-top'
import type { LayerRouteName, TabRouteName } from '../../../navigation/routes'
import { useThemeAppearance } from '../../../theme/context'
import { LensCanvas } from './BarLens'
import { colorToUniform, useLensBackdrop, useLensRowImages, type LensRowSpec } from './lens-images'
import { BarBackGlyph, BarGlyph } from './BarGlyph'
import { resolveBarColors } from './bar-colors'
import {
  BAR_PRESS_SCALE,
  HOLD_GROW_H,
  HOLD_GROW_W,
  HOLD_SPRING,
  IDLE_PRESS,
  LIFT_SPRING,
  RELEASE_SPRING,
  RESIZE_SPRING,
  TRAVEL_SHAPE_H,
  TRAVEL_SHAPE_W,
  TRAVEL_SPRING,
  beginPress,
  deferNavigation,
  endPress,
  lensStrength,
  movePress,
  slotCenter,
  type PressState,
  type Slots,
} from './bar-motion'
import { BAR_SHADOW, PLATE_SHADOW } from './bar-shape'
import { setLastSub, useLastSub } from './bar-store'
import { isSecondTap, type TapRecord } from './double-tap'
import { ROW_REFRESH_AFTER_FOCUS_MS, lensBackdropStrip } from './lens-snapshot'

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
  /** react-navigation 이 알려 주는 지금 화면(`page-from-layer-state.ts`). */
  page: TabRouteName
  /** ← 를 눌렀을 때 돌아갈 페이지. 행을 내비게이션이 끝나기 전에 바꾸려고 받는다. */
  pageBelow: TabRouteName | null
  navigation: BarNavigation
}

/** 안드로이드는 유리 · 렌즈 · 들림 없이 알약만 미끄러진다. 끊김 없이 바 역할을 하는 것이 움직임보다 먼저다. */
const PLAIN = Platform.OS === 'android'
/** 행 전환 때 알약이 나타나기 시작하는 크기 배율. */
const ENTER_FROM = 0.85
/** ← 원이 나오고 들어가는 시간 · 바 쪽에서 출발하는 거리. */
const BACK_MS = 300
const BACK_DROP = 26
/** 렌즈 안 확대 정도. */
const LENS_ZOOM = 0.12
/** 렌즈 캔버스가 바 위아래로 더 덮는 길이. 들린 알약이 바 밖으로 나가는 만큼. */
const LENS_EXT = 12
const SINE = Easing.inOut(Easing.sin)
const EASE_OUT = Easing.out(Easing.cubic)

const AnimatedGlassView = Animated.createAnimatedComponent(GlassView)

interface Item {
  key: GroupId | TabRouteName
  label: string
  active: boolean
}

/** 지금 시각(ms). 워크릿에서 누른 뒤 지난 시간을 잰다. */
function nowMs(): number {
  'worklet'
  return Date.now()
}

/** 옆 칸으로 갈 때 알약 모양을 키프레임대로 바꾸는 워크릿. */
function startTravelShape(w: SharedValue<number>, h: SharedValue<number>): void {
  'worklet'
  const frames = (keys: readonly (readonly [number, number])[]) =>
    keys.map(([value, duration]) => withTiming(value, { duration, easing: SINE }))
  h.set(withSequence(...frames(TRAVEL_SHAPE_H)))
  w.set(withSequence(...frames(TRAVEL_SHAPE_W)))
}

export function BottomBar({ page, pageBelow, navigation }: BottomBarProps): React.JSX.Element | null {
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const { definition } = useThemeAppearance()
  const lastSub = useLastSub()
  const order = useBarOrderStore((state) => state.order)
  const isKeyboardShown = useKeyboardShown()
  const screenLayout = useScreenLayout()
  const buttonNavigation = useButtonNavigation()
  const colors = resolveBarColors(definition)
  const glass = isLiquidGlassAvailable()
  const useLens = Platform.OS === 'ios'

  // 행은 누르는 순간 바꾼다. 내비게이션이 끝나면 그 값이 다시 들어와 덮는다.
  const [shownPage, setShownPage] = useState(page)
  const [propPage, setPropPage] = useState(page)
  if (propPage !== page) {
    setPropPage(page)
    setShownPage(page)
  }

  const bar: BarState = useMemo(() => ({ page: shownPage, lastSub, order }), [shownPage, lastSub, order])
  const layer = barLayer(bar)
  const hasBack = canGoBack(bar)
  const rowKey = layer === 'group' ? 'group' : groupOfPage(shownPage).id

  const items: Item[] =
    layer === 'sub'
      ? visibleSubs(bar).map((sub) => ({ key: sub.page, label: sub.label, active: sub.page === shownPage }))
      : order.groups.map(groupById).map((group) => ({
          key: group.id,
          label: group.label,
          active: group.id === groupOfPage(shownPage).id,
        }))
  const activeIndex = Math.max(0, items.findIndex((item) => item.active))

  // 값은 칸이 늘어선 방향(main)과 가로지르는 방향(cross)으로 적는다. 오른쪽 레일 화면은 바를 세로 막대로 세우고
  // main 이 세로다.
  const vertical = screenLayout.kind === 'side-rail'
  const metrics = resolveBottomBarMetrics(screenLayout.contentWidthPx, buttonNavigation)
  const rail = resolveRailBarMetrics({ layout: screenLayout, bottomSafeAreaPx, itemCount: BAR_GROUPS.length })
  /** 바 두께(cross). */
  const thickness = vertical ? rail.widthPx : BAR_HEIGHT
  /** 알약 두께(cross). */
  const pillThickness = thickness - BAR_PADDING * 2
  const fullLength = vertical ? rail.heightPx : metrics.widthPx
  /** 그룹 행 바가 시작하는 자리(main). 하위 행은 이 자리에 ← 원이 선다. */
  const groupStart = vertical ? rail.topPx : metrics.sideMarginPx
  const row = resolveBarRowLayout({
    fullLengthPx: fullLength,
    groupSlots: BAR_GROUPS.length,
    sub: layer === 'sub',
    paddingPx: BAR_PADDING,
  })
  const barStart = groupStart + row.offsetPx
  const pillLength = row.pillLengthPx
  const slots: Slots = { first: row.firstCenterPx, spacing: row.spacingPx, count: items.length }
  const centerOf = (index: number) => slotCenter(index, slots)

  const barStartSV = useSharedValue(barStart)
  const barLengthSV = useSharedValue(row.lengthPx)
  const backStartSV = useSharedValue(hasBack ? groupStart : groupStart + BACK_DROP * 2)
  const backScaleSV = useSharedValue(hasBack ? 1 : 0.4)
  const pillX = useSharedValue(centerOf(activeIndex))
  const lift = useSharedValue(0)
  const hold = useSharedValue(0)
  const wobW = useSharedValue(0)
  const wobH = useSharedValue(0)
  /** 선택 색의 세기. 누르면 빠지고 떼고 앉으면 돌아온다. */
  const tint = useSharedValue(1)
  /** 쉬는 알약 몸통의 세기. 누르는 순간 0(투명한 렌즈), 떼고 자리에 앉으면 1. */
  const body = useSharedValue(1)
  const backPress = useSharedValue(0)
  const lensAmt = useSharedValue(0)
  /** 행이 바뀔 때 알약 등장(0 → 1). 안드로이드 알약이 새 칸에서 나타난다. */
  const enter = useSharedValue(1)

  // 제스처 워크릿이 보는 값.
  const slotsSV = useSharedValue(slots)
  const activeSV = useSharedValue(activeIndex)
  /** 칸마다 누르면 하위 행으로 넘어가는지(1). */
  const opensRowSV = useSharedValue<number[]>([])
  const pressSV = useSharedValue<PressState>(IDLE_PRESS)
  const traveling = useSharedValue(false)
  const beganAt = useSharedValue(0)
  /** 지금 보이는 행. 렌즈 캔버스는 자기 행일 때만 알약 자리를 따라간다. */
  const currentRowSV = useSharedValue(rowKey)
  const shownRow = useRef(rowKey)
  const placed = useRef(false)

  useEffect(() => {
    slotsSV.set(slots)
    activeSV.set(activeIndex)
    opensRowSV.set(
      items.map((item) => (layer === 'group' && !item.active && groupById(item.key as GroupId).subs.length > 0 ? 1 : 0)),
    )
    if (!placed.current) {
      placed.current = true
      return
    }
    barStartSV.set(withSpring(barStart, RESIZE_SPRING))
    barLengthSV.set(withSpring(row.lengthPx, RESIZE_SPRING))
    if (shownRow.current !== rowKey) {
      // 알약은 행의 일부다. 옛 행 알약은 제자리에 멈춘 채 옛 항목과 함께 빠지고, 새 행 알약은 새 선택 칸에서
      // 새 항목과 같은 페이드로 나타난다. 두 행의 칸이 달라 알약이 이어 갈 자리가 없기 때문이다.
      shownRow.current = rowKey
      currentRowSV.set(rowKey)
      pillX.set(centerOf(activeIndex))
      if (PLAIN) {
        enter.set(0)
        enter.set(withTiming(1, { duration: 120 }))
      }
      return
    }
    if (pressSV.get().index < 0) pillX.set(withSpring(centerOf(activeIndex), TRAVEL_SPRING))
    // slots 는 아래 값들의 함수다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barStart, row.lengthPx, row.firstCenterPx, row.spacingPx, items.length, activeIndex, rowKey, layer])

  // ← 원은 늘 마운트돼 있다. 그룹 행에서는 작게 줄어 바 판 밑에 숨는다. 마운트와 언마운트를 오가면 빠른 왕복에서
  // 나갈 때의 끝 콜백이 다시 들어온 원을 지웠다.
  useEffect(() => {
    const ease = { duration: BACK_MS, easing: EASE_OUT }
    backStartSV.set(withTiming(hasBack ? groupStart : groupStart + BACK_DROP * 2, ease))
    backScaleSV.set(withTiming(hasBack ? 1 : 0.4, ease))
    // 진입 · 퇴장 때만 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBack])

  const barRef = useRef(bar)
  const pageBelowRef = useRef(pageBelow)
  const itemsRef = useRef(items)
  useEffect(() => {
    barRef.current = bar
    pageBelowRef.current = pageBelow
    itemsRef.current = items
  })

  const apply = useCallback(
    (intent: BarIntent) => {
      switch (intent.kind) {
        case 'openSubs':
          setLastSub(rememberSub(barRef.current.lastSub, intent.page))
          setShownPage(intent.page)
          deferNavigation(() => navigation.openLayer(intent.layer, intent.page))
          return
        case 'switchSub':
          setLastSub(rememberSub(barRef.current.lastSub, intent.page))
          setShownPage(intent.page)
          deferNavigation(() => navigation.openLayer(layerOfPage(intent.page), intent.page))
          return
        case 'switchGroupPage':
          setShownPage(intent.page)
          deferNavigation(() => navigation.openLayer('Groups', intent.page))
          return
        case 'back':
          if (pageBelowRef.current !== null) setShownPage(pageBelowRef.current)
          deferNavigation(() => navigation.goBack())
          return
        case 'none':
          return
      }
    },
    [navigation],
  )

  const lastTap = useRef<TapRecord | null>(null)

  /** 손을 뗀 칸. 활성 칸이면 두 번 두드리기를 본다. */
  const commit = useCallback(
    (index: number) => {
      const item = itemsRef.current[index]
      if (item === undefined) return
      if (item.active) {
        const now = Date.now()
        if (isSecondTap(lastTap.current, item.key, now)) {
          lastTap.current = null
          scrollPageToTop(barRef.current.page)
          return
        }
        lastTap.current = { key: item.key, at: now }
        return
      }
      lastTap.current = null
      tapFeedback()
      const current = barRef.current
      apply(
        barLayer(current) === 'sub' ? pressSub(current, item.key as TabRouteName) : pressGroup(current, item.key as GroupId),
      )
    },
    [apply],
  )

  const goBack = useCallback(() => {
    lastTap.current = null
    tapFeedback()
    apply(pressBack(barRef.current))
  }, [apply])

  /** 알약을 들어 렌즈를 띄운다. iOS 만. */
  const liftPill = () => {
    'worklet'
    beganAt.set(nowMs())
    lift.set(withSpring(1, LIFT_SPRING))
    hold.set(withSpring(1, HOLD_SPRING))
    tint.set(withTiming(0, { duration: 270, easing: EASE_OUT }))
    body.set(0)
  }

  const onPressBegin = (pos: number) => {
    'worklet'
    const begin = beginPress(pos, slotsSV.get(), opensRowSV.get(), activeSV.get())
    pressSV.set(begin.press)
    lensAmt.set(lensStrength(begin.press))
    if (begin.pillTarget === null) return
    pillX.set(withSpring(begin.pillTarget, TRAVEL_SPRING))
    if (PLAIN) return
    liftPill()
    traveling.set(begin.travel)
    if (begin.travel) startTravelShape(wobW, wobH)
  }

  const onPressMove = (pos: number, translation: number) => {
    'worklet'
    const move = movePress(pressSV.get(), pos, translation, pillX.get(), slotsSV.get())
    pressSV.set(move.press)
    lensAmt.set(lensStrength(move.press))
    if (move.startedDrag && !PLAIN) {
      if (move.startedLens) liftPill()
      hold.set(withSpring(1, HOLD_SPRING))
      wobW.set(withTiming(0, { duration: 120 }))
      wobH.set(withTiming(0, { duration: 120 }))
    }
    if (move.pillPos !== null) pillX.set(move.pillPos)
  }

  const onPressEnd = () => {
    'worklet'
    const press = pressSV.get()
    const end = endPress(press, pillX.get(), slotsSV.get())
    pressSV.set(IDLE_PRESS)
    if (end.commitIndex < 0) return
    if (end.pillTarget !== null) {
      pillX.set(withSpring(end.pillTarget, TRAVEL_SPRING))
      if (!PLAIN) {
        if (press.dragging) {
          wobH.set(withSequence(withTiming(-0.09, { duration: 110 }), withTiming(0, { duration: 260, easing: SINE })))
        }
        hold.set(withTiming(0, { duration: 170, easing: EASE_OUT }))
        lift.set(withSpring(0, RELEASE_SPRING))
        // 탭으로 옆 칸에 갔으면 알약이 앉을 때까지(최대 300ms) 기다렸다 판을 채운다.
        const elapsed = nowMs() - beganAt.get()
        const wait = traveling.get() && !press.dragging ? Math.max(0, 300 - elapsed) : 0
        const fill = withTiming(1, { duration: wait > 0 ? 380 : 170, easing: EASE_OUT })
        tint.set(withDelay(wait, fill))
        body.set(withDelay(wait, withTiming(1, { duration: wait > 0 ? 380 : 170, easing: EASE_OUT })))
        traveling.set(false)
      }
    }
    runOnJS(commit)(end.commitIndex)
  }

  const gesture = usePanGesture(vertical, onPressBegin, onPressMove, onPressEnd)
  const backGesture = useBackGesture(backPress, goBack)

  // 애니메이션 뷰의 스타일은 고정 값까지 애니메이션 스타일 하나에 둔다. 고정 스타일과 섞으면 고정 쪽이 조용히 버려지는
  // 경우가 있다(안드로이드에서 알약이 안 그려졌다).
  const backFillStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: colors.pressFill,
    opacity: backPress.get(),
  }))
  const backArrowStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, (backScaleSV.get() - 0.4) / 0.6)) }))
  const barPlateStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    borderRadius: 999,
    ...(vertical
      ? { left: 0, width: thickness, top: barStartSV.get(), height: barLengthSV.get() }
      : { top: 0, height: thickness, left: barStartSV.get(), width: barLengthSV.get() }),
    transform: [{ scale: 1 + BAR_PRESS_SCALE * lift.get() }],
  }))
  // 같은 애니메이션 스타일을 두 컴포넌트에 걸지 않는다. 그러면 한쪽만 배치 값을 받아 누르기 영역이 0 이 됐다.
  const contentStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    ...(vertical
      ? { left: 0, width: thickness, top: barStartSV.get(), height: barLengthSV.get() }
      : { top: 0, height: thickness, left: barStartSV.get(), width: barLengthSV.get() }),
    transform: [{ scale: 1 + BAR_PRESS_SCALE * lift.get() }],
  }))
  const backPlateStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: BACK_CIRCLE,
    height: BACK_CIRCLE,
    borderRadius: 999,
    ...(vertical
      ? { left: (thickness - BACK_CIRCLE) / 2, top: backStartSV.get() }
      : { top: (BAR_HEIGHT - BACK_CIRCLE) / 2, left: backStartSV.get() }),
    transform: [{ scale: backScaleSV.get() * (1 + 0.14 * backPress.get()) }],
  }))
  /** 안드로이드 알약의 움직이는 층. transform 과 opacity 만 둔다. 배치 값이 섞이면 매 프레임 메인 스레드가 끊겼다. */
  const plainPillStyle = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [
      vertical ? { translateY: pillX.get() - pillLength / 2 } : { translateX: pillX.get() - pillLength / 2 },
      { scale: ENTER_FROM + (1 - ENTER_FROM) * enter.get() },
    ],
  }))
  /** iOS 에서 렌즈 그림이 없을 때 알약. 배치 값까지 이 스타일 안에 둔다. */
  const pillStyle = useAnimatedStyle(() => {
    const w = pillLength * (1 + HOLD_GROW_W * hold.get() + wobW.get())
    const h = pillThickness * (1 + HOLD_GROW_H * hold.get() + wobH.get())
    return {
      position: 'absolute',
      borderRadius: 999,
      overflow: 'hidden',
      ...(vertical
        ? { height: w, width: h, top: pillX.get() - w / 2, left: thickness / 2 - h / 2 }
        : { width: w, height: h, left: pillX.get() - w / 2, top: thickness / 2 - h / 2 }),
    }
  })
  const pillFillStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    opacity: glass ? tint.get() : 0.35 + 0.65 * tint.get(),
  }))

  const itemSize: LensBox = { pillLength, pillThickness, vertical }

  // 렌즈가 휠 항목 줄 그림. 그룹 행과 하위가 있는 그룹마다 한 줄.
  const subRow = resolveBarRowLayout({ fullLengthPx: fullLength, groupSlots: BAR_GROUPS.length, sub: true, paddingPx: BAR_PADDING })
  const groupRow = resolveBarRowLayout({ fullLengthPx: fullLength, groupSlots: BAR_GROUPS.length, sub: false, paddingPx: BAR_PADDING })
  const lensRows: LensRowSpec[] = [
    {
      key: 'group',
      width: groupRow.lengthPx,
      items: order.groups.map(groupById).map((group, index) => ({
        key: group.id,
        label: group.label,
        center: groupRow.firstCenterPx + index * groupRow.spacingPx,
      })),
    },
    ...BAR_GROUPS.filter((group) => group.subs.length > 0).map((group) => {
      const pages = order.subs[group.id] ?? []
      const subs = [...group.subs].sort((a, b) => pages.indexOf(a.page) - pages.indexOf(b.page))
      return {
        key: group.id,
        width: subRow.lengthPx,
        items: subs.map((sub, index) => ({
          key: sub.page,
          label: sub.label,
          center: subRow.firstCenterPx + index * subRow.spacingPx,
        })),
      }
    }),
  ]
  const lensEdge = definition.mode === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.28)'
  const themeKey = [definition.mode, definition.bg, colors.bar].join('|')
  const lensSignature = [
    screenLayout.windowWidthPx,
    vertical ? 'v' : 'h',
    fullLength,
    themeKey,
    colors.accent,
    colors.muted,
    lensEdge,
    JSON.stringify(order),
  ].join('|')
  // 위 화면이나 백그라운드에서 돌아올 때 줄 그림도 다시 뜬다(가려진 동안 뜬 그림이 비어 있을 수 있다).
  const [rowRefresh, setRowRefresh] = useState(0)
  const { images: lensImages, sources: lensSources } = useLensRowImages(
    useLens ? lensRows : [],
    thickness + LENS_EXT * 2,
    pillLength,
    pillThickness,
    colors.accent,
    colors.muted,
    lensEdge,
    lensSignature,
    LENS_EXT,
    colors.bar,
    definition.bg,
    vertical,
    rowRefresh,
  )
  const bottom = bottomSafeAreaPx + metrics.liftPx
  /** 렌즈 캔버스 왼쪽 위의 창 좌표 중 가로지르는 방향 값. */
  const lensCrossStart = vertical ? rail.leftPx - LENS_EXT : screenLayout.windowHeightPx - bottom - BAR_HEIGHT - LENS_EXT
  const pageImages = useLensBackdrop({
    enabled: useLens,
    definition,
    themeKey,
    strip: lensBackdropStrip({
      vertical,
      windowWidthPx: screenLayout.windowWidthPx,
      windowHeightPx: screenLayout.windowHeightPx,
      crossStartPx: lensCrossStart,
      crossLengthPx: thickness + LENS_EXT * 2,
    }),
    windowWidthPx: screenLayout.windowWidthPx,
    windowHeightPx: screenLayout.windowHeightPx,
  })

  useEffect(() => {
    if (!useLens) return
    let timer: ReturnType<typeof setTimeout> | null = null
    pageCapture.onFocus = () => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => setRowRefresh((n) => n + 1), ROW_REFRESH_AFTER_FOCUS_MS)
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') pageCapture.onFocus?.()
    })
    return () => {
      pageCapture.onFocus = null
      subscription.remove()
      if (timer !== null) clearTimeout(timer)
    }
  }, [useLens])

  const rowImages = useLens ? (lensImages[rowKey] ?? null) : null

  if (isKeyboardShown) return null

  // 바 전체 상자. 가로 바는 화면 아래 줄, 세로 막대는 레일 자리의 세로 줄(창 위 끝부터)이다.
  const outerStyle: ViewStyle = vertical
    ? { position: 'absolute', top: 0, left: rail.leftPx, width: thickness, height: screenLayout.windowHeightPx }
    : { position: 'absolute', left: 0, right: 0, bottom, height: BAR_HEIGHT }
  /** 유리가 없는 곳의 바 판과 ← 판. 페이지와는 그림자로 가른다. */
  const opaquePlate: ViewStyle = {
    borderRadius: 999,
    backgroundColor: colors.bar,
    boxShadow: boxShadowOf(definition.shadowColor, BAR_SHADOW),
  }
  // 유리가 없으면 쉬는 알약이 옅은 판으로는 안 보인다. 테마 알약 색에 판 그림자를 준다.
  const restPill: ViewStyle = glass
    ? { borderRadius: 999, backgroundColor: colors.glassPill }
    : { borderRadius: 999, backgroundColor: colors.pill, boxShadow: boxShadowOf(definition.shadowColor, PLATE_SHADOW) }
  const rowBox: ViewStyle = vertical
    ? { position: 'absolute', top: 0, left: 0, width: thickness, height: row.lengthPx }
    : { position: 'absolute', top: 0, left: 0, height: thickness, width: row.lengthPx }
  const Container = glass ? GlassContainer : View

  return (
    <View testID="bottom-bar" pointerEvents="box-none" style={outerStyle}>
      {/* 바 판과 ← 판은 같은 유리 컨테이너 안이다. 가까우면 한 덩어리로 붙고 멀어지면 떨어진다.
          ← 판이 먼저다. 유리가 없는 곳에서는 숨은 원을 바 판이 덮는다. ← 원은 누름 영역 밖이다. 안에 두면 iOS 가 그
          유리를 그리지 않는다. */}
      <Container {...(glass ? { spacing: 16 } : {})} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {glass ? (
          <AnimatedGlassView
            testID="bar-back-plate"
            glassEffectStyle="clear"
            colorScheme={definition.mode}
            tintColor={colors.pillOnGlass}
            pointerEvents="none"
            style={backPlateStyle}
          />
        ) : (
          <Animated.View pointerEvents="none" style={backPlateStyle}>
            <View testID="bar-back-plate" style={[StyleSheet.absoluteFill, opaquePlate]} />
          </Animated.View>
        )}
        {glass ? (
          <AnimatedGlassView
            testID="bar-glass"
            glassEffectStyle="regular"
            colorScheme={definition.mode}
            tintColor={colors.glassTint}
            pointerEvents="none"
            style={barPlateStyle}
          />
        ) : (
          <Animated.View pointerEvents="none" style={barPlateStyle}>
            <View testID="bar-plate" style={[StyleSheet.absoluteFill, opaquePlate]} />
          </Animated.View>
        )}
      </Container>

      {hasBack ? (
        <GestureDetector gesture={backGesture}>
          <Animated.View
            testID="bar-back"
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={goBack}
            style={backPlateStyle}
          >
            <Animated.View pointerEvents="none" style={backFillStyle} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <Animated.View style={backArrowStyle}>
                <BarBackGlyph color={colors.muted} />
              </Animated.View>
            </View>
          </Animated.View>
        </GestureDetector>
      ) : null}

      <GestureDetector gesture={gesture}>
        <Animated.View testID="bar-content" style={contentStyle}>
          {PLAIN ? (
            // 안드로이드 알약은 세 겹이다. 자리는 바깥 뷰, 움직임은 가운데 뷰(transform · opacity 만), 판은 안쪽 뷰가 진다.
            // 고정 스타일과 애니메이션 스타일을 한 뷰에 섞으면 알약이 안 그려졌다.
            <View pointerEvents="none" style={{ position: 'absolute', left: vertical ? BAR_PADDING : 0, top: vertical ? 0 : BAR_PADDING }}>
              <Animated.View testID="bar-pill" style={plainPillStyle}>
                <View
                  testID="bar-pill-plate"
                  style={[restPill, vertical ? { width: pillThickness, height: pillLength } : { width: pillLength, height: pillThickness }]}
                />
              </Animated.View>
            </View>
          ) : rowImages === null ? (
            // 렌즈 그림이 아직 없을 때(테마를 바꾼 직후 줄 그림을 다시 뜨는 동안 등). 렌즈 없이 알약 판만 움직인다.
            <Animated.View testID="bar-pill" pointerEvents="none" style={pillStyle}>
              <Animated.View style={pillFillStyle}>
                <View testID="bar-pill-plate" style={[StyleSheet.absoluteFill, restPill]} />
              </Animated.View>
            </Animated.View>
          ) : null}

          {/* 항목 줄. 행이 바뀌면 옛 행이 100ms 에 빠지고 새 행이 120ms 에 나타난다. */}
          <Animated.View key={rowKey} entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)} pointerEvents="box-none" style={rowBox}>
            {rowImages !== null ? (
              <>
                {/* 쉬는 바는 앱 뷰로 테마 값에서 바로 그린다. 렌즈 캔버스는 누르고 끄는 동안(몸통이 빠진 동안)에만 보인다.
                    쉬는 동안까지 캔버스로 그리면 테마를 바꿀 때 옛 그림이 남는다. */}
                <SwapLayer body={body} rest>
                  <View
                    testID="bar-pill"
                    style={
                      vertical
                        ? { position: 'absolute', top: centerOf(activeIndex) - pillLength / 2, left: BAR_PADDING, height: pillLength, width: pillThickness }
                        : { position: 'absolute', left: centerOf(activeIndex) - pillLength / 2, top: BAR_PADDING, width: pillLength, height: pillThickness }
                    }
                  >
                    <View testID="bar-pill-plate" style={[StyleSheet.absoluteFill, restPill]} />
                  </View>
                  {items.map((item, index) => (
                    <BarItem key={item.key} index={index} item={item} layer={layer} center={centerOf(index)} lens={itemSize} accent={colors.accent} muted={colors.muted} onActivate={commit} />
                  ))}
                </SwapLayer>
                <SwapLayer body={body} rest={false}>
                  <LensCanvas
                    images={rowImages}
                    width={row.lengthPx}
                    height={thickness + LENS_EXT * 2}
                    top={-LENS_EXT}
                    vertical={vertical}
                    pageBg={colorToUniform(definition.bg)}
                    pillX={pillX}
                    pillW={pillLength}
                    pillH={pillThickness}
                    hold={hold}
                    wobW={wobW}
                    wobH={wobH}
                    tint={tint}
                    lensAmt={lensAmt}
                    body={body}
                    enter={enter}
                    rowKey={rowKey}
                    currentRow={currentRowSV}
                    enterFrom={ENTER_FROM}
                    lensLift={colors.lensLift}
                    holdW={HOLD_GROW_W}
                    holdH={HOLD_GROW_H}
                    zoom={LENS_ZOOM}
                    page={pageImages}
                    windowW={screenLayout.windowWidthPx}
                    windowH={screenLayout.windowHeightPx}
                    originX={barStartSV}
                    originY={lensCrossStart}
                    barW={barLengthSV}
                    barH={thickness}
                    glassTint={[...colorToUniform(colors.bar).slice(0, 3), 0.6]}
                    pillFill={premultiplied(colors.glassPill)}
                  />
                </SwapLayer>
              </>
            ) : (
              items.map((item, index) => (
                <BarItem key={item.key} index={index} item={item} layer={layer} center={centerOf(index)} lens={itemSize} accent={colors.accent} muted={colors.muted} onActivate={commit} />
              ))
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      {lensSources}
    </View>
  )
}

/**
 * 바 전체에 거는 누르기 · 끌기 제스처. 손이 닿는 순간부터(`minDistance(0)`) 받고, 바 밖으로 나가도 놓을 때까지 따라간다.
 *
 * @param vertical 세로 막대인가(칸 방향이 세로)
 */
function usePanGesture(
  vertical: boolean,
  onBegin: (pos: number) => void,
  onMove: (pos: number, translation: number) => void,
  onEnd: () => void,
): ReturnType<typeof Gesture.Pan> {
  return Gesture.Pan()
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onBegin((event) => {
      onBegin(vertical ? event.y : event.x)
    })
    .onUpdate((event) => {
      onMove(vertical ? event.y : event.x, vertical ? event.translationY : event.translationX)
    })
    .onFinalize(() => {
      onEnd()
    })
}

/** ← 원의 제스처. 손이 닿자마자 원이 부풀고, 뗀 순간 뒤로 간다. */
function useBackGesture(press: SharedValue<number>, goBack: () => void): ReturnType<typeof Gesture.Tap> {
  return Gesture.Tap()
    .maxDuration(10000)
    .onBegin(() => {
      press.set(withSpring(1, LIFT_SPRING))
    })
    .onEnd((_event, success) => {
      if (success) runOnJS(goBack)()
    })
    .onFinalize(() => {
      press.set(withSpring(0, RELEASE_SPRING))
    })
}

/** 셰이더에 넘기는 premultiplied rgba(0 ~ 1 네 개). */
function premultiplied(color: string): number[] {
  const [r, g, b, a] = colorToUniform(color)
  return [r * a, g * a, b * a, a]
}

/**
 * 쉬는 바(앱 뷰)와 렌즈 캔버스를 바꿔 끼우는 층. 누르는 순간 몸통이 0 이 되며 캔버스로, 다시 다 차면 앱 뷰로.
 * 행마다 따로 마운트되므로 애니메이션 스타일을 행끼리 나눠 쓰지 않는다.
 */
function SwapLayer(props: { body: SharedValue<number>; rest: boolean; children: React.ReactNode }): React.JSX.Element {
  const { body, rest } = props
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    opacity: (body.get() >= 0.999) === rest ? 1 : 0,
  }))
  return (
    <Animated.View pointerEvents="box-none" style={style}>
      {props.children}
    </Animated.View>
  )
}

/** 항목 칸의 크기를 정하는 값. */
interface LensBox {
  pillLength: number
  pillThickness: number
  vertical: boolean
}

/** 항목 한 칸의 상자. 가로 바는 가로로, 세로 막대는 세로로 늘어선다. */
function itemBox(center: number, lens: LensBox): ViewStyle {
  return lens.vertical
    ? { position: 'absolute', top: center - lens.pillLength / 2, left: BAR_PADDING, height: lens.pillLength, width: lens.pillThickness }
    : { position: 'absolute', left: center - lens.pillLength / 2, top: BAR_PADDING, width: lens.pillLength, height: lens.pillThickness }
}

/** 항목 하나. 누르기는 바 전체의 제스처가 받고, 이 칸은 접근성 동작(`activate`)만 받는다. */
function BarItem(props: {
  index: number
  item: Item
  layer: 'group' | 'sub'
  center: number
  lens: LensBox
  accent: string
  muted: string
  onActivate: (index: number) => void
}): React.JSX.Element {
  const { item } = props
  return (
    <View
      testID={`bar-${props.layer}-${item.key}`}
      accessible
      accessibilityRole="tab"
      accessibilityState={{ selected: item.active }}
      accessibilityLabel={item.label}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => props.onActivate(props.index)}
      style={[itemBox(props.center, props.lens), { alignItems: 'center', justifyContent: 'center' }]}
    >
      <BarGlyph id={item.key} label={item.label} active={item.active} accent={props.accent} muted={props.muted} />
    </View>
  )
}
