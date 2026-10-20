import { Pressable, View } from 'react-native'

import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { boxShadowOf, type ShadowLayer } from '../../../lib/shadow'
import { useThemeAppearance } from '../../../theme/context'
import { MinusIcon, PlusIcon, Text } from '../../atoms'

/** 크기 셋. 모양은 같고 치수만 다르다. */
const SIZES = {
  sm: { button: 'h-6 w-6', icon: 'h-2.5 w-2.5', value: 'w-6 text-xs font-bold' },
  md: { button: 'h-8 w-8', icon: 'h-3 w-3', value: 'w-8 text-15 font-bold' },
  lg: { button: 'h-9 w-9', icon: 'h-3.5 w-3.5', value: 'w-10 text-19 font-bold' },
} as const

/** 버튼이 트랙에서 떠 보이게 하는 옅은 그림자. 테두리를 쓰지 않으므로 이것이 버튼의 경계다. */
const BUTTON_SHADOW: ShadowLayer = { opacity: 0.3, radius: 1, y: 1 }

/** 시각 크기와 권장 타깃(44px)의 차이를 사방으로 나눈 몫. */
const HIT_SLOP = { top: 8, bottom: 8, left: 6, right: 6 }

/** `−` · 숫자 · `+` 고르개. 숫자만 적고 단위는 곁의 라벨이 말한다. */
export function Stepper(props: {
  /** 읽는 이름의 뿌리. 버튼은 `{label} 감소` · `{label} 증가` 로 읽힌다. */
  label: string
  value: number
  onChange: (next: number) => void
  /** 더 못 내려가는 값. 기본 1. */
  min?: number
  /** 더 못 올라가는 값. 없으면 `+` 를 막지 않는다. */
  max?: number
  size?: keyof typeof SIZES
  /** 주면 가운데 숫자를 눌러 직접 칠 수 있다. */
  onPressValue?: () => void
  /** 가운데 숫자에 붙는다. 누를 수 있으면 누르는 칸에 붙는다. */
  testID?: string
}): React.JSX.Element {
  const size = SIZES[props.size ?? 'md']
  const { definition } = useThemeAppearance()
  const min = props.min ?? 1
  const canDecrease = props.value > min
  const canIncrease = props.max === undefined || props.value < props.max
  const buttonStyle = { boxShadow: boxShadowOf(definition.shadowColor, BUTTON_SHADOW) }

  const pressableValue = props.onPressValue !== undefined
  const value = (
    <Text
      testID={pressableValue ? undefined : props.testID}
      className={`text-center ${size.value} ${props.value < min ? 'text-text-disabled' : 'text-text'}`}
      style={TABULAR_NUMS}
    >
      {props.value.toLocaleString()}
    </Text>
  )

  return (
    // 가로 줄로 한 번 감싸 알약이 내용 폭만 차지하게 한다. 세로로 쌓는 부모가 트랙을 바로 늘이면 트랙만
    // 길어지고 버튼은 한쪽에 몰린다. `self-start` 로 막으면 가로 줄 부모 안에서 위로 붙는다.
    <View className="shrink-0 flex-row">
      <View testID="stepper-track" className="flex-row items-center rounded-full bg-bg p-0.5">
        <Pressable
          role="button"
          aria-label={`${props.label} 감소`}
          disabled={!canDecrease}
          onPress={() => props.onChange(props.value - 1)}
          hitSlop={HIT_SLOP}
          // RN 의 `disabled` 는 모양을 바꾸지 않는다. 흐리지 않으면 막힌 버튼이 멀쩡해 보인다.
          style={canDecrease ? buttonStyle : { ...buttonStyle, opacity: 0.4 }}
          className={`${size.button} items-center justify-center rounded-full bg-surface`}
        >
          <MinusIcon className={`${size.icon} text-text-muted`} strokeWidth={2.5} aria-hidden />
        </Pressable>

        {pressableValue ? (
          <Pressable
            testID={props.testID}
            role="button"
            aria-label={props.label}
            onPress={props.onPressValue}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            {value}
          </Pressable>
        ) : (
          value
        )}

        <Pressable
          role="button"
          aria-label={`${props.label} 증가`}
          disabled={!canIncrease}
          onPress={() => props.onChange(props.value + 1)}
          hitSlop={HIT_SLOP}
          style={canIncrease ? buttonStyle : { ...buttonStyle, opacity: 0.4 }}
          className={`${size.button} items-center justify-center rounded-full bg-surface`}
        >
          <PlusIcon className={`${size.icon} text-text-muted`} strokeWidth={2.5} aria-hidden />
        </Pressable>
      </View>
    </View>
  )
}
