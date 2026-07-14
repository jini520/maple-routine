import { getBossProfitDb } from './sqlite/db'
import type { BossCycle } from '../types/scheduler'

const UPSERT_SQL = `
  INSERT INTO boss_profit_period_checks
    (ocid, cycle, period_key, checked_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(ocid, cycle, period_key) DO UPDATE SET
    checked_at = excluded.checked_at
`

export async function isPeriodChecked(
  ocid: string,
  cycle: BossCycle,
  periodKey: string,
): Promise<boolean> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT * FROM boss_profit_period_checks WHERE ocid = ? AND cycle = ? AND period_key = ?`,
    [ocid, cycle, periodKey],
  )

  return (values?.length ?? 0) > 0
}

export async function markPeriodChecked(
  ocid: string,
  cycle: BossCycle,
  periodKey: string,
  checkedAt: string,
): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(UPSERT_SQL, [ocid, cycle, periodKey, checkedAt])
}
