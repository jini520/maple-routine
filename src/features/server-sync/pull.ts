/**
 * 다른 기기가 올린 기록을 `POST /v1/sync/pull` 로 받아 기기에 넣는 동기화의 한 부분. 올리기 다음에 돈다.
 *
 * ```
 * 짝이 생긴 `#` 값을 원문으로 바꾼다
 * 기억한 번호를 보낸다
 *   응답 없음 · 요청 전체의 거절 → 번호를 두고 멈춘다
 *   로그인 뒤 첫 응답 → 그 목록에 없는 메이플 ID 의 기록을 비운다. 앞 계정과 겹치지 않으면 사람의 기록도 비우고 다시 받는다
 *   첫 응답의 메이플 ID 목록에서 앞 목록에 있던 메이플 ID 가 빠졌다 → 다른 기기가 해제한 부계정과 그 기록을 이 기기에서 뺀다
 *   번호가 0 보다 크고 가장 오래된 삭제 표식보다 작은 주인 → 그 주인의 기록을 비우고 번호를 0 으로 적어 다시 받는다
 *   받은 줄을 표 차례로 기기 칸으로 바꿔 넣는다. 넣지 못한 줄은 건너뛴다
 *   응답의 번호를 적는다. `hasMore` 면 이어 받는다. 번호가 그대로면 멈춘다
 * 넣은 표의 화면을 다시 읽게 한다
 * ```
 *
 * @see docs/foundation/server-sync.md `받기`
 */
import { pullSyncRecords, type SyncPullOutcome, type SyncPullCursors, type SyncPullResponse } from '../../server/sync'
import {
  clearServerSyncSignIn,
  getServerSyncCursors,
  getServerSyncSignIn,
  setServerSyncCursors,
  type ServerSyncCursors,
  type ServerSyncSignIn,
} from '../../storage/server-sync-cursors'
import { forgetServerSyncMapleIds, listServerSyncMapleIds } from '../../storage/server-sync-owners'
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
import {
  applyPulledPreferenceRecords,
  type PulledPreferenceOptions,
  type PulledPreferenceRecord,
} from '../../storage/server-sync-pull-preferences'
import { replaceMatchedNexonIds } from '../../storage/server-sync-unmatched'
import { SERVER_SYNC_TABLES, type ServerSyncTable } from '../../storage/server-sync-queue'
import { whenRecordsReleased } from '../../storage/record-hold'
import { unmatchedNexonIdOf } from '../../lib/crypto/nexon-id-hash'
import { forgetReleasedSubAccounts } from '../account-manage/store'
import { serverIdentityHeaders } from '../auth/server-identity'
import { pulledRecordOf, type NexonIdResolver } from './pull-records'
import { nexonIdHashOf } from './push-records'
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
  applyPreferences(records: readonly PulledPreferenceRecord[], options: PulledPreferenceOptions): Promise<void>
  clearOwners(owners: ServerSyncOwners): Promise<void>
  /** 짝이 생긴 `#` 값을 원문으로 바꾸고 바꾼 표를 돌려준다 */
  replaceMatched(lookup: NexonIdLookup): Promise<Set<ServerSyncTable>>
  /** 다른 기기가 해제한 부계정을 이 기기에서 뺀다 */
  forgetReleasedSubAccounts(mapleIdHashes: ReadonlySet<string>): Promise<void>
  /** 해제한 메이플 ID 의 기록을 대기 중인 것까지 비우고 번호를 지운다 */
  forgetMapleIds(mapleIdHashes: readonly string[]): Promise<void>
  getSignIn(): Promise<ServerSyncSignIn | null>
  clearSignIn(): Promise<void>
  /** 이 기기에 기록이 있을 수 있는 메이플 ID. 기기 칸의 값이다 */
  deviceMapleIds(): Promise<string[]>
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
  replaceMatched: replaceMatchedNexonIds,
  forgetReleasedSubAccounts,
  forgetMapleIds: forgetServerSyncMapleIds,
  getSignIn: getServerSyncSignIn,
  clearSignIn: clearServerSyncSignIn,
  deviceMapleIds: listServerSyncMapleIds,
  afterRecordsChanged: refreshAfterServerSync,
}

