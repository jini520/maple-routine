/**
 * 메이플 ID 마다의 MVP 등급 이력(`mvp_grade_history`).
 *
 * @see docs/persistence/sqlite.md `mvp_grade_history`
 */
import type { MvpGradeKey } from '../lib/mvp/grades'
import type { MvpGradeEntry } from '../lib/mvp/history'
import { getBossProfitDb } from './sqlite/db'

/** ID 마다 시작 날짜 오름차순의 이력. 표가 작아 한 번에 읽는다. */
export async function getMvpGradeHistories(): Promise<Map<string, MvpGradeEntry[]>> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT account_id, start_date, grade FROM mvp_grade_history ORDER BY account_id, start_date`,
  )
  const histories = new Map<string, MvpGradeEntry[]>()
  for (const row of values ?? []) {
    const accountId = row.account_id as string
    const entries = histories.get(accountId) ?? []
    entries.push({ startDate: row.start_date as string, grade: (row.grade as MvpGradeKey | null) ?? null })
    histories.set(accountId, entries)
  }
  return histories
}

/** 그 ID 의 이력을 통째로 바꾼다. `lib/mvp/history` 의 함수가 고친 이력 전체를 넘긴다. */
export async function replaceMvpGradeHistory(
  accountId: string,
  entries: readonly MvpGradeEntry[],
  updatedAt: string,
): Promise<void> {
  const db = await getBossProfitDb()
  await db.execute('BEGIN')
  try {
    await db.run(`DELETE FROM mvp_grade_history WHERE account_id = ?`, [accountId])
    for (const entry of entries) {
      await db.run(
        `INSERT INTO mvp_grade_history (account_id, start_date, grade, updated_at) VALUES (?, ?, ?, ?)`,
        [accountId, entry.startDate, entry.grade, updatedAt],
      )
    }
    await db.execute('COMMIT')
  } catch (error: unknown) {
    await db.execute('ROLLBACK')
    throw error
  }
}
