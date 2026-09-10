import { Pressable, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { useSlidingThumb } from '../../../hooks/useSlidingThumb'
import { useThemeAppearance } from '../../../theme/context'
import { Text } from '../../atoms'

/**
 * 애니메이션이 붙는 상자. `nativewind-interop` 에 등록된 `Animated.View` 를 쓰지 않는다.
 *
 * 등록된 컴포넌트에 정적 스타일과 애니메이션 스타일을 한 배열로 넘기면 정적 쪽이 사라진다.
 * 대가는 **`className` 이 아무 일도 안 한다**는 것이라, 자리도 색도 `style` 로 준다.
 */
const AnimatedBox = Animated.createAnimatedComponent(View)

export function Segment<T extends string>(props: {
  options: readonly T[]
  /** `null` 이면 **아무것도 안 골랐다**. 형태처럼 기본값을 안 정하는 자리가 있다. */
  selected: T | null
  onSelect: (value: T) => void
}): React.JSX.Element {
  const selectedIndex = props.selected === null ? -1 : props.options.indexOf(props.selected)
  const thumb = useSlidingThumb(selectedIndex)
  const { definition } = useThemeAppearance()

  return (
    <View
      testID="segment"
      // **테두리는 상자 하나뿐**이다. 조각마다 두르면 칩 여럿과 같은 그림이 된다.
      className="flex-row items-center rounded-full border border-border bg-surface p-0.5"
    >
      {/*
        안쪽 줄에 테두리도 여백도 없어야 한다. 조각이 알리는 `x` 와 아래 상자의 `left: 0` 이
        같은 지점에서 시작해야 상자가 조각 위에 정확히 겹친다.
      */}
      <View className="flex-row items-center">
        {/* 고른 조각을 덮는 상자. 조각마다 배경을 켰다 껐다 하는 대신 이것 하나가 옮겨 간다. */}
        <AnimatedBox
          testID="segment-thumb"
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              borderRadius: 999,
              backgroundColor: definition.primaryTint,
            },
            thumb.style,
          ]}
        />

        {props.options.map((option, index) => {
          const isSelected = option === props.selected
          return (
            <Pressable
              key={option}
              role="button"
              aria-label={option}
              aria-selected={isSelected}
              onLayout={(event) => thumb.onItemLayout(index, event)}
              // 이미 고른 것을 다시 눌러도 아무 일이 없어야 한다. `DifficultySegment` 와 같은 계약이다.
              onPress={() => {
                if (!isSelected) props.onSelect(option)
              }}
              className="rounded-full px-2.5 py-0.5"
            >
              {/* 글자색은 상자를 안 기다린다. 도착을 기다리면 누른 조각이 그동안 안 눌린
                  것처럼 보인다. */}
              <Text
                className={`text-11 font-semibold ${
                  isSelected ? 'text-primary-ink' : 'text-text-muted'
                }`}
              >
                {option}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
