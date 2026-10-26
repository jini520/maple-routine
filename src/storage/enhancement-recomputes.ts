/**
 * 강화 비용 다시 매기기 요청의 진행(`enhancement_recomputes`)을 읽고 쓰는 자리.
 *
 * @see docs/persistence/sqlite.md `enhancement_recomputes`
 */
import { getBossProfitDb } from './sqlite/db'

/** 한 계정에서 한 요청을 어디까지 받았나. */
export interface RecomputeProgress {
  /** 다시 받은 마지막 날. 처음이면 `null` */
  doneThroughDate: string | null
  completed: boolean
}

/** 그 계정의 요청마다 진행. 키는 요청 id 다. 없는 요청은 아직 시작하지 않은 것이다. */
export async function loadRecomputeProgress(nexonAccountId: string): Promise<Map<string, RecomputeProgress>> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    'SELECT request_key, done_through_date, completed_at FROM enhancement_recomputes WHERE nexon_account_id = ?',
    [nexonAccountId],
  )
  return new Map(
    (values ?? []).map((row) => [
      row.request_key as string,
      {
        doneThroughDate: (row.done_through_date as string | null | undefined) ?? null,
        completed: row.completed_at !== null && row.completed_at !== undefined,
      },
    ]),
  )
}

/**
 * 한 요청의 진행을 적는다.
 *
 * @param doneThroughDate 이번 회차까지 받은 마지막 날. 받을 날이 없던 요청이면 `null`
 * @param completed 참이면 끝으로 적어 다시 돌지 않는다
 */
export async function saveRecomputeProgress(
  nexonAccountId: string,
  requestKey: string,
  doneThroughDate: string | null,
  completed: boolean,
  now: Date,
): Promise<void> {
  const db = await getBossProfitDb()
  const at = now.toISOString()
  await db.run(
    `INSERT INTO enhancement_recomputes (nexon_account_id, request_key, done_through_date, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (nexon_account_id, request_key) DO UPDATE SET
       done_through_date = excluded.done_through_date,
       completed_at = excluded.completed_at,
       updated_at = excluded.updated_at`,
    [nexonAccountId, requestKey, doneThroughDate, completed ? at : null, at],
  )
}
