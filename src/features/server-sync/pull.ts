/**
 * 다른 기기가 올린 기록을 `POST /v1/sync/pull` 로 받아 기기에 넣는 동기화의 한 부분. 올리기 다음에 돈다.
 *
 * ```
 * 기억한 번호를 보낸다
 *   응답 없음 · 요청 전체의 거절 → 번호를 두고 멈춘다
 *   번호가 0 보다 크고 가장 오래된 삭제 표식보다 작은 주인 → 그 주인의 기록을 비우고 번호를 0 으로 적어 다시 받는다
 *   받은 줄을 표 차례로 기기 칸으로 바꿔 넣는다. 넣지 못한 줄은 건너뛴다
 *   응답의 번호를 적는다. `hasMore` 면 이어 받는다. 번호가 그대로면 멈춘다
 * 넣은 표의 화면을 다시 읽게 한다
 * ```
 *
 * @see docs/foundation/server-sync.md `받기`
 */
import { pullSyncRecords, type SyncPullOutcome, type SyncPullCursors, type SyncPullResponse } from '../../server/sync'
import { getServerSyncCursors, setServerSyncCursors, type ServerSyncCursors } from '../../storage/server-sync-cursors'
import {
  applyPulledSettledDay,
  applyPulledSqliteRecord,
  clearServerSyncOwners,
  loadNexonIdLookup,
  type NexonIdLookup,
  type PulledSettledDay,
  type PulledSqliteRecord,
  type ServerSyncOwners,
} from '../../storage/server-sync-pull'
import { applyPulledPreferenceRecords, type PulledPreferenceRecord } from '../../storage/server-sync-pull-preferences'
import { SERVER_SYNC_TABLES, type ServerSyncTable } from '../../storage/server-sync-queue'
import { whenRecordsReleased } from '../../storage/record-hold'
import { unmatchedNexonIdOf } from '../../lib/crypto/nexon-id-hash'
import { serverIdentityHeaders } from '../auth/server-identity'
import { pulledRecordOf, type NexonIdResolver } from './pull-records'
import { refreshAfterServerSync } from './refresh'

/** 한 동기화에서 이어 받는 쪽의 상한. 한 쪽이 500줄이라 5만 줄이다. 넘으면 다음 동기화가 이어 받는다. */
const MAX_PAGES = 100

/** 받기가 밖에 맡기는 일 전부. 테스트가 갈아 끼운다. */
export interface PullDeps {
  identity(): Promise<Record<string, string> | null>
  getCursors(): Promise<ServerSyncCursors>
  setCursors(cursors: ServerSyncCursors): Promise<void>
  pull(headers: Record<string, string>, cursors: SyncPullCursors): Promise<SyncPullOutcome>
  lookup(): Promise<NexonIdLookup>
  /** 넣었으면 참, 건너뛰었으면 거짓. 기기 표가 받지 않으면 던진다 */
  applySqlite(record: PulledSqliteRecord): Promise<boolean>
  applySettledDay(record: PulledSettledDay): Promise<boolean>
  applyPreferences(records: readonly PulledPreferenceRecord[]): Promise<void>
  clearOwners(owners: ServerSyncOwners): Promise<void>
  /** 기기 줄을 고치거나 지운 표. 그 표를 읽는 화면이 다시 읽게 한다 */
  afterRecordsChanged(tables: ReadonlySet<ServerSyncTable>): void
}

const DEFAULT_DEPS: PullDeps = {
  identity: serverIdentityHeaders,
  getCursors: getServerSyncCursors,
  setCursors: setServerSyncCursors,
  pull: pullSyncRecords,
  lookup: loadNexonIdLookup,
  applySqlite: applyPulledSqliteRecord,
  applySettledDay: applyPulledSettledDay,
  applyPreferences: applyPulledPreferenceRecords,
  clearOwners: clearServerSyncOwners,
  afterRecordsChanged: refreshAfterServerSync,
}

/** 한 번의 받기가 한 일. 화면에 안 쓰고 테스트가 본다. */
export interface PullSummary {
  pages: number
  /** 넣거나 지운 줄 */
  applied: number
  /** 대기 중이거나 기기 표가 받지 않아 건너뛴 줄 */
  skipped: number
  /** 응답이 없거나 요청 전체가 거절되거나 번호가 그대로라 멈췄다 */
  stopped: boolean
}

function resolverOf(lookup: NexonIdLookup): NexonIdResolver {
  return {
    ocidOf: (hash) => lookup.ocids.get(hash) ?? null,
    mapleIdOf: (hash) => lookup.mapleIds.get(hash) ?? null,
    nexonAccountIdOf: (mapleId) => lookup.nexonAccountIds.get(mapleId) ?? null,
  }
}

