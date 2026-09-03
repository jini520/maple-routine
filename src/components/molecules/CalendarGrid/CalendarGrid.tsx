/**
 * 달력 격자. **그리기만 한다**. 어떤 칸이 서는지는 `lib/calendar` 이 정하고,
 * `weeks` 에 주 하나만 넘기면 그대로 주간 격자다.
 *
 * 앞뒤 달 칸도 눌린다. 달을 옮길지는 받는 쪽이 정한다.
 *
 * @see. 칸이 금액 두 줄 + 열지도가 된 경위.
 */
import { Pressable, View } from 'react-native'

import { Text } from '../../atoms'
import {
  WEEKDAY_LABELS,
  formatDayLabel,
  heatLevel,
  type CalendarAmounts,
  type CalendarWeek,
} from '../../../lib/calendar'
import { formatMesoCompact } from '../../../lib/cashbook/meso-compact'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'

export interface CalendarGridProps {
  readonly weeks: readonly CalendarWeek[]
  readonly selectedDateKey: string
  readonly todayDateKey: string
  /** 날짜 키 → 그날 금액. `features/cashbook/records` 의 `loadCalendarAmounts` 가 만든다. */
  readonly amounts: CalendarAmounts
  readonly onSelectDate: (dateKey: string) => void
  /** 요일 머리. 기본은 월간의 일~토, 주간은 `WEEKDAY_LABELS_RESET`(목~수)를 넘긴다. */
  readonly weekdayLabels?: readonly string[]
  /**
   * 열지도 기준선. **기본값을 두지 않는다**. 폴백이 있으면 주간 호출부가
   * 잊었을 때 받은 이레가 기준이 되는데, 색이 그럴듯해서 화면에서 안 걸린다.
   */
  readonly incomeMax: number
}

const NO_AMOUNTS = { incomeMeso: 0, expenseMeso: 0 } as const

/** 단계 → 불투명도. 0 단계가 **정확히 0** 이어야 안 적은 날이 안 칠해진다. */
const HEAT_OPACITY: readonly number[] = [0, 0.1, 0.2, 0.3, 0.42]

/** 오늘과 고른 날은 같은 칸일 수 있어 나눈다. 채움이 고른 날, 테두리가 오늘이다. */
function dayCircleClass(isSelected: boolean, isToday: boolean): string {
  const base = 'h-6 w-6 items-center justify-center rounded-full'
  if (isSelected) return `${base} bg-primary`
  if (isToday) return `${base} border border-primary`
  return base
}

function dayTextClass(isSelected: boolean, inPeriod: boolean): string {
  const base = 'text-xs'
  if (isSelected) return `${base} font-semibold text-on-primary`
  return inPeriod ? `${base} text-text` : `${base} text-text-disabled`
}

export function CalendarGrid(props: CalendarGridProps): React.JSX.Element {
  const weekdayLabels = props.weekdayLabels ?? WEEKDAY_LABELS

  return (
    <View>
      <View className="flex-row">
        {weekdayLabels.map((label) => (
          <Text key={label} className="flex-1 text-center text-xs text-text-muted">
            {label}
          </Text>
        ))}
      </View>

      <View>
        {props.weeks.map((week) => (
        <View key={week[0]?.dateKey} className="flex-row">
          {week.map((day) => {
            const isSelected = day.dateKey === props.selectedDateKey
            const isToday = day.dateKey === props.todayDateKey
            // 앞뒤 달 칸은 0 으로 본다. 그 돈은 `periodTotals` 에도 `monthIncomeMax` 에도 안 들어가서,
            // 칸에만 남으면 ‘9월 수익’ 아래 8월 숫자가 선다. 금액 두 줄도 열지도도 이 값에서 나온다.
            const amounts = day.inPeriod ? (props.amounts[day.dateKey] ?? NO_AMOUNTS) : NO_AMOUNTS
            const heat = HEAT_OPACITY[heatLevel(amounts.incomeMeso, props.incomeMax)] ?? 0

            return (
              <Pressable
                key={day.dateKey}
                testID={`calendar-day-${day.dateKey}`}
                role="button"
                // 오늘은 이름으로도 갈린다. 채움과 테두리 차이는 스크린리더에 안 들린다.
                aria-label={isToday ? `${formatDayLabel(day.dateKey)} 오늘` : formatDayLabel(day.dateKey)}
                aria-selected={isSelected}
                onPress={() => props.onSelectDate(day.dateKey)}
                className="flex-1 items-center py-1"
              >
                {/* 열지도 바탕. 형제보다 먼저라 글자 뒤에 깔린다. **네 방향으로 같은 만큼** 물러난다
                    . 좌우로만 물러나면 칠해진 날이 세로로 붙는다. */}
                <View
                  testID={`calendar-heat-${day.dateKey}`}
                  style={{ opacity: heat }}
                  className="absolute bottom-0.5 left-0.5 right-0.5 top-0.5 rounded-lg bg-primary"
                />

                {/* 안 고른 날은 그릴 것이 없어 안드로이드가 이 View 를 접는다. 그 뒤 `bg-primary` 가
                    붙으면 `rounded-full` 이 안 실려 **네모가 된다**(`design-system.md` 의 ‘접는다’ 절). */}
                <View collapsable={false} className={dayCircleClass(isSelected, isToday)}>
                  <Text className={dayTextClass(isSelected, day.inPeriod)} style={TABULAR_NUMS}>
                    {day.day}
                  </Text>
                </View>

                {/* 빈 값이 `''` 가 아니라 **공백 한 칸**이다. 빈 문자열은 `Text` 높이를 0 으로 만든다. */}
                <Text
                  testID={`calendar-income-${day.dateKey}`}
                  numberOfLines={1}
                  className="text-9 leading-3 text-rise-ink"
                  style={TABULAR_NUMS}
                >
                  {amounts.incomeMeso > 0 ? `+${formatMesoCompact(amounts.incomeMeso)}` : ' '}
                </Text>
                <Text
                  testID={`calendar-expense-${day.dateKey}`}
                  numberOfLines={1}
                  className="text-9 leading-3 text-fall-ink"
                  style={TABULAR_NUMS}
                >
                  {amounts.expenseMeso > 0 ? `−${formatMesoCompact(amounts.expenseMeso)}` : ' '}
                </Text>
              </Pressable>
            )
          })}
          </View>
        ))}
      </View>
    </View>
  )
}
