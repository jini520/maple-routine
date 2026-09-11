/**
 * 화면 위쪽에서 **목록 전체를 가르는** 탭 알약. 주간/월간 · 일간/주간 · 전체/솔로/파티.
 *
 * 여섯 화면이 같은 클래스 문자열을 각자 베끼고 있던 것을 모은 부품이다. 폼 안의 `Segment` 와
 * 하는 일이 같고 크기와 색이 다르다.
 *
 * **색을 프롭으로 안 받는다.** 변형 축을 두면 다음 화면이 또 고르게 되고, 이 부품이 생긴 이유가
 * 그것이었다. 지금 색은 잠정이고 갈아탈 자리는 아래 상수 넷이다.
 */
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

/** 조각들을 담는 홈. 한 칸 파여 있어야 안에서 썸이 떠 보인다. */
const TRACK_CLASS = 'self-start flex-row items-center rounded-full bg-surface-2 p-0.5'

/** 조각 하나. 폼 안 `Segment` 보다 크다. 화면 위쪽에서 목록을 가르는 자리라서다. */
const ITEM_CLASS = 'rounded-full px-3.5 py-1'

const LABEL_ON_CLASS = 'text-sm font-semibold text-text'
const LABEL_OFF_CLASS = 'text-sm font-medium text-text-muted'

export function TabSegment<T extends string>(props: {
  options: readonly T[]
  /**
   * 고른 값. **`null` 을 안 받는다.** 이 부품이 서는 여섯 자리는 전부 기본값이 있다.
   * 아무것도 안 고른 상태가 필요하면 폼 안의 `Segment` 쪽이다.
   */
  selected: T
  onSelect: (value: T) => void
  /** 값과 다른 글자를 보일 때(`'weekly'` → `주간`). 안 주면 값을 그대로 적는다. */
  labelOf?: (value: T) => string
}): React.JSX.Element {
  const thumb = useSlidingThumb(props.options.indexOf(props.selected))
  const { definition } = useThemeAppearance()

  return (
    <View testID="tab-segment" className={TRACK_CLASS}>
      {/*
        안쪽 줄에 테두리도 여백도 없어야 한다. 조각이 알리는 `x` 와 아래 상자의 `left: 0` 이
        같은 지점에서 시작해야 상자가 조각 위에 정확히 겹친다.
      */}
      <View className="flex-row items-center">
        {/* 고른 조각을 덮는 상자. 조각마다 배경을 켰다 껐다 하는 대신 이것 하나가 옮겨 간다. */}
        <AnimatedBox
          testID="tab-segment-thumb"
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              borderRadius: 999,
              backgroundColor: definition.surface,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.12,
              shadowRadius: 3,
              elevation: 2,
            },
            thumb.style,
          ]}
        />

        {props.options.map((option, index) => {
          const isSelected = option === props.selected
          const label = props.labelOf === undefined ? option : props.labelOf(option)

          return (
            <Pressable
              key={option}
              role="button"
              // 눈으로 보는 글자와 같아야 한다. 값을 읽으면 스크린리더에 `weekly` 가 들린다.
              aria-label={label}
              aria-selected={isSelected}
              onLayout={(event) => thumb.onItemLayout(index, event)}
              // 이미 고른 것을 다시 눌러도 아무 일이 없어야 한다. `Segment` 와 같은 계약이다.
              // 두드림도 그 조건 안이다. 안 바뀌는 누름에 내면 손끝이 거짓을 말한다.
              onPress={() => {
                if (isSelected) return
                selectionFeedback()
                props.onSelect(option)
              }}
              className={ITEM_CLASS}
            >
              {/* 글자색은 상자를 안 기다린다. 도착을 기다리면 누른 조각이 그동안 안 눌린
                  것처럼 보인다. */}
              <Text className={isSelected ? LABEL_ON_CLASS : LABEL_OFF_CLASS}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
