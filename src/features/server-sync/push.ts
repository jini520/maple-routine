/**
 * 대기 표를 묶어 `POST /v1/sync/push` 로 올리고, 결과마다 대기 줄과 기기 줄을 다루는 회차의 한 부분.
 *
 * ```
 * 대기 줄을 서버 표 차례 · 넣은 차례로 늘어놓는다
 *   원본을 읽어 서버 칸으로 바꾼다. 메이플 ID 를 모르면 두고, 보낼 것이 없으면 대기 줄만 지운다
 *   100건 · 256KB 까지, 가리키는 표와 가리켜지는 표는 따로 묶는다
 * 보낸다
 *   받았다              → 대기 줄을 지운다. 보낸 뒤 원본이 바뀌었으면 남긴다. id 가 다르면 기기 줄을 서버 id 로 바꾼다
 *   두 거절             → 대기 줄과 기기 줄을 지우고 끝날 때 알린다
 *   다른 거절           → 횟수를 센다. 다섯 번째면 대기 줄을 뺀다
 *   응답 없음 · 요청 전체의 거절 → 아무것도 세지 않고 멈춘다
 * ```
 *
 * @see docs/foundation/server-sync.md `올리기`
 */
import { utf8Bytes } from '../../lib/text-bytes'
import { pushSyncRecords, type SyncPushOutcome, type SyncPushRecord } from '../../server/sync'
import { bumpBossDropRecordsRevision } from '../../storage/boss-drops'
import { bumpBossProfitRecordsRevision } from '../../storage/boss-profit'
import { bumpEnhancementTotalsRevision } from '../../storage/enhancement-totals'
import { bumpIncomeRecordsRevision } from '../../storage/income'
import { bumpInventoryItemsRevision } from '../../storage/inventory'
import {
  countServerSyncAttempt,
  listServerSyncQueue,
  MAX_SYNC_ATTEMPTS,
  removeServerSync,
  SERVER_SYNC_TABLES,
  type ServerSyncTable,
  type SyncQueueEntry,
} from '../../storage/server-sync-queue'
import {
  characterNameOf,
  deleteServerSyncRecord,
  mapleIdOfNexonAccount,
  mapleIdOfOcid,
  readServerSyncSource,
  replaceServerSyncRecordId,
} from '../../storage/server-sync-records'
import { bumpSpendRecordsRevision } from '../../storage/spend'
import { serverIdentityHeaders } from '../auth/server-identity'
import { useBossProfitCalculatorStore } from '../boss-profit-calculator/store'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { useToastStore } from '../toast/store'
import { pushRecordOf, type RecordOwners } from './push-records'
import { isRejectionCode, recordNameOf, rejectionMessagesOf, type Rejection } from './rejection-notice'

/** 한 요청에 싣는 기록 수. 서버 `PUSH_RECORD_LIMIT` 과 같다. */
const PUSH_RECORD_LIMIT = 100

/** 한 요청의 본문 바이트. 서버 `BODY_LIMIT_BYTES` 와 같다. 넘으면 요청 전체가 413 이다. */
const PUSH_BODY_LIMIT_BYTES = 256 * 1024

/**
 * 같은 요청에 싣지 않는 표의 짝. 서버가 앞의 표의 줄을 유일 기준이 같은 다른 줄로 합치면 받은 id 의 줄을 지워서, 같은 요청의 뒤의
 * 표 줄이 그 id 를 가리키면 지운 기록의 수정으로 거절되고 기기가 그 줄을 지운다.
 */
const SEPARATE_REQUESTS: readonly (readonly [ServerSyncTable, ServerSyncTable])[] = [
  ['inventoryItems', 'cashbookEntries'],
  ['bossProfitEntries', 'bossDrops'],
]

/** 이 회차가 밖에 맡기는 일 전부. 테스트가 갈아 끼운다. */
export interface PushDeps {
  identity(): Promise<Record<string, string> | null>
  list(): Promise<SyncQueueEntry[]>
  read(table: ServerSyncTable, recordId: string): Promise<Record<string, unknown> | null>
  owners: RecordOwners
  send(headers: Record<string, string>, records: SyncPushRecord[]): Promise<SyncPushOutcome>
  remove(recordId: string): Promise<void>
  countAttempt(recordId: string, error: string): Promise<void>
  replaceId(table: ServerSyncTable, fromId: string, toId: string): Promise<void>
  deleteRecord(table: ServerSyncTable, recordId: string): Promise<void>
  nameOf(table: string, source: Record<string, unknown> | null): Promise<string | null | 'silent'>
  notify(message: string): void
  /** 기기 줄을 고치거나 지운 표. 그 표를 읽는 화면이 다시 읽게 한다 */
  afterRecordsChanged(tables: ReadonlySet<ServerSyncTable>): void
}

