/**
 * 달력 한 달의 격자 — **그리기만 한다**([[ADR-169]] 결정 7).
 *
 * 어떤 칸이 서는가(몇 주인가 · 앞뒤 달을 어디까지 채우나)는 `lib/calendar-month` 이 정한다. 여기에
 * 그 판정을 두면 «어느 규칙이 이 배치를 만들었나» 를 화면을 띄워야만 볼 수 있다([[ADR-147]] 결정 8).
 *
 * ## 칸에 금액을 넣지 않는다
 *
 * [[ADR-166]] 결정 1 이 **통화 셋을 합치지 않으므로** 환율을 안 넣은 사용자에게 한 칸에 들어갈
 * «한 숫자»가 존재하지 않고, 칸 너비는 화면 폭 ÷ 7 이라 억 단위가 잘린다([[ADR-165]] 가 「남은
 * 스케줄」 **두 자리**에서 이미 겪었다). 그래서 칸이 나르는 것은 **표식 둘**이다 —
 * 수익(`rise-ink`) · 지출(`fall-ink`), [[ADR-169]] 결정 5.
 *
 * 표식 줄은 **비어 있어도 자리를 차지한다**([[ADR-168]] 정정 1 과 같은 이유). 칸이 마흔둘이라
 * 표식이 들어올 때 줄 높이가 바뀌면 격자와 그 아래가 통째로 튄다.
 *
 * ## 앞뒤 달 칸을 죽이지 않는다
 *
 * 누르면 그 날짜를 그대로 알린다. 죽여 두면 «보이는데 안 눌리는» 칸이 생기고, 달을 옮기는 판단은
 * 받는 쪽(화면)이 `monthKeyOf` 로 한다 — 격자는 자기가 어느 달인지도 모른다.
 */
import { Pressable, View } from 'react-native'

import { Text } from '../../atoms/Text/Text'
import { WEEKDAY_LABELS, formatDayLabel, type CalendarWeek } from '../../../lib/calendar-month'
import { TABULAR_NUMS } from '../../../lib/text-styles'

export interface CalendarMarks {
  readonly income: boolean
  readonly expense: boolean
}

export interface CalendarMonthProps {
  readonly weeks: readonly CalendarWeek[]
  readonly selectedDateKey: string
  readonly todayDateKey: string
  /**
   * 날짜 키 → 표식. **공급원이 아직 없다**([[ADR-169]] 결정 6) — 지출은 [[ADR-166]] 의
   * `spend_records`(코드 0줄), 수익은 #239 가 만드는 «며칟날 잡았나» 가 채운다. 지우지 말고 채울 것.
   */
  readonly marks: Readonly<Record<string, CalendarMarks>>
  readonly onSelectDate: (dateKey: string) => void
}

const NO_MARKS: CalendarMarks = { income: false, expense: false }

/** 오늘과 고른 날은 **같은 칸일 수 있다** — 그래서 표현을 겹치지 않게 나눈다(채움 ↔ 테두리). */
function dayCircleClass(isSelected: boolean, isToday: boolean): string {
  const base = 'h-8 w-8 items-center justify-center rounded-full'
  if (isSelected) return `${base} bg-primary`
  if (isToday) return `${base} border border-primary`
  return base
}

function dayTextClass(isSelected: boolean, inMonth: boolean): string {
  const base = 'text-sm'
  if (isSelected) return `${base} font-semibold text-on-primary`
  return inMonth ? `${base} text-text` : `${base} text-text-disabled`
}

export function CalendarMonth(props: CalendarMonthProps): React.JSX.Element {
  return (
    <View>
      <View className="flex-row">
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} className="flex-1 text-center text-xs text-text-muted">
            {label}
          </Text>
        ))}
      </View>

      {props.weeks.map((week) => (
        <View key={week[0]?.dateKey} className="flex-row">
          {week.map((day) => {
            const isSelected = day.dateKey === props.selectedDateKey
            const isToday = day.dateKey === props.todayDateKey
            const mark = props.marks[day.dateKey] ?? NO_MARKS

            return (
              <Pressable
                key={day.dateKey}
                testID={`calendar-day-${day.dateKey}`}
                role="button"
                // 오늘은 이름으로도 갈린다 — 채움/테두리 차이는 스크린리더에 안 들린다.
                aria-label={isToday ? `${formatDayLabel(day.dateKey)} 오늘` : formatDayLabel(day.dateKey)}
                aria-selected={isSelected}
                onPress={() => props.onSelectDate(day.dateKey)}
                className="flex-1 items-center py-1"
              >
                <View className={dayCircleClass(isSelected, isToday)}>
                  <Text className={dayTextClass(isSelected, day.inMonth)} style={TABULAR_NUMS}>
                    {day.day}
                  </Text>
                </View>

                {/* 비어도 자리를 차지한다([[ADR-169]] 결정 5). */}
                <View
                  testID={`calendar-marks-${day.dateKey}`}
                  className="mt-1 h-1.5 flex-row items-center justify-center gap-1"
                >
                  {mark.income && (
                    <View
                      testID={`calendar-mark-income-${day.dateKey}`}
                      className="h-1.5 w-1.5 rounded-full bg-rise-ink"
                    />
                  )}
                  {mark.expense && (
                    <View
                      testID={`calendar-mark-expense-${day.dateKey}`}
                      className="h-1.5 w-1.5 rounded-full bg-fall-ink"
                    />
                  )}
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}
