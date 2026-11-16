/**
 * 날짜 하나를 고르는 누르개. **글자와 알약이 한 누름 자리**다.
 *
 * `‹ ›` 화살표로 하루씩 옮기던 자리를 대신한다. 화살표는 먼 날로 갈 때 여러 번 눌러야 하고, 지금
 * 고른 날이 어느 달인지도 안 말한다. 누르면 달력이 열린다(`CalendarPopover`).
 *
 * 알약 끝의 아래 화살표가 **바꿀 수 있다**는 말을 한다. 알약만 두면 값처럼 읽혀 아무도 안 누른다.
 * 화살표는 앱의 드롭다운과 같은 신호라 누르면 무언가 열린다고 읽힌다.
 *
 * @example
 * <DateSelect ref={anchorRef} dateKey="2026-09-18" label="잡은 날" onPress={popover.toggle} />
 */
import { forwardRef } from 'react'
import { Pressable, View } from 'react-native'

import { CalendarIcon, ChevronDownIcon, Text } from '../../atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { formatDayLabel } from '../../../lib/calendar'

export interface DateSelectProps {
  /** 고른 날(KST `YYYY-MM-DD`). */
  dateKey: string
  /** 읽어 주는 이름의 뿌리. `잡은 날 고르기` 처럼 읽힌다. */
  label: string
  /** `readOnly` 이면 부르지 않는다 */
  onPress?: () => void
  /** 날짜 글자의 `testID`. */
  testID?: string
  /** 날짜 대신 적을 글자. 기간(`7월 2일 ~ 7월 15일`)이나 아직 안 고른 자리(`주 선택`)가 쓴다 */
  text?: string
  /** 아직 안 고른 자리라 흐린 글자로 적는다 */
  placeholder?: boolean
  /** 바꿀 수 없는 날짜. 화살표를 빼고 누르지 못하게 한다. 화살표가 바꿀 수 있다는 신호라서다 */
  readOnly?: boolean
}

export const DateSelect = forwardRef<View, DateSelectProps>(function DateSelect(props, ref) {
  const pill = (
    // 스테퍼 트랙과 같은 반투명 바탕이라 놓이는 자리마다 색을 고르지 않는다.
    <View
      testID="date-select-pill"
      className={`flex-row items-center gap-1.5 rounded-full bg-control-track py-1 pl-2.5 ${props.readOnly === true ? 'pr-2.5' : 'pr-2'}`}
    >
      <CalendarIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden />
      <Text
        testID={props.testID}
        className={`text-xs ${props.placeholder === true ? 'text-text-disabled' : 'text-text'}`}
        style={TABULAR_NUMS}
      >
        {props.text ?? formatDayLabel(props.dateKey)}
      </Text>
      {props.readOnly !== true && <ChevronDownIcon className="h-3 w-3 text-text-muted" strokeWidth={2.25} aria-hidden />}
    </View>
  )
  if (props.readOnly === true) {
    return (
      <View ref={ref} className="shrink-0" aria-label={props.text ?? formatDayLabel(props.dateKey)}>
        {pill}
      </View>
    )
  }
  return (
    <Pressable ref={ref} role="button" aria-label={`${props.label} 고르기`} onPress={props.onPress} className="shrink-0">
      {pill}
    </Pressable>
  )
})
