import { Pressable, View } from 'react-native'

import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { tapFeedback } from '../../../native/haptics'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Text,
} from '../../atoms'

/** 화살표 하나. `disabled` 면 숨지 않고 흐리게 막힌다. */
export interface PeriodStepperArrow {
  /** 스크린리더가 읽는 이름. 무엇이 옮겨지는가(`이전 주` · `이번 달로 이동`). */
  label: string
  disabled?: boolean
  onPress: () => void
}

/** 시각 크기 28 과 권장 타깃 44 의 차이를 사방으로 나눈 몫. */
const HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 }

function Arrow(props: { arrow: PeriodStepperArrow; icon: typeof ChevronLeftIcon }): React.JSX.Element {
  const Icon = props.icon
  const disabled = props.arrow.disabled === true
  return (
    <Pressable
      role="button"
      aria-label={props.arrow.label}
      aria-disabled={disabled}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      onPress={() => {
        tapFeedback()
        props.arrow.onPress()
      }}
      className={`h-7 w-7 items-center justify-center rounded-full bg-control-track${disabled ? ' opacity-30' : ''}`}
    >
      <Icon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
    </Pressable>
  )
}

/**
 * 기간 이동 줄. 이전 화살표 옆에 기간 이름과 날짜를 한 줄로 두고, 다음 · 지금으로 이동은 오른쪽 끝에 두는 부품.
 *
 * @example
 * <PeriodStepper primary={label.primary} secondary={label.secondary} prev={...} next={...} jumpForward={...} />
 */
export function PeriodStepper(props: {
  primary: string
  secondary: string
  /** 지난해의 기간일 때 그 해. 이름 앞에 작은 글자로 선다. */
  year?: string | null
  prev: PeriodStepperArrow
  next: PeriodStepperArrow
  /** 지금 기간으로 가는 오른쪽 겹화살표. */
  jumpForward?: PeriodStepperArrow
  /** 미래 기간에서 지금으로 돌아오는 왼쪽 겹화살표. */
  jumpBack?: PeriodStepperArrow
  testID?: string
  labelTestID?: string
  rangeTestID?: string
  yearTestID?: string
}): React.JSX.Element {
  return (
    <View testID={props.testID} className="flex-row items-center gap-2 py-4">
      {props.jumpBack !== undefined && <Arrow arrow={props.jumpBack} icon={ChevronsLeftIcon} />}
      <Arrow arrow={props.prev} icon={ChevronLeftIcon} />
      <View className="min-w-0 flex-1 flex-row items-baseline">
        {props.year != null && (
          <Text testID={props.yearTestID} className="mr-1 text-11 font-semibold text-text-muted" style={TABULAR_NUMS}>
            {props.year}
          </Text>
        )}
        <Text testID={props.labelTestID} numberOfLines={1} className="shrink-0 text-sm font-bold text-text">
          {props.primary}
        </Text>
        {/* 월간의 지난 기간은 이름이 곧 날짜라 두 번 적지 않는다. */}
        {props.secondary !== props.primary && (
          <Text
            testID={props.rangeTestID}
            numberOfLines={1}
            className="ml-1.5 shrink text-11 text-text-muted"
            style={TABULAR_NUMS}
          >
            {props.secondary}
          </Text>
        )}
      </View>
      <Arrow arrow={props.next} icon={ChevronRightIcon} />
      {props.jumpForward !== undefined && <Arrow arrow={props.jumpForward} icon={ChevronsRightIcon} />}
    </View>
  )
}
