/**
 * 서버로 보낼 사용 로그를 쌓아 두는 표. 보낼 때 통째로 꺼내고, 꺼낸 것은 바로 지운다. 실패해도 되살리지 않는다.
 */
import type { UsageEvent } from '../types/usage-event'
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'
import { NEW_UUID_SQL } from './sqlite/uuid'

/** 쌓아 두는 줄 수의 상한. 신원이 없어 못 보내는 기기에서 표가 끝없이 자라지 않게 한다. */
export const USAGE_EVENTS_MAX = 500

/** 줄을 더하고, 상한을 넘으면 가장 먼저 적은 줄부터 지운다. */
export async function appendUsageEvent(event: UsageEvent): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    `INSERT INTO usage_events (id, type, name, duration_ms, occurred_at) VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?)`,
    [event.type, event.name, event.durationMs, event.at],
  )
  await db.run(
    `DELETE FROM usage_events
      WHERE rowid NOT IN (SELECT rowid FROM usage_events ORDER BY rowid DESC LIMIT ${USAGE_EVENTS_MAX})`,
  )
}

/** 쌓인 줄을 적은 차례로 꺼내고 표에서 지운다. */
export async function takeUsageEvents(): Promise<UsageEvent[]> {
  const db = await getBossProfitDb()
  return inTransaction(db, async () => {
    const { values } = await db.query(
      'SELECT rowid AS seq, type, name, duration_ms, occurred_at FROM usage_events ORDER BY rowid',
    )
    const rows = (values ?? []) as {
      seq: number
      type: UsageEvent['type']
      name: string
      duration_ms: number | null
      occurred_at: string
    }[]
    const last = rows.at(-1)
    if (last === undefined) return []
    await db.run('DELETE FROM usage_events WHERE rowid <= ?', [last.seq])
    return rows.map((row) => ({ type: row.type, name: row.name, durationMs: row.duration_ms, at: row.occurred_at }))
  })
}

/** 연결 해제 때 비운다. 남기면 다음 사람의 신원으로 나간다. */
export async function clearUsageEvents(): Promise<void> {
  const db = await getBossProfitDb()
  await db.run('DELETE FROM usage_events')
}
