/**
 * 기기 간 기록 동기화의 서버 경로. 지금은 올리기(`POST /v1/sync/push`)만 부른다.
 *
 * 응답은 기록마다의 결과를 올린 차례대로 싣는다. 요청 전체를 거절하는 것은 신원(401 · 403)과 본문의 겉모양(400 · 413)과 서버 오류뿐이다.
 */
import { jsonCall } from './write'

/** 올리는 기록 한 건. `table` 은 서버 표 이름을 낙타 표기로 쓴 것이고 `row` 는 그 표의 칸이다. */
export interface SyncPushRecord {
  table: string
  action: 'upsert' | 'delete'
  row: Record<string, unknown>
}

/** 한 건의 결과. 받았으면 서버에 남은 줄의 id, 거절이면 정해진 코드(없으면 `null`)와 이유다. */
export type SyncPushResult = { ok: true; id: string | null } | { ok: false; code: string | null; reason: string }

/**
 * 올려 본 결과. `refused` 는 응답이 왔지만 건마다의 결과가 없는 것이다. 요청 전체의 거절이거나 읽을 수 없는 본문이다.
 * `no-response` 와 합치지 않는다. 합치면 오프라인이 서버 거절과 같아진다.
 */
export type SyncPushOutcome =
  | { outcome: 'answered'; results: SyncPushResult[] }
  | { outcome: 'refused'; status: number }
  | { outcome: 'no-response' }

function resultOf(raw: unknown): SyncPushResult | null {
  if (typeof raw !== 'object' || raw === null) return null
  const one = raw as { ok?: unknown; id?: unknown; code?: unknown; reason?: unknown }
  if (one.ok === true) return { ok: true, id: typeof one.id === 'string' ? one.id : null }
  if (one.ok !== false) return null
  return { ok: false, code: typeof one.code === 'string' ? one.code : null, reason: typeof one.reason === 'string' ? one.reason : '' }
}

/**
 * 기록 묶음을 올린다. 결과는 보낸 기록과 같은 차례다.
 *
 * @param records 100건 · 본문 256KB 까지. 넘으면 서버가 요청 전체를 400 · 413 으로 거절한다
 */
export async function pushSyncRecords(
  headers: Record<string, string>,
  records: readonly SyncPushRecord[],
): Promise<SyncPushOutcome> {
  const response = await jsonCall('/sync/push', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ records }),
  })
  if (response.outcome === 'no-response') return response
  const raw = (response.body as { results?: unknown } | null)?.results
  if (!response.ok || !Array.isArray(raw) || raw.length !== records.length) {
    return { outcome: 'refused', status: response.status }
  }
  const results = raw.map(resultOf)
  if (results.some((one) => one === null)) return { outcome: 'refused', status: response.status }
  return { outcome: 'answered', results: results as SyncPushResult[] }
}
