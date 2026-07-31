import { getBossProfitDb } from './sqlite/db'
import type { BossCycle } from '../types/scheduler'

export interface BossProfitRecord {
  ocid: string
  boss: string
  difficulty: string
  cycle: BossCycle
  periodKey: string
  partySize: number
  priceMeso: number
  payoutMeso: number
  recordedAt: string // ISO 8601
}

const UPSERT_SQL = `
  INSERT INTO boss_profit_records
    (ocid, boss, difficulty, cycle, period_key, party_size, price_meso, payout_meso, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(ocid, boss, difficulty, period_key) DO UPDATE SET
    cycle = excluded.cycle,
    party_size = excluded.party_size,
    price_meso = excluded.price_meso,
    payout_meso = excluded.payout_meso,
    recorded_at = excluded.recorded_at
`

export async function upsertBossProfitRecord(record: BossProfitRecord): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(UPSERT_SQL, [
    record.ocid,
    record.boss,
    record.difficulty,
    record.cycle,
    record.periodKey,
    record.partySize,
    record.priceMeso,
    record.payoutMeso,
    record.recordedAt,
  ])
}

function rowToRecord(row: Record<string, unknown>): BossProfitRecord {
  return {
    ocid: row.ocid as string,
    boss: row.boss as string,
    difficulty: row.difficulty as string,
    cycle: row.cycle as BossCycle,
    periodKey: row.period_key as string,
    partySize: row.party_size as number,
    priceMeso: row.price_meso as number,
    payoutMeso: row.payout_meso as number,
    recordedAt: row.recorded_at as string,
  }
}

export async function getBossProfitRecords(
  ocids: string[],
  periodKeys: string[],
): Promise<BossProfitRecord[]> {
  if (ocids.length === 0 || periodKeys.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const periodKeyPlaceholders = periodKeys.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT * FROM boss_profit_records WHERE ocid IN (${ocidPlaceholders}) AND period_key IN (${periodKeyPlaceholders})`,
    [...ocids, ...periodKeys],
  )

  return (values ?? []).map(rowToRecord)
}

/**
 * 이 기간 **또는 그보다 과거**에 기록이 하나라도 있는지 확인한다([[ADR-068]] 결정 5).
 *
 * 이전 기간 게이트(`canReachPreviousPeriod`)가 **바로 이전 한 칸만** 봐서, 기록이 없는 기간이 벽이
 * 되어 그 뒤의 기록 전체가 화면에서 사라졌다 — 3·4주차에 접속하지 않은 캐릭터는 1·2주차 기록이
 * DB에 남아 있어도 도달할 수 없었다(이슈 #78). 키 목록을 열거하는 `getBossProfitRecords` 로는 답할
 * 수 없어(그 목록이 무한히 길어진다) 부등호 비교를 SQL에 맡긴다.
 *
 * `tab` 이 기준을 정한다 — 주간 탭은 weekly 기록만 보고, 월간 탭은 그 달의 monthly 기록과 **그 달에
 * 속한 weekly 기록**을 함께 본다(화면이 둘을 함께 그리므로, `hasCachedRecordsForPeriod` 와 같은 규약).
 * weekly `period_key` 는 `YYYY-MM-DD` 라 앞 7자가 그 달이다.
 */
export async function hasBossProfitRecordsAtOrBefore(
  ocids: string[],
  tab: BossCycle,
  periodKey: string,
): Promise<boolean> {
  if (ocids.length === 0) {
    return false
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const condition =
    tab === 'monthly'
      ? `((cycle = 'monthly' AND period_key <= ?) OR (cycle = 'weekly' AND substr(period_key, 1, 7) <= ?))`
      : `(cycle = 'weekly' AND period_key <= ?)`
  const parameters = tab === 'monthly' ? [...ocids, periodKey, periodKey] : [...ocids, periodKey]

  const { values } = await db.query(
    `SELECT 1 FROM boss_profit_records WHERE ocid IN (${ocidPlaceholders}) AND ${condition} LIMIT 1`,
    parameters,
  )

  return (values?.length ?? 0) > 0
}
