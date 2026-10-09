/**
 * 서버로 **못 보낸 것**만 드는 표. 평소에 비어 있다.
 *
 * 전송은 사용자가 값을 저장하는 그 자리에서 한 건 나가고, 실패한 것만 여기 줄이 남는다. 보낼
 * 것을 찾으려고 기록 표를 훑지 않는다 - 그쪽이 더 낭비다.
 *
 * **값을 담지 않는다.** `recordId` 만 담고 보낼 때 원본에서 현재 값을 읽는다. 담으면 그 사이에
 * 또 고친 경우 중간 값이 서버로 간다.
 *
 * **작업 종류(올리기 · 지우기)를 적지 않는다.** 원본이 있으면 올리기이고 없으면 지우기이므로
 * 파생된다. 적으면 지워진 기록에 올리기가 남은 상태가 표현 가능해지고, 제약으로는 못 막는다.
 */
import { getBossProfitDb } from './sqlite/db'
import { NEW_UUID_SQL } from './sqlite/uuid'

/** 몇 번까지 시도하나. 안 버리면 못 보내는 건이 영원히 재시도된다. */
export const MAX_SYNC_ATTEMPTS = 5

/** 보낼 것 하나. */
export interface SyncQueueEntry {
  id: string
  kind: string
  recordId: string
  /** 응답을 받은 횟수. 네트워크가 없던 회차는 안 센다. */
  attempts: number
  lastError: string | null
  createdAt: string
}

/**
 * 한 기록에 줄은 하나다. **이미 있으면 그대로 둔다.**
 *
 * 시도 횟수를 다시 0 으로 돌리지 않는다. 사용자가 다시 저장했다는 것이 망이 나아졌다는 뜻은
 * 아니고, 돌려 주면 서버가 영구히 거절하는 건이 무한히 재시도된다.
 */
const ENQUEUE_SQL = `
  INSERT INTO server_sync_queue (id, kind, record_id, created_at)
  VALUES (${NEW_UUID_SQL}, ?, ?, ?)
  ON CONFLICT(record_id) DO NOTHING
`

export async function enqueueServerSync(
  kind: string,
  recordId: string,
  createdAt: string,
): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(ENQUEUE_SQL, [kind, recordId, createdAt])
}

/** 표에 든 것 전부. 할 일만 들어서 조건이 필요 없다. 오래된 것부터 보낸다. */
export async function listServerSyncQueue(): Promise<SyncQueueEntry[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT id, kind, record_id, attempts, last_error, created_at
       FROM server_sync_queue ORDER BY created_at, id`,
  )

  return (values ?? []).map((row) => {
    const one = row as {
      id: string
      kind: string
      record_id: string
      attempts: number
      last_error: string | null
      created_at: string
    }
    return {
      id: one.id,
      kind: one.kind,
      recordId: one.record_id,
      attempts: one.attempts,
      lastError: one.last_error,
      createdAt: one.created_at,
    }
  })
}

/**
 * 응답을 받았고 거절이었다. 횟수를 하나 올린다.
 *
 * **응답을 받은 뒤에 적는 것이 계약이다.** 미리 적어 두고 성공하면 되돌리는 모양으로 짜면,
 * 훑는 중에 앱이 꺼졌을 때 그 되돌리기가 못 돌아 한 번 켰다 끈 것이 시도로 남는다.
 */
export async function countServerSyncAttempt(recordId: string, lastError: string): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    `UPDATE server_sync_queue SET attempts = attempts + 1, last_error = ? WHERE record_id = ?`,
    [lastError, recordId],
  )
}

/** 보냈거나 포기했다. 줄을 지우는 자리는 여기 하나다. */
export async function removeServerSync(recordId: string): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(`DELETE FROM server_sync_queue WHERE record_id = ?`, [recordId])
}
