/**
 * 주간 탭 결정석 칩의 **월간 몫**. 그 주가 끝날 때까지의 그 달 누적이다.
 *
 * 주간 탭의 행에는 그 주에 선 월간 보스만 있어 누적을 셀 재료가 없다. 그래서 그 달의 월간 기록을
 * 따로 읽어 센다. 월간 탭은 행이 곧 그 달의 월간 보스라 이것을 안 쓴다(`summarizeWorldCrystals`).
 *
 * @see docs/features/boss-profit.md 의 `결정석 판매 현황 칩`
 */
import { useEffect, useState, useSyncExternalStore } from 'react'

import { resolveUndatedWeek } from '../../lib/boss/monthly-boss-week'
import { resetWeekStartOf } from '../../lib/calendar'
import {
  getBossProfitRecords,
  getWeeklyPeriodKeysWithRecords,
  type BossProfitRecord,
} from '../../storage/boss-profit'
import { bossRecordsStamp, subscribeBossRecordsStamp } from './period-cache'
import { withSqliteFallback } from './sqlite-guards'

/** 월드 key 별 월간 결정석 수와 보이는 월드 이름. */
export type MonthlyCrystalsByWorld = Record<string, { world: string; count: number }>

/**
 * 그 주 **이름의 달**에서, 선 주가 `weekKey` 와 같거나 앞선 월간 기록을 월드별로 센다.
 *
 * - 달은 주 키(목요일)의 달이다. 8/27 주는 `8월 4주차` 라 8월을 센다. 9/1~9/2 에 잡은 9월 보스는
 *   그 주에 서지만 9월 1주차부터 9월 누적에 든다
 * - 선 주는 주간 목록이 그 보스를 세우는 주와 같다. 날짜를 알면 그 날의 주, 모르면
 *   `resolveUndatedWeek` 가 고른 주다
 * - 단위는 캐릭터마다 보스 하나다. 월드를 모르는 기록은 뺀다 - 칩이 월드별 줄의 합이라서다
 */
export function countMonthlyCrystalsUpToWeek(
  records: readonly BossProfitRecord[],
  weekKey: string,
  now: Date,
  weeksWithRecords: readonly string[],
): MonthlyCrystalsByWorld {
  const monthKey = weekKey.slice(0, 7)
  const undatedWeek = resolveUndatedWeek(monthKey, now, weeksWithRecords)
  const seen = new Set<string>()
  const byWorld: MonthlyCrystalsByWorld = {}

  for (const record of records) {
    if (record.cycle !== 'monthly' || record.periodKey !== monthKey || record.worldKey === null) continue
    const standingWeek = record.defeatedOn == null ? undatedWeek : resetWeekStartOf(record.defeatedOn)
    if (standingWeek > weekKey) continue
    const identity = `${record.ocid}|${record.bossKey}`
    if (seen.has(identity)) continue
    seen.add(identity)
    const entry = byWorld[record.worldKey] ?? { world: record.world ?? record.worldKey, count: 0 }
    byWorld[record.worldKey] = { ...entry, count: entry.count + 1 }
  }
  return byWorld
}

/**
 * 그 주의 월간 누적을 읽고 기록 판이 바뀔 때마다 다시 세는 훅. `weekKey` 가 `null` 이면(월간 탭)
 * 안 읽고 `null` 을 낸다. 다시 세는 동안과 읽기가 실패했을 때는 직전 값을 낸다.
 *
 * @example
 * const monthlyByWorld = useMonthlyCrystalsUpToWeek(ocids, tab === 'weekly' ? periodKey : null)
 */
export function useMonthlyCrystalsUpToWeek(
  ocids: readonly string[],
  weekKey: string | null,
): MonthlyCrystalsByWorld | null {
  const stamp = useSyncExternalStore(subscribeBossRecordsStamp, bossRecordsStamp)
  const [counted, setCounted] = useState<{ key: string; byWorld: MonthlyCrystalsByWorld } | null>(null)
  // 의존성 배열에 배열을 그대로 넣으면 렌더마다 새 배열이라 끝없이 다시 읽는다. 내용으로 견준다.
  const ocidsKey = ocids.join(',')

  useEffect(() => {
    if (weekKey === null) return
    let alive = true
    const monthKey = weekKey.slice(0, 7)
    const targets = ocidsKey === '' ? [] : ocidsKey.split(',')
    void (async () => {
      const [records, weeksWithRecords] = await Promise.all([
        withSqliteFallback<BossProfitRecord[] | null>(getBossProfitRecords(targets, [monthKey]), null),
        withSqliteFallback(getWeeklyPeriodKeysWithRecords(targets, monthKey), []),
      ])
      if (!alive || records === null) return
      setCounted({
        key: `${ocidsKey}|${weekKey}`,
        byWorld: countMonthlyCrystalsUpToWeek(records, weekKey, new Date(), weeksWithRecords),
      })
    })()
    return () => {
      alive = false
    }
  }, [ocidsKey, weekKey, stamp])

  if (weekKey === null) return null
  // 다른 주 · 다른 캐릭터 묶음의 값은 내지 않는다. 그 주의 첫 읽기 전에는 `null` 이다.
  return counted !== null && counted.key === `${ocidsKey}|${weekKey}` ? counted.byWorld : null
}
