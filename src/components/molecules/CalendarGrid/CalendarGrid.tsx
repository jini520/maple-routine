/**
 * 달력 격자. **그리기만 한다**([[ADR-169]] 결정 7). 어떤 칸이 서는지는 `lib/calendar` 이 정한다.
 * 판정을 여기 두면 어느 규칙이 이 배치를 만들었는지 화면을 띄워야만 볼 수 있다.
 *
 * **월간과 주간이 같은 격자다**([[ADR-170]] 결정 11). `weeks` 에 주 하나만 넘기면 그대로 주간
 * 격자다. 갈리는 것은 요일 머리와 열지도 기준 둘뿐이고, 둘 다 밖에서 들어온다.
 *
 * 앞뒤 달 칸도 눌린다. 죽여 두면 보이는데 안 눌리는 칸이 생긴다. 달을 옮길지는 받는 쪽이
 * `monthKeyOf` 로 정한다. 격자는 자기가 어느 달인지 모른다.
 *
 * @see [[ADR-169]] 정정 1·3·4. 칸이 금액 두 줄 + 열지도가 된 경위가 거기 있다.
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
  /** 날짜 키 → 그날 금액. `features/cashbook/records` 의 `loadCalendarAmounts` 가 원천 넷을 접어 만든다. */
  readonly amounts: CalendarAmounts
  readonly onSelectDate: (dateKey: string) => void
  /**
   * 요일 머리. 기본은 월간의 일~토, 주간 보기는 `WEEKDAY_LABELS_RESET`(목~수)를 넘긴다.
   * 기본값을 둔 것은 월간 호출부를 안 바꾸기 위해서다. 틀리면 요일 이름이 바로 어긋나 보인다.
   */
  readonly weekdayLabels?: readonly string[]
  /**
   * 열지도 기준선. **기본값을 두지 않는 것이 요점이다**([[ADR-170]] 결정 12). 폴백이 있으면 주간
   * 호출부가 잊었을 때 받은 이레가 기준이 되고, 그럴듯한 색이라 화면에서 안 걸린다.
   */
  readonly incomeMax: number
}

const NO_AMOUNTS = { incomeMeso: 0, expenseMeso: 0 } as const

/** 단계 → 불투명도. 0 단계가 **정확히 0** 이어야 안 적은 날이 안 칠해진다. */
const HEAT_OPACITY: readonly number[] = [0, 0.1, 0.2, 0.3, 0.42]

/** 오늘과 고른 날은 같은 칸일 수 있어 표현을 나눈다. 채움이 고른 날, 테두리가 오늘이다. */
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
            const amounts = props.amounts[day.dateKey] ?? NO_AMOUNTS
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
                {/* 열지도 바탕. 형제보다 먼저 그려져 글자 뒤에 깔린다. **네 방향으로 같은 만큼**
                    물러난다([[ADR-169]] 정정 4). 좌우로만 물러나면 칠해진 날이 세로로 이어질 때
                    한 덩어리로 붙는다. `aria-hidden` 은 안 붙인다. RNTL 이 숨김 노드를 쿼리에서
                    걷어 테스트가 못 잡는다. */}
                <View
                  testID={`calendar-heat-${day.dateKey}`}
                  style={{ opacity: heat }}
                  className="absolute bottom-0.5 left-0.5 right-0.5 top-0.5 rounded-lg bg-primary"
                />

                {/* 안 고른 날의 이 View 는 배경도 테두리도 없어, RN 안드로이드가 그릴 것이 없다고
                    보고 네이티브 뷰 없이 접는다. 눌러서 `bg-primary` 가 붙는 순간 뷰를 새로 만드는데
                    거기에 `rounded-full` 이 안 실려 **네모로 그려진다**. 처음부터 고른 날로 마운트된
                    칸은 멀쩡해서 누른 칸에서만 났다(안드로이드 확인 2026-09-02). */}
                <View collapsable={false} className={dayCircleClass(isSelected, isToday)}>
                  <Text className={dayTextClass(isSelected, day.inPeriod)} style={TABULAR_NUMS}>
                    {day.day}
                  </Text>
                </View>

                {/* 빈 값이 `''` 가 아니라 **공백 한 칸**이다. 빈 문자열은 `Text` 높이를 0 으로
                    만들어, 칸 마흔둘 중 하나만 줄어도 격자와 그 아래가 통째로 튄다. */}
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
