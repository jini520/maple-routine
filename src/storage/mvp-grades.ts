/**
 * 메이플 ID 마다의 MVP 등급 이력(`mvp_grade_history`). 표는 등급을 등급 줄 id 로 들고, 읽을 때 key 로 되돌린다.
 *
 * @see docs/persistence/sqlite.md `mvp_grade_history`
 */
import { findMvpGrade, findMvpGradeById } from '../lib/mvp/grades'
import type { MvpGradeEntry } from '../lib/mvp/history'
import { getBossProfitDb } from './sqlite/db'
import { noteRecordsWritten } from './server-sync-queue'
import { inTransaction } from './sqlite/transaction'

/** ID 마다 시작 날짜 오름차순의 이력. 표가 작아 한 번에 읽는다. */
export async function getMvpGradeHistories(): Promise<Map<string, MvpGradeEntry[]>> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT account_id, from_date, grade_id FROM mvp_grade_history ORDER BY account_id, from_date`,
  )
  const histories = new Map<string, MvpGradeEntry[]>()
  for (const row of values ?? []) {
    // 등급이 빈 줄은 앱을 켤 때 지우지만 그보다 먼저 읽는 화면이 있다. 표에 없는 등급은 수수료와 할인을 구할 수 없다.
    const grade = findMvpGradeById(row.grade_id as string | null)
    if (grade === null) continue
    const accountId = row.account_id as string
    const entries = histories.get(accountId) ?? []
    entries.push({ startDate: row.from_date as string, grade: grade.key })
    histories.set(accountId, entries)
  }
  return histories
}

/**
 * 그 ID 의 이력을 통째로 바꾼다. `lib/mvp/history` 의 함수가 고친 이력 전체를 넘긴다. 표에 없는 등급이 있으면 던진다.
 *
 * 시작 날짜가 같은 줄은 id 를 남기고 등급이 바뀔 때만 고친다. 지우고 다시 넣으면 저장할 때마다 그 ID 의 모든 줄이 서버에 지우기와 새
 * 줄로 올라간다.
 */
export async function replaceMvpGradeHistory(
  accountId: string,
  entries: readonly MvpGradeEntry[],
  updatedAt: string,
): Promise<void> {
  const rows = entries.map((entry) => {
    const grade = findMvpGrade(entry.grade)
    if (grade === null) throw new Error(`MVP 등급 표에 없는 등급이다: ${entry.grade}`)
    return { fromDate: entry.startDate, gradeId: grade.id }
  })
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    const kept = rows.map((row) => row.fromDate)
    await db.run(
      `DELETE FROM mvp_grade_history WHERE account_id = ? AND from_date NOT IN (${kept.map(() => '?').join(', ')})`,
      [accountId, ...kept],
    )
    for (const row of rows) {
      await db.run(
        `INSERT INTO mvp_grade_history (account_id, from_date, grade_id, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (account_id, from_date) DO UPDATE SET grade_id = excluded.grade_id, updated_at = excluded.updated_at
          WHERE grade_id IS NOT excluded.grade_id`,
        [accountId, row.fromDate, row.gradeId, updatedAt],
      )
    }
  })
  noteRecordsWritten()
}

/** 등급이 빈 줄을 지운다. 지운 수를 돌려준다. 앱은 빈 줄을 적지 않지만 칸은 서버처럼 비울 수 있다. */
export async function deleteEmptyMvpGradeRows(): Promise<number> {
  const db = await getBossProfitDb()
  const { values } = await db.query(`SELECT count(*) AS n FROM mvp_grade_history WHERE grade_id IS NULL`)
  const count = Number(values?.[0]?.n ?? 0)
  if (count > 0) await db.run(`DELETE FROM mvp_grade_history WHERE grade_id IS NULL`)
  return count
}