export interface PullOptions {
  /**
   * 처음 동기화가 대기 표에 넣기를 마친 시각. 처음 동기화의 받기에서만 준다. id 가 없는 Preferences 기록은 처음 올리기의 대기 줄이
   * 있어도 서버 값을 남긴다
   */
  firstQueuedAt?: string
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
  /** `hasMore` 가 꺼질 때까지 받았다. 처음 동기화는 이것이 참일 때만 올린다 */
  finished: boolean
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

/**
 * 다른 기기에서 해제한 부계정의 메이플 ID. 앞 받기의 목록(번호의 메이플 ID 열쇠)에 있다 빠진 것이다. 서버는 이 신원이 쓸 수 있는
 * 메이플 ID 마다 번호를 돌려준다. 번호의 넥슨 계정 줄이 응답과 다르면(다른 사람의 로그인 · 합쳐진 줄) 목록이 바뀌는 것이 해제가
 * 아니라 견주지 않는다.
 */
function releasedMapleIdHashesOf(sent: ServerSyncCursors, response: SyncPullResponse): Set<string> {
  if (sent.nexonAccount === null || sent.nexonAccount.id !== response.cursors.nexonAccount.id) return new Set()
  const owned = new Set(response.mapleIds)
  return new Set(Object.keys(sent.mapleIds).filter((hash) => !owned.has(hash)))
}

/**
 * 로그인 뒤 첫 응답으로 비울 주인. 응답의 목록에 없는 메이플 ID 와, 앞 계정의 메이플 ID 가 응답의 목록과 하나도 겹치지 않으면 사람이다.
 * 같은 사람인지는 서버가 답한다. 로그인할 때 기기가 비운 것은 기기가 아는 새 계정의 메이플 ID 로 가린 것이다.
 */
function signInOwnersOf(signIn: ServerSyncSignIn, device: readonly string[], response: SyncPullResponse): ServerSyncOwners {
  const listed = new Set(response.mapleIds)
  const previous = signIn.previousMapleIds
  return {
    mapleIds: device.filter((mapleId) => !listed.has(nexonIdHashOf(mapleId))),
    person: previous.length > 0 && !previous.some((hash) => listed.has(hash)),
  }
}

function sameCursors(left: ServerSyncCursors, right: SyncPullResponse['cursors']): boolean {
  return JSON.stringify(left) === JSON.stringify({ nexonAccount: right.nexonAccount, mapleIds: right.mapleIds })
}

/** 한 쪽의 줄을 표 차례로 넣는다. 한 줄 때문에 받기가 멈추면 번호가 오르지 않아 같은 줄에서 계속 멈추므로, 넣지 못한 줄은 건너뛴다. */
async function applyPage(
  deps: PullDeps,
  options: PullOptions,
  records: SyncPullResponse['records'],
  resolver: NexonIdResolver,
  summary: PullSummary,
  changed: Set<ServerSyncTable>,
): Promise<void> {
  const preferences: PulledPreferenceRecord[] = []
  // 처음 동기화는 추적 목록의 대표를 서버에 맞춘다. 짝이 없는 대표를 모르면 기기 쪽 대표가 올라가 서버가 그 대표를 내린다.
  let unpairedRepresentative = false
  for (const table of SERVER_SYNC_TABLES) {
    for (const row of records[table] ?? []) {
      const record = pulledRecordOf(table, row, resolver)
      if (record === null) {
        if (options.firstQueuedAt !== undefined && table === 'trackedCharacters' && row.isRepresentative === true && row.deletedAt == null) {
          unpairedRepresentative = true
        }
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
  if (preferences.length > 0 || unpairedRepresentative) {
    await deps.applyPreferences(preferences, { firstQueuedAt: options.firstQueuedAt, unpairedRepresentative })
  }
}

/**
 * 받는다. **던지지 않는 쪽은 부르는 쪽이다.** 저장소가 던지면 그대로 올라가고 번호는 적지 않는다. 다음 동기화가 같은 번호로 다시 받는다.
 *
 * 신원이 없으면 아무것도 안 한다. 키를 지웠거나 로그인 전인 상태다.
 */
export async function pullServerSync(options: PullOptions = {}, deps: PullDeps = DEFAULT_DEPS): Promise<PullSummary> {
  const summary: PullSummary = { pages: 0, applied: 0, skipped: 0, stopped: false, finished: false }
  const headers = await deps.identity()
  if (headers === null) return summary
  // 기기 변환 전의 기록은 칸이 서버와 달라 넣을 수 없다.
  await whenRecordsReleased()

  const lookup = await deps.lookup()
  const resolver = resolverOf(lookup)
  // 받은 줄의 유일 기준이 기기 줄과 맞도록 먼저 바꾼다.
  const changed = await deps.replaceMatched(lookup)
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
      if (page === 0) {
        const signIn = await deps.getSignIn()
        if (signIn !== null) {
          const owners = signInOwnersOf(signIn, await deps.deviceMapleIds(), response)
          // 대기 표에 남은 기록은 새 사람의 것이거나 주인을 모르는 기록이라 비우지 않는다.
          if (owners.mapleIds.length > 0 || owners.person) {
            await deps.clearOwners(owners)
            for (const table of SERVER_SYNC_TABLES) changed.add(table)
          }
          await deps.clearSignIn()
          if (owners.person) {
            // 번호의 넥슨 계정 줄이 응답과 같으면 서버가 번호 뒤의 줄만 주어 비운 기록이 돌아오지 않는다.
            await deps.setCursors({ nexonAccount: null, mapleIds: sent.mapleIds })
            continue
          }
        }
        const released = releasedMapleIdHashesOf(sent, response)
        if (released.size > 0) {
          await deps.forgetReleasedSubAccounts(released)
          // 해제한 메이플 ID 의 기록은 서버가 받지 않는다. 다시 등록하면 번호가 없어 0 부터 받는다.
          await deps.forgetMapleIds([...released])
          for (const table of SERVER_SYNC_TABLES) changed.add(table)
        }
      }

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

      await applyPage(deps, options, response.records, resolver, summary, changed)
      await deps.setCursors({ nexonAccount: response.cursors.nexonAccount, mapleIds: response.cursors.mapleIds })
      if (!response.hasMore) {
        summary.finished = true
        break
      }
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
