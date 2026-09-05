/**
 * ⚠️ **아무도 안 읽는다.** 창 동기화가 이 표의 답을 조회 원장으로 대체했다.
 *
 * 남겨 둔 이유는 하나다. 표를 지우면 되돌릴 수 없어, 새 경로가 실기기에서 한 릴리스를 버틴 뒤에
 * 지운다. 그때까지 이 파일과 `boss_profit_period_checks` 표는 **읽지도 쓰지도 않는다**.
 */
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
