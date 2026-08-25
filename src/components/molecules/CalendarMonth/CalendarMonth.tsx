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
 * 위 줄이 수익(`rise-ink`), 아래 줄이 지출(`fall-ink`)이다. **둘 다 0 이면 비운다**
 * ([[ADR-169]] 정정 3, 사용자 지정 2026-08-25). 처음에는 수익 줄만 «0» 을 적었는데(고른 시안이
 * 그랬다), 아무것도 안 한 날이 대부분이라 격자가 «0» 으로 뒤덮여 **실제 숫자가 그 사이에 묻혔다.**
 *
 * **비어도 자리는 차지한다** — 칸이 마흔둘이라 한 줄만 사라져도 격자와 그 아래가 통째로 튄다.
 * 그래서 빈 값이 `''` 가 아니라 **공백 한 칸**이다: 빈 문자열은 `Text` 의 높이를 0 으로 만든다.
 *
 * 지출 줄이 **메소 축**인 이유(메포는 환산해 들어오고 캐시는 안 들어온다)는
 * `CalendarDayAmounts` 에 적어 뒀다 — [[ADR-166]] 정정 2 ①.
 *
 * ## 월간과 주간을 **같은 격자**가 그린다 ([[ADR-170]] 결정 11)
 *
 * `weeks` 에 **주 하나만** 넘기면 그대로 주간 격자다 — 새 컴포넌트를 만들지 않는다. 갈리는 것은
 * 요일 머리(`weekdayLabels`)와 열지도 기준(`incomeMax`) 둘뿐이고, 둘 다 **밖에서 들어온다.**
 * 어느 주를 그릴지 정하는 것은 여전히 `lib/` 이고 여기는 받은 것을 그린다(결정 7).
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
  /**
   * 요일 머리 — 기본은 월간의 일~토다([[ADR-169]] 결정 8). 주간 보기는 목~수를 넘긴다
   * (`WEEKDAY_LABELS_RESET`, [[ADR-170]] 결정 10).
   *
   * **기본값이 있는 이유**는 월간 호출부가 한 글자도 안 바뀌게 하기 위해서다. 틀리면 화면에서
   * 바로 보이므로(요일 이름이 어긋난다) 조용히 잘못될 위험이 없다 — 아래 `incomeMax` 와 다르다.
   */
  readonly weekdayLabels?: readonly string[]
  /**
   * 열지도의 기준선 — **밖에서 넣는다**([[ADR-170]] 결정 12).
   *
   * 전에는 이 컴포넌트가 `monthIncomeMax(props.weeks, …)` 로 스스로 냈는데, 그러면 주간 보기에서
   * **받은 이레가 곧 기준**이 되어 «7칸 중 하나는 언제나 최대» 가 된다 — 아무것도 안 한 주도 한 칸이
   * 새까맣고, 진하기가 «많이 번 날» 을 말하지 못한다.
   *
   * **기본값을 두지 않는 것이 이 프롭의 요점이다.** 폴백이 있으면 주간 호출부가 잊었을 때 조용히
   * 주 기준으로 되돌아간다 — 화면에는 «그럴듯한 색» 으로 보여서 알아채지 못한다. 두 보기가 같은
   * 말을 하려면 기준이 **둘 다 그 달**이어야 하고, 그 판단은 화면이 한다.
   */
  readonly incomeMax: number
  /**
   * 목요일 열 왼쪽의 **주 경계선**([[ADR-170]] 결정 10 의 대가) — 월간 격자에만 준다.
   *
   * 월간 격자의 한 줄(일~토)과 주간 보기의 한 주(목~수)가 **다른 이레**라, 표시가 없으면
   * 주간으로 넘어가 다른 날들이 뜨는 것이 사용자에게는 그냥 어긋남이다. 주간 격자에는 안 준다 —
   * 격자 자체가 한 주라 **자를 것이 없다.**
   */
  readonly showResetDivider?: boolean
}

const NO_AMOUNTS = { incomeMeso: 0, expenseMeso: 0 } as const

/**
 * 경계선이 서는 자리 — 기본 요일 머리(일~토)에서 **목요일이 다섯째 칸**이라 그 왼쪽이다.
 *
 * 칸이 `flex-1` 일곱이라 각 칸이 정확히 1/7 이고, 선은 그 경계에 절대 배치된다. 칸에 `border-l` 을
 * 주면 칸마다 세로 여백(`py-1`)에서 선이 끊긴다.
 */
const RESET_DIVIDER_LEFT = `${(4 / 7) * 100}%`

/** 단계 → 불투명도. 0 단계는 **정확히 0** 이어야 «안 적은 날» 이 칠해지지 않는다. */
const HEAT_OPACITY: readonly number[] = [0, 0.1, 0.2, 0.3, 0.42]

/** 오늘과 고른 날은 **같은 칸일 수 있다** — 그래서 표현을 겹치지 않게 나눈다(채움 ↔ 테두리). */
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

export function CalendarMonth(props: CalendarMonthProps): React.JSX.Element {
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

      <View className="relative">
        {props.showResetDivider === true && (
          // `aria-hidden` 을 **안 붙인다** — 열지도 바탕과 같은 이유다(위 주석): 붙이면 RNTL 이
          // 이 노드를 숨김으로 보고 쿼리에서 걷어 테스트가 못 잡는다. 글자가 없어 스크린리더가
          // 읽을 것도 없다.
          <View
            testID="calendar-reset-divider"
            style={{ left: RESET_DIVIDER_LEFT }}
            className="absolute bottom-0 top-0 border-l border-dashed border-border-strong"
          />
        )}
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
                  <Text className={dayTextClass(isSelected, day.inPeriod)} style={TABULAR_NUMS}>
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
                  {amounts.incomeMeso > 0 ? `+${formatMesoCompact(amounts.incomeMeso)}` : ' '}
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
    </View>
  )
}
