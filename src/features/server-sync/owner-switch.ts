/**
 * 다른 사람으로 로그인할 때 앞 사람의 기록을 이 기기에서 비우는 일. 로그인 화면의 로그인과 메인 키 바꾸기가 로그인을 저장하기 전에
 * 부른다. 기기에는 지금 로그인한 사람의 기록만 둔다.
 *
 * ```
 * 처음 동기화가 기록을 넣지 않았으면 넣는다
 * 앞 계정과 새 계정의 메이플 ID 가 하나라도 겹치면 같은 사람이다
 * 대기 줄마다 주인을 찾아 앞 사람의 줄을 가린다
 *   있으면 묻는다. `그만두기` → 아무것도 바꾸지 않고 끝낸다. `버리고 로그인` → 그 줄과 기록을 지운다
 * 새 계정에 없는 메이플 ID 와, 다른 사람이면 사람의 기록 · `#` 캐릭터의 기록 · 맞추는 설정을 비우고 그 번호를 지운다
 * 로그인 화면의 로그인은 같은 사람이어도 사람의 번호를 지운다
 * 로그인을 저장하고 첫 받기의 표시를 적는다
 * ```
 *
 * 앞 사람의 기록이 새 사람의 화면에 한 번도 그려지지 않게 받기를 기다리지 않고 저장하기 전에 비운다. 같은 사람인지는 첫 받기의 응답이
 * 다시 답한다.
 *
 * @see docs/foundation/server-sync.md `로그인과 로그아웃`
 */
import { isUnmatchedNexonId } from '../../lib/crypto/nexon-id-hash'
import { getAuthConfig } from '../../storage/api-key'
import { findNexonAccountIdOfMapleIds, getMapleIdsByNexonAccount } from '../../storage/character-accounts'
import { clearServerSyncPersonCursor, setServerSyncSignIn } from '../../storage/server-sync-cursors'
import { enqueueAllServerSyncRecords, getFirstServerSync, type FirstServerSync } from '../../storage/server-sync-first'
import {
  discardServerSyncRecords,
  forgetServerSyncOwners,
  listServerSyncMapleIds,
  ownerOfServerSyncRecord,
  previousOwnerMapleIdHashes,
  type ServerSyncRecordOwner,
} from '../../storage/server-sync-owners'
import type { ServerSyncOwners } from '../../storage/server-sync-pull'
import { listServerSyncQueue, SERVER_SYNC_TABLES, type ServerSyncTable } from '../../storage/server-sync-queue'
import { useUnsyncedPromptStore } from '../auth/unsynced-prompt'
import { nexonIdHashOf } from './push-records'
import { refreshAfterServerSync } from './refresh'

/** 대기 줄 하나. 앞 사람의 것인지 가르고 버린다. */
interface QueuedRecord {
  recordType: string
  recordId: string
}

/** 주인 바꾸기가 밖에 맡기는 일 전부. 테스트가 갈아 끼운다. */
export interface OwnerSwitchDeps {
  getFirstSync(): Promise<FirstServerSync | null>
  enqueueAll(): Promise<unknown>
  queue(): Promise<readonly QueuedRecord[]>
  ownerOf(table: string, recordId: string): Promise<ServerSyncRecordOwner>
  /** 앞 계정의 메이플 ID 해시 */
  previousMapleIds(): Promise<string[]>
  /** 그 메이플 ID 의 넥슨 로그인에 이 기기에서 귀속된 부계정 키의 메이플 ID */
  loginSubKeyMapleIds(mapleIds: readonly string[]): Promise<string[]>
  /** 이 기기에 기록이 있을 수 있는 메이플 ID. 기기 칸의 값이다 */
  deviceMapleIds(): Promise<string[]>
  /** 앞 사람의 대기 줄 수로 묻는다. 버리면 `true` */
  ask(count: number): Promise<boolean>
  discard(entries: readonly QueuedRecord[]): Promise<void>
  forgetOwners(owners: ServerSyncOwners): Promise<void>
  markSignIn(previousMapleIds: readonly string[]): Promise<void>
  /** 사람의 번호만 지운다 */
  resetPersonCursor(): Promise<void>
  /** 비운 표의 화면을 다시 읽게 한다 */
  afterRecordsChanged(tables: ReadonlySet<ServerSyncTable>): void
}

/** 같은 넥슨 ID 로 다시 로그인하면 그 로그인에 귀속된 부계정 키가 다시 이어진다. 로그인의 계정 id 는 메이플 ID 로 찾는다. */
async function loginSubKeyMapleIds(mapleIds: readonly string[]): Promise<string[]> {
  const loginId = await findNexonAccountIdOfMapleIds(mapleIds)
  if (loginId === null) return []
  const [config, byAccount] = await Promise.all([getAuthConfig(), getMapleIdsByNexonAccount()])
  return (config?.apiKeys ?? []).filter((key) => key.loginId === loginId).flatMap((key) => byAccount.get(key.id) ?? [])
}