/**
 * 받은 지 오래되어 서버가 지운 표식을 놓친 주인. 번호가 0 인 주인은 받은 적이 없어 비울 것이 없다. 넥슨 계정 줄이 바뀐 사람의 번호는
 * 서버가 0 으로 본다.
 */
function staleOwnersOf(sent: ServerSyncCursors, response: SyncPullResponse): { mapleIdHashes: string[]; person: boolean } {
  const oldest = response.oldestDeletedChangeSeq
  if (oldest === null) return { mapleIdHashes: [], person: false }
  const stale = (seq: number): boolean => seq > 0 && seq < oldest
  const account = sent.nexonAccount
  return {
    mapleIdHashes: response.mapleIds.filter((hash) => stale(sent.mapleIds[hash] ?? 0)),
    person: account !== null && account.id === response.cursors.nexonAccount.id && stale(account.changeSeq),
  }
}

function sameCursors(left: ServerSyncCursors, right: SyncPullResponse['cursors']): boolean {
  return JSON.stringify(left) === JSON.stringify({ nexonAccount: right.nexonAccount, mapleIds: right.mapleIds })
}

/** 한 쪽의 줄을 표 차례로 넣는다. 한 줄 때문에 받기가 멈추면 번호가 오르지 않아 같은 줄에서 계속 멈추므로, 넣지 못한 줄은 건너뛴다. */
async function applyPage(
  deps: PullDeps,
  records: SyncPullResponse['records'],
  resolver: NexonIdResolver,
  summary: PullSummary,
  changed: Set<ServerSyncTable>,
): Promise<void> {
  const preferences: PulledPreferenceRecord[] = []
  for (const table of SERVER_SYNC_TABLES) {
    for (const row of records[table] ?? []) {
      const record = pulledRecordOf(table, row, resolver)
      if (record === null) {
        summary.skipped += 1
        continue
      }
      if (record.table === 'enhancementSettledDays' || 'row' in record) {
        let applied = false
        try {
          applied = record.table === 'enhancementSettledDays' ? await deps.applySettledDay(record) : await deps.applySqlite(record)
        } catch {
          // 기기 표의 CHECK 에 걸리는 줄이다. 그 줄만 넣지 않는다.
        }
        if (applied) {
          summary.applied += 1
          changed.add(table)
        } else {
          summary.skipped += 1
        }
        continue
      }
      preferences.push(record)
      summary.applied += 1
      changed.add(table)
    }
  }
  if (preferences.length > 0) await deps.applyPreferences(preferences)
}

/**
 * 받는다. **던지지 않는 쪽은 부르는 쪽이다.** 저장소가 던지면 그대로 올라가고 번호는 적지 않는다. 다음 동기화가 같은 번호로 다시 받는다.
 *
 * 신원이 없으면 아무것도 안 한다. 키를 지웠거나 로그인 전인 상태다.
 */
export async function pullServerSync(deps: PullDeps = DEFAULT_DEPS): Promise<PullSummary> {
  const summary: PullSummary = { pages: 0, applied: 0, skipped: 0, stopped: false }
  const headers = await deps.identity()
  if (headers === null) return summary
  // 기기 변환 전의 기록은 칸이 서버와 달라 넣을 수 없다.
  await whenRecordsReleased()

  const resolver = resolverOf(await deps.lookup())
  const changed = new Set<ServerSyncTable>()
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const sent = await deps.getCursors()
      const outcome = await deps.pull(headers, sent)
      if (outcome.outcome !== 'answered') {
        summary.stopped = true
        break
      }
      summary.pages += 1
      const response = outcome.response

      const stale = staleOwnersOf(sent, response)
      if (stale.mapleIdHashes.length > 0 || stale.person) {
        // 옛 번호 뒤의 줄만 실려 지운 줄을 놓친 응답이라 넣지 않는다.
        await deps.clearOwners({
          mapleIds: stale.mapleIdHashes.map((hash) => resolver.mapleIdOf(hash) ?? unmatchedNexonIdOf(hash)),
          person: stale.person,
        })
        for (const table of SERVER_SYNC_TABLES) changed.add(table)
        await deps.setCursors({
          nexonAccount: stale.person ? null : sent.nexonAccount,
          mapleIds: { ...sent.mapleIds, ...Object.fromEntries(stale.mapleIdHashes.map((hash) => [hash, 0])) },
        })
        continue
      }

      await applyPage(deps, response.records, resolver, summary, changed)
      await deps.setCursors({ nexonAccount: response.cursors.nexonAccount, mapleIds: response.cursors.mapleIds })
      if (!response.hasMore) break
      // 서버가 같은 쪽을 계속 주면 끝나지 않는다.
      if (sameCursors(sent, response.cursors)) {
        summary.stopped = true
        break
      }
    }
  } finally {
    if (changed.size > 0) deps.afterRecordsChanged(changed)
  }
  return summary
}
