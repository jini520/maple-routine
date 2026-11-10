/**
 * 다시 받아야 하는 강화 내역의 날(`enhancement_refetches`). 1.0.14 이관이 ocid 를 붙이지 못해 지운 줄의 날이다. 수집기가
 * 다시 매기기처럼 뒤에서 받고, 받아 굳히면 지운다.
 *
 * @see docs/persistence/sqlite.md `enhancement_refetches`
 */
import type { EnhancementKind } from '../nexon/history/client'
import { getBossProfitDb } from './sqlite/db'

export interface EnhancementRefetch {
  kind: EnhancementKind
  dateKey: string
}

/** 그 넥슨 계정이 다시 받을 날. 오래된 날부터. */
export async function loadEnhancementRefetches(nexonAccountId: string): Promise<EnhancementRefetch[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT enhancement_type, history_date FROM enhancement_refetches WHERE nexon_account_id = ? ORDER BY history_date`,
    [nexonAccountId],
  )
  return (values ?? []).map((row) => ({ kind: row.enhancement_type as EnhancementKind, dateKey: row.history_date as string }))
}

/** 다시 받아 굳힌 날을 지운다. */
export async function removeEnhancementRefetch(nexonAccountId: string, kind: EnhancementKind, dateKey: string): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    'DELETE FROM enhancement_refetches WHERE nexon_account_id = ? AND enhancement_type = ? AND history_date = ?',
    [nexonAccountId, kind, dateKey],
  )
}

/** 다시 받을 날을 적는다. 이미 있으면 그대로 둔다. */
export async function addEnhancementRefetch(
  nexonAccountId: string,
  kind: EnhancementKind,
  dateKey: string,
  now: Date,
): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    `INSERT OR IGNORE INTO enhancement_refetches (nexon_account_id, enhancement_type, history_date, created_at)
     VALUES (?, ?, ?, ?)`,
    [nexonAccountId, kind, dateKey, now.toISOString()],
  )
}