const DEFAULT_DEPS: OwnerSwitchDeps = {
  getFirstSync: getFirstServerSync,
  enqueueAll: enqueueAllServerSyncRecords,
  queue: listServerSyncQueue,
  ownerOf: ownerOfServerSyncRecord,
  previousMapleIds: previousOwnerMapleIdHashes,
  loginSubKeyMapleIds,
  deviceMapleIds: listServerSyncMapleIds,
  ask: (count) => useUnsyncedPromptStore.getState().ask(count),
  discard: discardServerSyncRecords,
  forgetOwners: forgetServerSyncOwners,
  markSignIn: setServerSyncSignIn,
  resetPersonCursor: clearServerSyncPersonCursor,
  afterRecordsChanged: refreshAfterServerSync,
}

/** 새로 로그인하는 계정. */
export interface NextServerSyncOwner {
  /** 넥슨에서 받은 목록의 메이플 ID */
  mapleIds: readonly string[]
  /** 넥슨 로그인이면 참. 이 기기에서 그 로그인에 귀속된 부계정 키의 메이플 ID 를 더한다 */
  login: boolean
  /** 로그인 화면의 로그인이면 참. 추적 목록을 비워 같은 사람이어도 사람의 번호를 지우고 처음부터 받는다 */
  fresh: boolean
}

/**
 * 앞 사람의 기록을 가려 묻고 비운 뒤 로그인을 저장한다. `그만두기` 면 아무것도 바꾸지 않고 저장하지 않아 `false` 다. 저장이 던지면 그대로
 * 던진다.
 *
 * @param save 로그인을 저장하는 일. 추적 목록 비우기와 함께 넘긴다
 */
export async function switchServerSyncOwner(
  next: NextServerSyncOwner,
  save: () => Promise<void>,
  deps: OwnerSwitchDeps = DEFAULT_DEPS,
): Promise<boolean> {
  // 넣지 않은 기록은 앞 사람의 올리지 못한 기록인지 물을 수 없다. 로그아웃한 채 1.0.15 로 올린 기기다.
  if ((await deps.getFirstSync()) === null) await deps.enqueueAll()

  const nextMapleIds = [...next.mapleIds, ...(next.login ? await deps.loginSubKeyMapleIds(next.mapleIds) : [])]
  const nextHashes = new Set(nextMapleIds.map(nexonIdHashOf))
  const previous = await deps.previousMapleIds()
  // 아는 것 없이 비우면 같은 사람의 기록을 잃는다.
  const samePerson = previous.length === 0 || previous.some((hash) => nextHashes.has(hash))
  // `#` 로 적은 메이플 ID 는 다른 기기에서 등록한 부계정일 수 있어 이 기기의 목록으로 가리지 않는다.
  const isPreviousMapleId = (mapleId: string): boolean => (isUnmatchedNexonId(mapleId) ? !samePerson : !nextHashes.has(nexonIdHashOf(mapleId)))

  const previousRecords: QueuedRecord[] = []
  for (const record of await deps.queue()) {
    const owner = await deps.ownerOf(record.recordType, record.recordId)
    // 사람의 기록과 주인을 모르는 기록은 사람으로 가른다. 주인을 모르는 줄은 대기 표에 계속 남을 수 있어 같은 사람에게 묻지 않는다.
    const previousOne = owner.kind === 'mapleId' ? isPreviousMapleId(owner.mapleId) : !samePerson
    if (previousOne) previousRecords.push(record)
  }
  if (previousRecords.length > 0) {
    if (!(await deps.ask(previousRecords.length))) return false
    await deps.discard(previousRecords)
  }

  // 대기 표에 남은 기록은 새 사람의 것이거나 주인을 모르는 기록이라 비우지 않는다. 다른 사람이면 `#` 캐릭터의 기록과 맞추는 설정도
  // 앞 사람의 것이다.
  const cleared = (await deps.deviceMapleIds()).filter(isPreviousMapleId)
  const forgets = cleared.length > 0 || !samePerson
  if (forgets) await deps.forgetOwners({ mapleIds: cleared, person: !samePerson, anotherPerson: !samePerson })
  // 번호가 이어지면 서버가 번호 뒤의 줄만 주어, 비운 추적 목록이 다시 오지 않는다. 다른 사람이면 위에서 이미 지웠다.
  if (next.fresh && samePerson) await deps.resetPersonCursor()
  // 메모리에 든 설정(추적 방식 · 빠른 이동 · 하단바 순서)과 기록 판이 앞 사람의 값으로 남지 않게 한다.
  if (forgets || previousRecords.length > 0) deps.afterRecordsChanged(new Set(SERVER_SYNC_TABLES))

  await save()
  await deps.markSignIn(previous)
  return true
}
