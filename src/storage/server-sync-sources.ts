/**
 * 서버로 보낼 기록을 기기 표에서 읽는 자리. 한 건 전송 · 대기 표 · 과거 올리기가 함께 쓴다.
 */
import { getBossProfitDb } from './sqlite/db'

const textOrNull = (value: unknown): string | null => (value as string | null | undefined) ?? null

/** 드롭 하나가 붙은 기간 행 id. 드롭이 없으면 `null`. */
export async function getDropPeriodId(dropRecordId: string): Promise<string | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query('SELECT period_id FROM boss_drops WHERE id = ?', [dropRecordId])
  return textOrNull((values ?? [])[0]?.period_id)
}

/** 과거 올리기가 나눠 읽는 종류. 표와 조건이 종류마다 다르다. */
export type BackfillKind = 'dropPrice'

const BACKFILL_QUERIES: Record<BackfillKind, string> = {
  dropPrice: 'SELECT id FROM boss_drops WHERE id > ? ORDER BY id LIMIT ?',
}

/**
 * id 차례로 `after` 뒤의 기록 id 를 `limit` 개까지. 과거 올리기가 어디까지 보냈는지를 id 하나로 들 수 있게 차례가 id 다.
 *
 * @param after 지난번 마지막으로 보낸 id. 처음이면 빈 글자
 */
export async function listRecordIdsAfter(kind: BackfillKind, after: string, limit: number): Promise<string[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(BACKFILL_QUERIES[kind], [after, limit])
  return (values ?? []).map((row) => row.id as string)
}
