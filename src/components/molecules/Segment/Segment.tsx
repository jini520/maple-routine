import { Pressable, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { useSlidingThumb } from '../../../hooks/useSlidingThumb'
import { selectionFeedback } from '../../../native/haptics'
import { Text } from '../../atoms'

/**
 * 애니메이션이 붙는 상자. `nativewind-interop` 에 등록된 `Animated.View` 를 쓰지 않는다.
 *
 * 등록된 컴포넌트에 정적 스타일과 애니메이션 스타일을 한 배열로 넘기면 정적 쪽이 사라진다.
 * 대가는 **`className` 이 아무 일도 안 한다**는 것이라, 자리는 `style` 로 주고 색은 안쪽
 * `View` 의 `className` 이 칠한다. 색이 변수를 거쳐야 시트 안에서 다시 계산된 값을 받는다.
 */
const AnimatedBox = Animated.createAnimatedComponent(View)

/** 고른 칸의 그림자. 트랙에서 떠 보이게 하는 몫이다. */
const THUMB_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.12,
  shadowRadius: 3,
  elevation: 2,
} as const

/**
 * 크기 네 벌. 상자 여백은 그대로 두고 **조각과 글자만** 키운다.
 *
 * 상자 여백(`p-0.5`)까지 줄이면 미끄러지는 상자가 트랙 끝에 붙어 눌린 조각이 잘려 보인다.
 */
const SIZES = {
  /** 줄 안의 **곁 고르개**. 입력 카드의 금액 단위와 수수료가 쓴다. 높이 23 이다. */
  sm: { piece: 'px-2 py-px', label: 'text-11 leading-[15px]', track: '' },
  default: { piece: 'px-2.5 py-0.5', label: 'text-11', track: '' },
  /** 줄의 **주 고르개**. 파티 모달의 `분배` 가 쓴다. */
  md: { piece: 'px-3.5 py-1', label: 'text-xs', track: '' },
  /** 화면 머리의 주기 · 필터 탭. 세로로 쌓는 부모 안에서 트랙이 폭을 다 먹지 않게 `self-start` 다. */
  tab: { piece: 'px-3.5 py-1', label: 'text-sm', track: 'self-start' },
} as const

export function Segment<T extends string>(props: {
  options: readonly T[]
  /** `null` 이면 **아무것도 안 골랐다**. 형태처럼 기본값을 안 정하는 자리가 있다. */
  selected: T | null
  onSelect: (value: T) => void
  /** 값과 다른 글자를 보일 때(`'weekly'` → `주간`). 안 주면 값을 그대로 적는다. */
  labelOf?: (value: T) => string
  /** 잠긴 줄. 상자째 흐리고 조각이 안 눌린다. 고를 값이 남은 항목에 없을 때 쓴다. */
  disabled?: boolean
  size?: keyof typeof SIZES
}): React.JSX.Element {
  const size = SIZES[props.size ?? 'default']
  const selectedIndex = props.selected === null ? -1 : props.options.indexOf(props.selected)
  const thumb = useSlidingThumb(selectedIndex)

  return (
    <View
      testID="segment"
      className={`flex-row items-center rounded-full bg-control-track p-0.5 ${size.track} ${
        props.disabled === true ? 'opacity-40' : ''
      }`}
    >
      {/*
        안쪽 줄에 여백이 없어야 한다. 조각이 알리는 `x` 와 아래 상자의 `left: 0` 이
        같은 지점에서 시작해야 상자가 조각 위에 정확히 겹친다.
      */}
      <View className="flex-row items-center">
        {/* 고른 조각을 덮는 상자. 조각마다 배경을 켰다 껐다 하는 대신 이것 하나가 옮겨 간다. */}
        <AnimatedBox
          testID="segment-thumb"
          pointerEvents="none"
          style={[{ position: 'absolute', left: 0, top: 0, bottom: 0 }, thumb.style]}
        >
          <View
            testID="segment-thumb-fill"
            className="flex-1 rounded-full bg-control-thumb"
            style={THUMB_SHADOW}
          />
        </AnimatedBox>

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
              disabled={props.disabled}
              onLayout={(event) => thumb.onItemLayout(index, event)}
              onPress={() => {
                if (isSelected || props.disabled === true) return
                selectionFeedback()
                props.onSelect(option)
              }}
              className={`rounded-full ${size.piece}`}
            >
              {/* 글자색은 상자를 안 기다린다. 도착을 기다리면 누른 조각이 그동안 안 눌린
                  것처럼 보인다. */}
              <Text
                className={`${size.label} ${
                  isSelected ? 'font-semibold text-text' : 'font-medium text-control-ink-off'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
