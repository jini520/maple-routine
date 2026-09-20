/**
 * 날짜 하나를 고르는 누르개. **글자와 알약이 한 누름 자리**다.
 *
 * `‹ ›` 화살표로 하루씩 옮기던 자리를 대신한다. 화살표는 먼 날로 갈 때 여러 번 눌러야 하고, 지금
 * 고른 날이 어느 달인지도 안 말한다. 누르면 달력이 열린다(`CalendarPopover`).
 *
 * 왼쪽 `변경` 글자와 그 아래 점선이 **바꿀 수 있다**는 말을 한다. 알약만 두면 값처럼 읽혀 아무도
 * 안 누른다(사용자 확인 2026-09-18). 점선을 글자 밑줄이 아니라 뷰로 그리는 것은 RN 이 글자에
 * 점선을 못 긋기 때문이고, 아이템 수익 금액이 쓰는 그 방식이다.
 *
 * @example
 * <DateSelect ref={anchorRef} dateKey="2026-09-18" label="잡은 날" onPress={popover.toggle} />
 */
import { forwardRef } from 'react'
import { Pressable, View } from 'react-native'

import { CalendarIcon, Text } from '../../atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { formatDayLabel } from '../../../lib/calendar'

export interface DateSelectProps {
  /** 고른 날(KST `YYYY-MM-DD`). */
  dateKey: string
  /** 읽어 주는 이름의 뿌리. `잡은 날 고르기` 처럼 읽힌다. */
  label: string
  onPress: () => void
  /** 날짜 글자의 `testID`. */
  testID?: string
}

export const DateSelect = forwardRef<View, DateSelectProps>(function DateSelect(props, ref) {
  return (
    <Pressable
      ref={ref}
      role="button"
      aria-label={`${props.label} 고르기`}
      onPress={props.onPress}
      className="shrink-0 flex-row items-center gap-2 active:opacity-60"
    >
      <View className="items-center">
        <Text className="text-xs font-semibold text-text-muted">변경</Text>
        {/* 글자 바로 아래 1px. 점선은 뷰로 그린다(RN 은 글자에 점선을 못 긋는다). */}
        <View className="mt-px w-full border-b border-dashed border-text-muted" />
      </View>

      <View className="flex-row items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
        <CalendarIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden />
        <Text testID={props.testID} className="text-xs text-text" style={TABULAR_NUMS}>
          {formatDayLabel(props.dateKey)}
        </Text>
      </View>
    </Pressable>
  )
})
