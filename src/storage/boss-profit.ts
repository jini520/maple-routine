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

export async function getLatestPartySize(
  ocid: string,
  boss: string,
  difficulty: string,
): Promise<number | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT * FROM boss_profit_records WHERE ocid = ? AND boss = ? AND difficulty = ? ORDER BY recorded_at DESC LIMIT 1`,
    [ocid, boss, difficulty],
  )

  const row = values?.[0]
  return row === undefined ? null : (row.party_size as number)
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
