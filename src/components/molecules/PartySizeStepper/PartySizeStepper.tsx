import { MinusIcon, PlusIcon, Text } from '../../atoms'
import { Pressable, View } from 'react-native'

import { TABULAR_NUMS } from '../../../constants/style/text-styles'

/**
 * 크기 두 벌. **표식은 안 그린다** - 두 크기 모두 곁에 라벨이 서는 자리에만 쓰여서, 안에 또
 * 넣으면 한 줄에 같은 말이 두 번 나온다.
 */
const SIZES = {
  compact: {
    root: 'flex-row shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface py-0.5 pl-2 pr-1',
    button: 'h-6 w-6',
    icon: 'h-3.5 w-3.5 text-text',
    valueSlot: 'w-6 justify-center',
    value: 'text-sm font-semibold',
  },
  /**
   * 바탕 알약 없이 **낱개 원 버튼 둘**. 제 바탕을 이미 깐 상자 안에 서는 자리다(드롭 가격 카드의
   * 분배 칸). 알약을 또 깔면 상자가 둘로 보인다. `ShareField` 의 합 스테퍼와 같은 모양이라
   * `기본` 과 `비율` 을 오가도 그 칸의 아랫줄이 안 흔들린다.
   */
  bare: {
    root: 'flex-row shrink-0 items-center justify-center gap-2.5',
    button: 'h-[26px] w-[26px] border border-border',
    icon: 'h-3.5 w-3.5 text-text-muted',
    valueSlot: 'min-w-3 justify-center',
    value: 'text-15 font-bold',
  },
  default: {
    root: 'flex-row h-10 items-center justify-between rounded-full border border-border bg-surface p-1',
    button: 'h-8 w-8',
    icon: 'h-4 w-4 text-text',
    // min-w 고정 + tabular-nums 라 1↔6 을 오가도 −/+ 가 제자리에 있다.
    valueSlot: 'min-w-[66px] justify-center gap-0.5',
    value: 'text-19 font-bold leading-none tracking-[-.03em]',
  },
} as const

/** 시각 크기(24·32px)와 권장 타깃(44px)의 차이를 사방으로 나눈 몫. */
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 }

export function PartySizeStepper(props: {
  /** aria-label 접두. 목록에서 어느 행의 스테퍼인지 구분한다(보스명). */
  label: string
  value: number
  max: number
  /** 더 못 내려가는 값. 기본 1. 비율 합은 2 다(혼자면 나눌 것이 없다). */
  min?: number
  onChange: (next: number) => void
  size?: keyof typeof SIZES
}): React.JSX.Element {
  const size = SIZES[props.size ?? 'default']
  const buttonClass = `${size.button} items-center justify-center rounded-full`

  const canDecrease = props.value > (props.min ?? 1)
  const canIncrease = props.value < props.max

  return (
    <View testID="party-size-stepper" className={size.root}>
      <Pressable
        role="button"
        onPress={() => props.onChange(props.value - 1)}
        disabled={!canDecrease}
        hitSlop={HIT_SLOP}
        aria-label={`${props.label} 파티원 수 감소`}
        className={`${buttonClass}${canDecrease ? '' : ' opacity-40'}`}
      >
        <MinusIcon className={size.icon} strokeWidth={2} aria-hidden />
      </Pressable>

      {/* 단위를 안 적는다. 이 앱의 스테퍼는 숫자만 오르내린다. 무엇을 세는지는 곁의 라벨과
          `Users` 표식이 말한다. */}
      <View className={`flex-row items-baseline ${size.valueSlot}`}>
        <Text className={`text-text ${size.value}`} style={TABULAR_NUMS}>
          {props.value}
        </Text>
      </View>

      <Pressable
        role="button"
        onPress={() => props.onChange(props.value + 1)}
        disabled={!canIncrease}
        hitSlop={HIT_SLOP}
        aria-label={`${props.label} 파티원 수 증가`}
        className={`${buttonClass}${canIncrease ? '' : ' opacity-40'}`}
      >
        <PlusIcon className={size.icon} strokeWidth={2} aria-hidden />
      </Pressable>
    </View>
  )
}
