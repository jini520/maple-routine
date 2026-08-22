/**
 * 달력 한 달의 격자 — **그리기만 한다**([[ADR-169]] 결정 7).
 *
 * 어떤 칸이 서는가(몇 주인가 · 앞뒤 달을 어디까지 채우나 · 진하기가 몇 단계인가)는
 * `lib/calendar-month` 이 정한다. 여기에 그 판정을 두면 «어느 규칙이 이 배치를 만들었나» 를
 * 화면을 띄워야만 볼 수 있다([[ADR-147]] 결정 8).
 *
 * ## 칸은 금액 두 줄이다 ([[ADR-169]] 정정 1)
 *
 * 처음에는 표식 두 개(점)였다. 사용자가 레퍼런스를 주며 *"단순 달력만 있는게 아니라 일별 데이터도
 * 함께 볼 수 있는 형태"* 를 지정했고(2026-08-23), 그 이미지가 «칸이 좁아 억 단위가 잘린다» 는
 * 근거를 반박했다 — **줄여 적으면 들어간다**(`lib/meso-compact`).
 *
 * 위 줄이 수익(`rise-ink`), 아래 줄이 지출(`fall-ink`)이다. **수익 줄은 0 도 «0» 으로 적고, 지출
 * 줄은 0 이면 비운다** — 사용자가 고른 시안 그대로다. 둘 다 값이 없어도 **자리는 차지한다**:
 * 칸이 마흔둘이라 한 줄만 생겨도 격자와 그 아래가 통째로 튄다.
 *
 * 지출 줄이 **메소만**인 이유는 `CalendarDayAmounts` 에 적어 뒀다(통화 셋을 앱이 못 합친다).
 *
 * ## 앞뒤 달 칸을 죽이지 않는다
 *
 * 누르면 그 날짜를 그대로 알린다. 죽여 두면 «보이는데 안 눌리는» 칸이 생기고, 달을 옮기는 판단은
 * 받는 쪽(화면)이 `monthKeyOf` 로 한다 — 격자는 자기가 어느 달인지도 모른다.
 */
import { Pressable, View } from 'react-native'

import { Text } from '../../atoms/Text/Text'
import {
  WEEKDAY_LABELS,
  formatDayLabel,
  heatLevel,
  monthIncomeMax,
  type CalendarAmounts,
  type CalendarWeek,
} from '../../../lib/calendar-month'
import { formatMesoCompact } from '../../../lib/meso-compact'
import { TABULAR_NUMS } from '../../../lib/text-styles'

export interface CalendarMonthProps {
  readonly weeks: readonly CalendarWeek[]
  readonly selectedDateKey: string
  readonly todayDateKey: string
  /**
   * 날짜 키 → 그날 금액. **공급원이 아직 없다**([[ADR-169]] 결정 6) — 지출은 [[ADR-166]] 의
   * `spend_records`(코드 0줄), 수익은 #239 가 만드는 «며칟날 잡았나» 가 채운다.
   */
  readonly amounts: CalendarAmounts
  readonly onSelectDate: (dateKey: string) => void
}

const NO_AMOUNTS = { incomeMeso: 0, expenseMeso: 0 } as const

/** 단계 → 불투명도. 0 단계는 **정확히 0** 이어야 «안 적은 날» 이 칠해지지 않는다. */
const HEAT_OPACITY: readonly number[] = [0, 0.1, 0.2, 0.3, 0.42]

/** 오늘과 고른 날은 **같은 칸일 수 있다** — 그래서 표현을 겹치지 않게 나눈다(채움 ↔ 테두리). */
function dayCircleClass(isSelected: boolean, isToday: boolean): string {
  const base = 'h-6 w-6 items-center justify-center rounded-full'
  if (isSelected) return `${base} bg-primary`
  if (isToday) return `${base} border border-primary`
  return base
}

function dayTextClass(isSelected: boolean, inMonth: boolean): string {
  const base = 'text-xs'
  if (isSelected) return `${base} font-semibold text-on-primary`
  return inMonth ? `${base} text-text` : `${base} text-text-disabled`
}

export function CalendarMonth(props: CalendarMonthProps): React.JSX.Element {
  const incomeMax = monthIncomeMax(props.weeks, props.amounts)

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
            const amounts = props.amounts[day.dateKey] ?? NO_AMOUNTS
            const heat = HEAT_OPACITY[heatLevel(amounts.incomeMeso, incomeMax)] ?? 0

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
                {/*
                  열지도 바탕. 형제보다 먼저 그려져 글자 뒤에 깔린다.

                  `aria-hidden` 을 **안 붙인다** — 글자가 없어 스크린리더가 읽을 것도 없는데,
                  붙이면 RNTL 이 이 노드를 숨김으로 보고 쿼리에서 걷어 테스트가 못 잡는다.
                */}
                <View
                  testID={`calendar-heat-${day.dateKey}`}
                  style={{ opacity: heat }}
                  className="absolute bottom-0 left-0.5 right-0.5 top-0 rounded-lg bg-primary"
                />

                <View className={dayCircleClass(isSelected, isToday)}>
                  <Text className={dayTextClass(isSelected, day.inMonth)} style={TABULAR_NUMS}>
                    {day.day}
                  </Text>
                </View>

                {/* 두 줄은 값이 없어도 자리를 차지한다([[ADR-169]] 정정 1). */}
                <Text
                  testID={`calendar-income-${day.dateKey}`}
                  numberOfLines={1}
                  className="text-[9px] leading-3 text-rise-ink"
                  style={TABULAR_NUMS}
                >
                  {amounts.incomeMeso > 0 ? `+${formatMesoCompact(amounts.incomeMeso)}` : '0'}
                </Text>
                <Text
                  testID={`calendar-expense-${day.dateKey}`}
                  numberOfLines={1}
                  className="text-[9px] leading-3 text-fall-ink"
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
  )
}
