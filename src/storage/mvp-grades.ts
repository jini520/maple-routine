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
    `SELECT account_id, from_date, grade FROM mvp_grade_history ORDER BY account_id, from_date`,
  )
  const histories = new Map<string, MvpGradeEntry[]>()
  for (const row of values ?? []) {
    // 옛 판이 남긴 등급 빈 줄. 앱을 켤 때 지우지만 그보다 먼저 읽는 화면이 있다.
    if (row.grade === null) continue
    const accountId = row.account_id as string
    const entries = histories.get(accountId) ?? []
    entries.push({ startDate: row.from_date as string, grade: row.grade as MvpGradeKey })
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
        `INSERT INTO mvp_grade_history (account_id, from_date, grade, updated_at) VALUES (?, ?, ?, ?)`,
        [accountId, entry.startDate, entry.grade, updatedAt],
      )
    }
    await db.execute('COMMIT')
  } catch (error: unknown) {
    await db.execute('ROLLBACK')
    throw error
  }
}

/** 옛 판이 첫 기록 앞에 기간을 끼워 넣으며 남긴 등급 빈 줄을 지운다. 지운 수를 돌려준다. */
export async function deleteEmptyMvpGradeRows(): Promise<number> {
  const db = await getBossProfitDb()
  const { values } = await db.query(`SELECT count(*) AS n FROM mvp_grade_history WHERE grade IS NULL`)
  const count = Number(values?.[0]?.n ?? 0)
  if (count > 0) await db.run(`DELETE FROM mvp_grade_history WHERE grade IS NULL`)
  return count
}