/** 화면이 그 표를 다시 읽게 하는 일. 기록 판을 올리거나 쿼리 · 스토어를 다시 읽는다. */
function refreshScreens(tables: ReadonlySet<ServerSyncTable>): void {
  if (tables.has('bossProfitEntries') || tables.has('bossSplitSettings')) bumpBossProfitRecordsRevision()
  if (tables.has('bossProfitEntries') || tables.has('bossDrops')) bumpBossDropRecordsRevision()
  if (tables.has('cashbookEntries') || tables.has('inventoryItems')) {
    bumpIncomeRecordsRevision()
    bumpSpendRecordsRevision()
  }
  if (tables.has('inventoryItems')) bumpInventoryItemsRevision()
  if (tables.has('enhancementTotals')) bumpEnhancementTotalsRevision()
  if (tables.has('partyAppointments')) void queryClient.invalidateQueries({ queryKey: queryKeys.partyAppointments() })
  if (tables.has('bossProfitCalculatorRecords')) void useBossProfitCalculatorStore.getState().reloadRecords()
}

const DEFAULT_DEPS: PushDeps = {
  identity: serverIdentityHeaders,
  list: listServerSyncQueue,
  read: readServerSyncSource,
  owners: { mapleIdOfOcid, mapleIdOfNexonAccount },
  send: pushSyncRecords,
  remove: removeServerSync,
  countAttempt: countServerSyncAttempt,
  replaceId: replaceServerSyncRecordId,
  deleteRecord: deleteServerSyncRecord,
  nameOf: (table, source) => recordNameOf(table, source, { characterNameOf }),
  // 입력이 저장되지 않았다는 알림이라 다른 저장 실패처럼 사용자가 닫을 때까지 둔다.
  notify: (message) => useToastStore.getState().showError(message),
  afterRecordsChanged: refreshScreens,
}

/** 한 번의 올리기가 한 일. 화면에 안 쓰고 테스트가 본다. */
export interface PushSummary {
  sent: number
  /** 메이플 ID 를 몰라 둔 기록 */
  held: number
  /** 횟수를 센 거절 */
  rejected: number
  /** 다섯 번째 거절이라 대기 줄을 뺀 기록 */
  dropped: number
  /** 두 거절로 기기 줄을 지운 기록 */
  conflicts: number
  /** 응답이 없거나 요청 전체가 거절돼 멈췄다 */
  stopped: boolean
}

export interface PushOptions {
  /** 두 거절을 알릴지. 처음 동기화는 알리지 않는다. 기본은 알린다 */
  notify?: boolean
}

/** 한 요청에 실은 기록과 그 원본. 결과를 차례로 짝짓는다. */
interface Batched {
  entry: SyncQueueEntry
  table: ServerSyncTable
  source: Record<string, unknown> | null
  record: SyncPushRecord
}

function tableOrder(entry: SyncQueueEntry): number {
  return (SERVER_SYNC_TABLES as readonly string[]).indexOf(entry.recordType)
}

function bodyBytes(records: readonly SyncPushRecord[]): number {
  return utf8Bytes(JSON.stringify({ records }))
}

function separatedFrom(batch: readonly Batched[], table: string): boolean {
  return SEPARATE_REQUESTS.some(([first, second]) => table === second && batch.some((one) => one.table === first))
}

/**
 * 다음 요청에 실을 기록. 이 회차에서 다룬 줄(`done`)은 빼고, 두거나 대기 줄만 지운 줄은 `done` 에 적는다.
 */
