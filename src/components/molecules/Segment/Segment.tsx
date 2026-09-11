import { Pressable, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { useSlidingThumb } from '../../../hooks/useSlidingThumb'
import { selectionFeedback } from '../../../native/haptics'
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
  /**
   * 시스템 글자 크기를 **안 따르나**. 이 부품은 상자가 자리마다 갈려 호출부가 정한다.
   *
   * 폼 안과 설정에서는 상자가 글자를 따라 커지므로 배수를 그대로 받아야 하고, 높이가 못박힌
   * today 타일 안에서는 배수를 받으면 알약이 타일을 넘는다. 기본값이 거짓인 것은 **무시하는
   * 쪽이 예외**여서다.
   */
  fixed?: boolean
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
              // 두드림도 그 조건 안이다. 안 바뀌는 누름에 내면 손끝이 거짓을 말한다.
              onPress={() => {
                if (isSelected) return
                selectionFeedback()
                props.onSelect(option)
              }}
              className="rounded-full px-2.5 py-0.5"
            >
              {/* 글자색은 상자를 안 기다린다. 도착을 기다리면 누른 조각이 그동안 안 눌린
                  것처럼 보인다. */}
              <Text
                fixed={props.fixed}
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
