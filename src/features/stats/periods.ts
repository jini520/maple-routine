/**
 * 통계 화면의 기간 범위. 기간 줄이 고른 기간 하나에서 카드들이 읽을 날짜 범위를 낸다.
 */
import { getAdjacentPeriodKey, getPeriodDateKeys } from '../../lib/boss/boss-profit-period'
import { monthKeyOf, resetWeekStartOf } from '../../lib/calendar'
import type { BossCycle } from '../../types'
import type { StatsRange } from './aggregate'

export interface StatsPeriodRange extends StatsRange {
  periodKey: string
}

export interface StatsRanges {
  current: StatsRange
  /** 증감 칩의 비교 대상 */
  previous: StatsRange
  /** 추이 막대. 오래된 것부터이고 마지막이 고른 기간이다 */
  trend: StatsPeriodRange[]
}

/** 추이가 보이는 기간 수. 주간 8주, 월간 6개월 */
const TREND_LENGTH: Record<BossCycle, number> = { weekly: 8, monthly: 6 }

function rangeOf(cycle: BossCycle, periodKey: string): StatsPeriodRange {
  const dates = getPeriodDateKeys(cycle, periodKey)
  return { periodKey, from: dates[0], to: dates[dates.length - 1] }
}

export function statsRanges(cycle: BossCycle, periodKey: string): StatsRanges {
  const trend: StatsPeriodRange[] = []
  let key = periodKey
  for (let index = 0; index < TREND_LENGTH[cycle]; index += 1) {
    trend.unshift(rangeOf(cycle, key))
    key = getAdjacentPeriodKey(cycle, key, 'prev')
  }
  const { from, to } = trend[trend.length - 1]
  const previous = trend[trend.length - 2]
  return { current: { from, to }, previous: { from: previous.from, to: previous.to }, trend }
}

/**
 * 누적 선의 점들. 시작 날짜가 든 기간부터 고른 기간까지 기간마다 하나이고, 첫 범위는 시작 날짜부터다.
 *
 * @param firstDateKey 더하기 시작하는 날(고른 날이거나 기록이 처음 있는 날). 없으면 `null`
 */
export function cumulativeRanges(
  cycle: BossCycle,
  periodKey: string,
  firstDateKey: string | null,
): StatsPeriodRange[] {
  const first = firstDateKey === null ? periodKey : cycle === 'weekly' ? resetWeekStartOf(firstDateKey) : monthKeyOf(firstDateKey)
  const ranges: StatsPeriodRange[] = [rangeOf(cycle, periodKey)]
  let key = periodKey
  while (first < key) {
    key = getAdjacentPeriodKey(cycle, key, 'prev')
    ranges.unshift(rangeOf(cycle, key))
  }
  if (firstDateKey !== null && ranges[0].from < firstDateKey) ranges[0] = { ...ranges[0], from: firstDateKey }
  return ranges
}
