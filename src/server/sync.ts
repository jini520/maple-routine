/**
 * 기기 간 기록 동기화의 서버 경로. 올리기(`POST /v1/sync/push`)와 받기(`POST /v1/sync/pull`)를 부른다.
 *
 * 올리기의 응답은 기록마다의 결과를 올린 차례대로 싣는다. 요청 전체를 거절하는 것은 신원(401 · 403)과 본문의 겉모양(400 · 413)과 서버
 * 오류뿐이다.
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

/** 받기에 보내는 번호. 사람의 번호는 그 번호를 받은 넥슨 계정 줄 id 와 함께 보낸다. 처음이면 `null` 이다. */
export interface SyncPullCursors {
  nexonAccount: { id: string; changeSeq: number } | null
  mapleIds: Record<string, number>
}

/** 받기의 응답. 표 이름은 서버 표 이름을 낙타 표기로 쓴 것이고, 지운 줄은 `deletedAt` 이 차 있다. */
export interface SyncPullResponse {
  /** 이 신원이 쓸 수 있는 메이플 ID 해시 전부 */
  mapleIds: string[]
  /** 다음 받기에 보낼 번호 */
  cursors: { nexonAccount: { id: string; changeSeq: number }; mapleIds: Record<string, number> }
  /** 서버 전체에 남은 삭제 표식의 가장 작은 변경 번호. 표식이 없으면 `null` */
  oldestDeletedChangeSeq: number | null
  hasMore: boolean
  records: Record<string, Record<string, unknown>[]>
}

/** 받아 본 결과. `refused` 는 응답이 왔지만 읽을 수 있는 본문이 아닌 것이다. 번호를 잘못 읽어 적으면 다음 받기가 줄을 놓친다. */
export type SyncPullOutcome = { outcome: 'answered'; response: SyncPullResponse } | { outcome: 'refused'; status: number } | { outcome: 'no-response' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSeq(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function pullResponseOf(raw: unknown): SyncPullResponse | null {
  if (!isRecord(raw) || !isRecord(raw.cursors) || !isRecord(raw.records)) return null
  const { mapleIds, cursors, oldestDeletedChangeSeq, hasMore, records } = raw
  const account = cursors.nexonAccount
  if (!Array.isArray(mapleIds) || !mapleIds.every((one) => typeof one === 'string')) return null
  if (!isRecord(account) || typeof account.id !== 'string' || !isSeq(account.changeSeq)) return null
  if (!isRecord(cursors.mapleIds) || !Object.values(cursors.mapleIds).every(isSeq)) return null
  if (oldestDeletedChangeSeq !== null && !isSeq(oldestDeletedChangeSeq)) return null
  if (typeof hasMore !== 'boolean') return null
  if (!Object.values(records).every((rows) => Array.isArray(rows) && rows.every(isRecord))) return null
  return raw as unknown as SyncPullResponse
}

/** 번호 뒤에 바뀐 줄을 받는다. 한 번에 500줄까지이고 더 있으면 `hasMore` 가 켜진다. */
export async function pullSyncRecords(headers: Record<string, string>, cursors: SyncPullCursors): Promise<SyncPullOutcome> {
  const response = await jsonCall('/sync/pull', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ cursors }),
  })
  if (response.outcome === 'no-response') return response
  const parsed = response.ok ? pullResponseOf(response.body) : null
  return parsed === null ? { outcome: 'refused', status: response.status } : { outcome: 'answered', response: parsed }
}
