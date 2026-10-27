/**
 * 위에서 내려오는 떠 있는 시트. 키보드와 함께 쓰는 칸(키 입력 등)을 직접 품는다.
 *
 * 키보드는 아래에서 올라오므로 위에 선 시트를 가리지 않는다. 그래서 바텀시트와 달리 입력 카드를 거치지 않는다.
 * 부모가 조건부로 마운트하면 열리고, 위로 밀기 · 스크림 탭 · 뒤로가기로 닫힌다. `onClose` 는 나가는 움직임이 끝난 뒤 온다.
 *
 * 화면 위에 덮는 층으로 그린다. RN `Modal` 은 안드로이드에서 별도 창이라 앱 셸이 재는 키보드 높이가 거기까지 오는지
 * 장담할 수 없다. 그래서 호출부가 화면 루트에 둔다.
 *
 * @example
 * {열림 ? <TopSheet label="API 키 입력" onClose={() => set열림(false)}>{내용}</TopSheet> : null}
 */
import { useCallback, useEffect, type ReactNode } from 'react'
import { BackHandler, Pressable, ScrollView, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { vars } from 'nativewind'
import { useSafeAreaFrame } from 'react-native-safe-area-context'

import { useBottomSafeAreaPx, useTopSafeAreaPx } from '../../../lib/safe-area'
import { useThemeAppearance } from '../../../theme/context'
import { buildSheetScopeVariables } from '../../../theme/theme-vars'
import { dragOffset, scrimOpacityFor, shouldCloseOnRelease, topSheetMaxHeight } from './top-sheet-drag'

// 이 앱의 `Animated.View` 는 NativeWind 가 감싸 둔 컴포넌트라 애니메이션 스타일이 조용히 버려진다. 따로 만든다.
const AnimatedBox = Animated.createAnimatedComponent(View)

/** 화면 좌우와 시트 사이. */
const SIDE_GAP_PX = 10

const ENTER = { duration: 320, easing: Easing.out(Easing.cubic) }
const EXIT = { duration: 220, easing: Easing.in(Easing.cubic) }
/** 끌다 놓았을 때 제자리로 튕겨 돌아오는 스프링. */
const SNAP_BACK = { damping: 16, stiffness: 220, mass: 0.8 }

export function TopSheet(props: {
  /** 스크린리더가 읽는 시트 이름. 기본값을 두면 다음 시트가 그 이름을 물려받는다 */
  label: string
  onClose: () => void
  testId?: string
  children: ReactNode
}): React.JSX.Element {
  const { onClose } = props
  const testId = props.testId ?? 'top-sheet'
  // 창 높이는 안전영역 프로바이더의 틀에서 읽는다. 바텀시트의 상한과 같은 값이다.
  const { height: windowHeight } = useSafeAreaFrame()
  const topInset = useTopSafeAreaPx()
  const bottomInset = useBottomSafeAreaPx()
  const keyboard = useReanimatedKeyboardAnimation()
  const reduceMotion = useReducedMotion()
  const { definition } = useThemeAppearance()

  /** 0 은 화면 위로 숨은 자리, 1 은 선 자리. */
  const shown = useSharedValue(reduceMotion ? 1 : 0)
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  /** 손가락이 위아래로 간 거리. 시트는 위로 안 움직이므로 스크림은 이 값을 따른다. */
  const fingerY = useSharedValue(0)
  /** 나갈 때 화면 밖으로 밀어낼 거리. 잰 시트 높이에서 정한다. */
  const sheetHeight = useSharedValue(windowHeight)
  // 스크림을 두 번 누르거나 뒤로가기와 겹쳐도 부모에 한 번만 알린다. 제스처 콜백도 이 값을 거치므로 ref 가 아니라 공유 값이다.
  const closing = useSharedValue(false)

  useEffect(() => {
    if (!reduceMotion) shown.set(withTiming(1, ENTER))
  }, [reduceMotion, shown])

  const close = useCallback(() => {
    if (closing.get()) return
    closing.set(true)
    if (reduceMotion) {
      onClose()
      return
    }
    shown.set(
      withTiming(0, EXIT, (finished) => {
        if (finished === true) runOnJS(onClose)()
      }),
    )
  }, [closing, onClose, reduceMotion, shown])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close()
      return true
    })
    return () => subscription.remove()
  }, [close])

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      const offset = dragOffset(event.translationX, event.translationY)
      dragX.set(offset.x)
      dragY.set(offset.y)
      fingerY.set(event.translationY)
    })
    .onEnd((event) => {
      if (shouldCloseOnRelease(event.translationY, event.velocityY)) runOnJS(close)()
      dragX.set(withSpring(0, SNAP_BACK))
      dragY.set(withSpring(0, SNAP_BACK))
      fingerY.set(withSpring(0, SNAP_BACK))
    })

  // 위치까지 이 스타일 하나에 둔다. 애니메이션 뷰에 정적 스타일을 함께 주면 정적 쪽이 조용히 버려진다.
  const sheetStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: topInset,
    left: SIDE_GAP_PX,
    right: SIDE_GAP_PX,
    maxHeight: topSheetMaxHeight({
      windowHeight,
      keyboardHeight: -keyboard.height.get(),
      topInset,
      bottomInset,
    }),
    transform: [
      { translateX: dragX.get() },
      { translateY: dragY.get() - (1 - shown.get()) * (sheetHeight.get() + topInset) },
    ],
  }))

  const scrimStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: shown.get() * scrimOpacityFor(fingerY.get()),
  }))

  return (
    <View testID={`${testId}-layer`} className="absolute inset-0" pointerEvents="box-none">
      <AnimatedBox style={scrimStyle}>
        <Pressable
          testID={`${testId}-scrim`}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={close}
          className="flex-1 bg-scrim"
        />
      </AnimatedBox>
      <GestureDetector gesture={pan}>
        <AnimatedBox testID={testId} accessibilityLabel={props.label} accessibilityViewIsModal style={sheetStyle}>
          <View
            style={vars(buildSheetScopeVariables(definition))}
            className="overflow-hidden rounded-[28px] bg-surface"
            onLayout={(event) => sheetHeight.set(event.nativeEvent.layout.height)}
          >
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="px-5 pt-5 pb-2"
            >
              {props.children}
              <View className="mt-4 h-[5px] w-9 self-center rounded-full bg-text-disabled" />
            </ScrollView>
          </View>
        </AnimatedBox>
      </GestureDetector>
    </View>
  )
}
