/**
 * 드롭 타일 한 분류의 줄. 카드 하나 안에서 타일을 한 줄로 가로 스크롤한다.
 *
 * 스크롤 영역은 시트 양쪽 끝까지 닿는다. 가려진 타일이 남은 쪽은 카드 바탕도 시트 끝까지 늘어나 있고, 그쪽 끝 타일까지
 * 넘기면 제자리로 줄며 둥근 모서리가 돌아온다. 늘고 주는 것은 스크롤 콜백이 UI 스레드에서 정해 손가락을 놓치지 않는다.
 *
 * gesture-handler 의 ScrollView 를 쓴다. RN 기본 것은 안드로이드에서 시트의 Pan 제스처가 가로 스와이프를 가져가 굴러가지
 * 않는다. NativeWind 가 이 컴포넌트의 `className` 을 모르므로 여백은 `style` 로 준다.
 */
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import { CARD_EDGE_STRETCH, cardEdgeStretch } from './drop-tile-row'

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)
/** reanimated 의 `Animated.View` 에 주면 NativeWind 가 스타일을 조용히 버린다. */
const StretchBox = Animated.createAnimatedComponent(View)

/** 카드 반경과 안쪽 여백. 타일 칸 반경 10 과 함께 다른 카드 · 칸과 같은 짜임이다. */
const CARD_RADIUS = 14
const CARD_PADDING = 6

export function DropTileRow(props: { testID: string; children: ReactNode }): React.JSX.Element {
  const offset = useSharedValue(0)
  const contentWidth = useSharedValue(0)
  const viewportWidth = useSharedValue(0)

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      offset.set(event.contentOffset.x)
    },
  })

  const background = useAnimatedStyle(() => {
    const { left, right } = cardEdgeStretch(offset.get(), contentWidth.get(), viewportWidth.get())
    // 다 늘면 시트 끝에 붙으므로 그쪽 모서리를 편다. 둥근 채로 붙으면 카드가 시트 끝에서 떠 보인다.
    const leftRadius = CARD_RADIUS * (1 - left / CARD_EDGE_STRETCH)
    const rightRadius = CARD_RADIUS * (1 - right / CARD_EDGE_STRETCH)
    return {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: -left,
      right: -right,
      overflow: 'hidden',
      borderTopLeftRadius: leftRadius,
      borderBottomLeftRadius: leftRadius,
      borderTopRightRadius: rightRadius,
      borderBottomRightRadius: rightRadius,
    }
  })

  return (
    <View>
      <StretchBox pointerEvents="none" style={background}>
        <View className="flex-1 bg-surface" />
      </StretchBox>
      <AnimatedScrollView
        testID={props.testID}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={(event) => viewportWidth.set(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => contentWidth.set(width)}
        // 시트 여백만큼 양쪽으로 넓혀 타일이 시트 끝까지 굴러간다. 안쪽 여백이 그만큼을 돌려줘 처음 자리는 카드 안이다.
        style={{ marginHorizontal: -CARD_EDGE_STRETCH }}
        contentContainerStyle={{
          paddingHorizontal: CARD_EDGE_STRETCH + CARD_PADDING,
          paddingVertical: CARD_PADDING,
          gap: 4,
        }}
      >
        {props.children}
      </AnimatedScrollView>
    </View>
  )
}