async function nextBatch(deps: PushDeps, done: Set<string>, summary: PushSummary): Promise<Batched[]> {
  const entries = (await deps.list())
    .filter((entry) => !done.has(entry.recordId))
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => tableOrder(a.entry) - tableOrder(b.entry) || a.index - b.index)
    .map(({ entry }) => entry)
  const batch: Batched[] = []
  for (const entry of entries) {
    if (batch.length >= PUSH_RECORD_LIMIT || separatedFrom(batch, entry.recordType)) break
    const table = entry.recordType as ServerSyncTable
    const source = tableOrder(entry) < 0 ? null : await deps.read(table, entry.recordId)
    const plan = await pushRecordOf(entry.recordType, entry.recordId, source, deps.owners)
    if (plan.kind === 'hold') {
      done.add(entry.recordId)
      summary.held += 1
      continue
    }
    if (plan.kind === 'drop') {
      done.add(entry.recordId)
      await deps.remove(entry.recordId)
      continue
    }
    // 한 건만으로 넘치면 혼자 보낸다. 서버가 413 으로 답하면 그 회차가 멈춘다.
    if (batch.length > 0 && bodyBytes([...batch.map((one) => one.record), plan.record]) > PUSH_BODY_LIMIT_BYTES) break
    done.add(entry.recordId)
    batch.push({ entry, table, source, record: plan.record })
  }
  return batch
}

/** 받았다는 결과. 보낸 뒤 원본이 바뀌었으면 대기 줄을 남긴다. 트리거는 대기 줄이 있으면 넣지 않아 지우면 그 사이의 수정을 잃는다. */
async function accept(deps: PushDeps, one: Batched, serverId: string | null, changed: Set<ServerSyncTable>): Promise<void> {
  const now = await pushRecordOf(one.table, one.entry.recordId, await deps.read(one.table, one.entry.recordId), deps.owners)
  if (now.kind === 'send' && JSON.stringify(now.record) === JSON.stringify(one.record)) await deps.remove(one.entry.recordId)
  // 기기에 id 가 없는 표(설정 · 목록에서 풀어 낸 줄 · 굳은 날)는 서버가 id 를 만들어 돌려준다. 기기 줄에 바꿀 id 가 없다.
  if (serverId === null || one.record.action !== 'upsert' || typeof one.record.row.id !== 'string') return
  if (serverId === one.record.row.id) return
  try {
    await deps.replaceId(one.table, one.entry.recordId, serverId)
    changed.add(one.table)
  } catch {
    // 서버 id 의 줄이 기기에 따로 있다. 받기가 서버의 줄로 맞춘다.
  }
}

/**
 * 대기 표를 올린다. **던지지 않는 쪽은 부르는 쪽이다.** 저장소나 서버 경로가 던지면 그대로 올라간다.
 *
 * 신원이 없으면 아무것도 안 한다. 키를 지웠거나 로그인 전인 상태이고, 그것은 기록의 잘못이 아니다.
 */
export async function pushServerSync(options: PushOptions = {}, deps: PushDeps = DEFAULT_DEPS): Promise<PushSummary> {
  const summary: PushSummary = { sent: 0, held: 0, rejected: 0, dropped: 0, conflicts: 0, stopped: false }
  const headers = await deps.identity()
  if (headers === null) return summary

  const done = new Set<string>()
  const rejections: Rejection[] = []
  const changed = new Set<ServerSyncTable>()
  for (;;) {
    const batch = await nextBatch(deps, done, summary)
    if (batch.length === 0) break
    const outcome = await deps.send(
      headers,
      batch.map((one) => one.record),
    )
    // 응답이 없거나 요청 전체가 거절됐다. 횟수를 세면 한 건 때문에 같은 요청의 다른 건까지 버려지고, 오프라인이 시도를 태운다.
    if (outcome.outcome !== 'answered') {
      summary.stopped = true
      break
    }
    for (const [index, result] of outcome.results.entries()) {
      const one = batch[index]!
      if (result.ok) {
        await accept(deps, one, result.id, changed)
        summary.sent += 1
        continue
      }
      if (isRejectionCode(result.code)) {
        const name = await deps.nameOf(one.table, one.source)
        await deps.deleteRecord(one.table, one.entry.recordId)
        changed.add(one.table)
        if (name !== 'silent') rejections.push({ code: result.code, name })
        summary.conflicts += 1
        continue
      }
      // 마지막 기회를 썼다. 안 버리면 못 보내는 건이 영원히 다시 나간다. 기기의 기록은 그대로 남는다.
      if (one.entry.attempts + 1 >= MAX_SYNC_ATTEMPTS) {
        await deps.remove(one.entry.recordId)
        summary.dropped += 1
        continue
      }
      await deps.countAttempt(one.entry.recordId, `${result.code ?? 'rejected'}: ${result.reason}`)
      summary.rejected += 1
    }
  }

  if (changed.size > 0) deps.afterRecordsChanged(changed)
  if (options.notify !== false) for (const message of rejectionMessagesOf(rejections)) deps.notify(message)
  return summary
}
