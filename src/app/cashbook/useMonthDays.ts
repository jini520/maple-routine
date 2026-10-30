/**
 * 가계부가 그리는 것을 **달 단위로 드는 쿼리 묶음.** 보는 달과 그 앞뒤 둘, 다섯 달을 미리 읽는다.
 *
 * 달마다 `ledgerDays` 쿼리 하나다(`features/cashbook/ledger-query`). 한 달을 한 번 읽으면 격자의 칸 금액과 그날
 * 목록이 함께 나온다(`loadMonthDays`). 읽는 단위가 격자 범위가 아니라 달력 월인 것은, 격자가 앞뒤 달 날짜로 채운 칸은
 * 금액을 안 그려서(`CalendarGrid` 가 `inPeriod` 로 거른다) 읽어 봐야 버리기 때문이다. 달로 끊으면 이웃 격자와 겹치는
 * 부분도 한 번만 읽는다.
 *
 * 다시 읽는 계기는 여기 없다. 기록 표의 판이 오르면 그 표를 적은 쿼리가 무효화되고, 새 값이 올 때까지 든 값을 그대로
 * 그린다. 판이 바뀔 때마다 표를 비우면 격자가 한 번씩 하얘진다.
 *
 * @example
 * const months = useMonthDays({ viewMonthKey, todayMonthKey, paused: ledger.collecting })
 * <CalendarGrid amounts={months.amounts} … />
 * const rows = months.recordsOn(selectedDateKey)
 */
import { useQueries } from '@tanstack/react-query'

import { monthBounds, monthKeyOf, type CalendarAmounts } from '../../lib/calendar'
import { ledgerDaysOptions, type LedgerDays } from '../../features/cashbook/ledger-query'
import { amountsOfDays, type DayRecord } from '../../features/cashbook/records'
import { monthWindow } from '../../features/cashbook/range'

const NO_RECORDS: readonly DayRecord[] = []

export function useMonthDays(input: {
  viewMonthKey: string
  todayMonthKey: string
  /** 층이 채우는 중인가. 그동안은 안 읽는다. 그때의 DB 는 자라는 중이라 한 칸의 값이 종류가 도착할 때마다 커진다 */
  paused: boolean
}): {
  /** 격자가 읽는 칸 금액. 들고 있는 달을 다 합친 표다 */
  amounts: CalendarAmounts
  /** 그날 줄들. 그 달을 아직 안 들고 있으면 `null` 이고 부르는 쪽이 따로 읽는다 */
  recordsOn: (dateKey: string) => readonly DayRecord[] | null
  /** 그 달을 들고 있나. 다시 읽는 중이어도 든 값이 있으면 참이다 */
  has: (monthKey: string) => boolean
} {
  const months = monthWindow(input.viewMonthKey, input.todayMonthKey)
  const results = useQueries({
    queries: months.map((monthKey) => {
      const { from, to } = monthBounds(monthKey)
      return { ...ledgerDaysOptions(from, to), enabled: !input.paused }
    }),
  })

  const held = new Map<string, LedgerDays>()
  results.forEach((result, index) => {
    if (result.data !== undefined) held.set(months[index], result.data)
  })

  const amounts: CalendarAmounts = Object.assign({}, ...[...held.values()].map(amountsOfDays))

  return {
    amounts,
    recordsOn: (dateKey) => {
      const days = held.get(monthKeyOf(dateKey))
      return days === undefined ? null : (days[dateKey] ?? NO_RECORDS)
    },
    has: (monthKey) => held.has(monthKey),
  }
}
