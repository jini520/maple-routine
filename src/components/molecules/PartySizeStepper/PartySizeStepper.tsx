import { MinusIcon, PlusIcon, Text, UsersIcon } from '../../atoms'
import { Pressable, View } from 'react-native'

import { TABULAR_NUMS } from '../../../constants/style/text-styles'

const SIZES = {
  compact: {
    root: 'flex-row shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface py-0.5 pl-2 pr-1',
    button: 'h-6 w-6',
    icon: 'h-3.5 w-3.5',
    valueSlot: 'w-5 justify-center',
    value: 'text-sm font-semibold',
    marker: 'h-3.5 w-3.5',
  },
  default: {
    root: 'flex-row h-10 items-center justify-between rounded-full border border-border bg-surface p-1',
    button: 'h-8 w-8',
    icon: 'h-4 w-4',
    // min-w 고정 + tabular-nums 라 1↔6 을 오가도 −/+ 가 제자리에 있다.
    valueSlot: 'min-w-[66px] justify-center gap-0.5',
    value: 'text-19 font-extrabold leading-none tracking-[-.03em]',
    marker: null,
  },
} as const

/** 시각 크기(24·32px)와 권장 타깃(44px)의 차이를 사방으로 나눠 채운다. */
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 }

export function PartySizeStepper(props: {
  /** aria-label 접두 — 목록에서 어느 행의 스테퍼인지 구분한다(보스명). */
  label: string
  value: number
  max: number
  onChange: (next: number) => void
  size?: keyof typeof SIZES
}): React.JSX.Element {
  const size = SIZES[props.size ?? 'default']
  const buttonClass = `${size.button} items-center justify-center rounded-full`

  const canDecrease = props.value > 1
  const canIncrease = props.value < props.max

  return (
    <View className={size.root}>
      {/* default 는 라벨 줄에 Users 가 따로 서므로 안에 두지 않는다 — 한 화면에 두 번 나오면 중복이다. */}
      {size.marker !== null && (
        <UsersIcon className={`${size.marker} text-text-muted`} strokeWidth={2} aria-hidden />
      )}
      <Pressable
        role="button"
        onPress={() => props.onChange(props.value - 1)}
        disabled={!canDecrease}
        hitSlop={HIT_SLOP}
        aria-label={`${props.label} 파티원 수 감소`}
        className={`${buttonClass}${canDecrease ? '' : ' opacity-40'}`}
      >
        <MinusIcon className={`${size.icon} text-text`} strokeWidth={2} aria-hidden />
      </Pressable>

      {/* **단위를 안 적는다**([[ADR-173]] 결정 18, 사용자 지정 2026-08-27) — 이 앱의 스테퍼는
          숫자만 오르내린다. 무엇을 세는지는 곁의 라벨과 `Users` 표식이 말한다. */}
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
        <PlusIcon className={`${size.icon} text-text`} strokeWidth={2} aria-hidden />
      </Pressable>
    </View>
  )
}
