/**
 * 두 층 카드의 바탕. 격자 뒤에 깔려, 구분자 칸이 움직이는 대로 두 카드의 경계가 따라간다.
 *
 * ```
 * ┌ 위 카드 ─────────┐  ← 머리글 · 선택된 행
 * └──────────────────┘  ← 구분자 칸 맨 위 + UPPER_CARD_TAIL
 *                         CARD_GAP
 * ┌ 아래 카드 ───────┐  ← 계정 드롭다운 · 후보 행 · 아래 끝
 * └──────────────────┘
 * ```
 *
 * 행이 카드색을 칠하면 층을 옮기는 행의 바탕이 두 카드 사이를 메우고, 빠진 자리는 카드에 구멍으로 남는다.
 */
import { View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

import { backdropFrames } from './card-backdrop-frames'

// reanimated 의 `Animated.View` 에 className 을 주면 NativeWind 스타일이 조용히 사라진다.
const AnimatedView = Animated.createAnimatedComponent(View)

export function CardBackdrop(props: {
  headerHeight: SharedValue<number>
  /** 구분자 칸의 지금 위치. 격자가 아직 칸을 놓지 않았으면 `null` 이고, 그동안 바탕을 그리지 않는다. */
  separatorTop: SharedValue<number | null>
}): React.JSX.Element {
  const { headerHeight, separatorTop } = props

  const upperStyle = useAnimatedStyle(() => {
    const top = separatorTop.value
    if (top === null) return { opacity: 0 }
    return { opacity: 1, height: backdropFrames(headerHeight.value, top).upperHeight }
  })
  const lowerStyle = useAnimatedStyle(() => {
    const top = separatorTop.value
    if (top === null) return { opacity: 0 }
    return { opacity: 1, top: backdropFrames(headerHeight.value, top).lowerTop }
  })

  return (
    <View pointerEvents="none" className="absolute inset-0">
      <AnimatedView
        testID="character-manage-upper-card"
        className="absolute left-0 right-0 top-0 rounded-[14px] bg-surface"
        style={upperStyle}
      />
      <AnimatedView
        testID="character-manage-lower-card"
        className="absolute bottom-0 left-0 right-0 rounded-[14px] bg-surface"
        style={lowerStyle}
      />
    </View>
  )
}
