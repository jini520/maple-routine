/**
 * 키가 있던 기기의 부계정 기록을 이 기기에서만 지우는 `기록 삭제`. 서버와 다른 기기의 기록은 그대로다.
 *
 * @see docs/foundation/server-sync.md `키 없는 부계정의 기록`
 */
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { ownerOfServerSyncRecord, type ServerSyncRecordOwner } from '../../storage/server-sync-owners'
import { clearServerSyncOwners } from '../../storage/server-sync-pull'
import { listServerSyncQueue, SERVER_SYNC_TABLES, type ServerSyncTable } from '../../storage/server-sync-queue'
import {
  getServerSyncSkippedMapleIds,
  setServerSyncSkippedMapleIds,
  type ServerSyncSkippedMapleIds,
} from '../../storage/server-sync-skipped'
import { kickServerSync } from './kick'
import { refreshAfterServerSync } from './refresh'

/** `기록 삭제` 가 밖에 맡기는 일. 테스트가 갈아 끼운다. */
export interface DiscardDeps {
  sync(): Promise<void>
  queue(): Promise<{ recordType: string; recordId: string }[]>
  ownerOf(table: string, recordId: string): Promise<ServerSyncRecordOwner>
  clear(mapleId: string): Promise<void>
  getSkipped(): Promise<ServerSyncSkippedMapleIds>
  setSkipped(skipped: ServerSyncSkippedMapleIds): Promise<void>
  afterRecordsChanged(tables: ReadonlySet<ServerSyncTable>): void
}

const DISCARD_DEPS: DiscardDeps = {
  sync: kickServerSync,
  queue: listServerSyncQueue,
  ownerOf: ownerOfServerSyncRecord,
  clear: (mapleId) => clearServerSyncOwners({ mapleIds: [mapleId], person: false }),
  getSkipped: getServerSyncSkippedMapleIds,
  setSkipped: setServerSyncSkippedMapleIds,
  afterRecordsChanged: refreshAfterServerSync,
}

/**
 * 키가 있던 기기의 메이플 ID 의 기록을 **이 기기에서만** 지운다. 서버와 다른 기기의 기록은 그대로다. 받기가 다시 넣지 않게 건너뛴 목록에
 * 지웠다고 적는다. 그 계정에 쓸 수 있는 키가 다시 생기면 받기가 처음부터 받는다.
 *
 * 지우기 전에 동기화를 한 번 돌린다. 그 메이플 ID 의 대기 줄이 남으면 지우지 않는다. 대기 줄의 원본을 지우면 올리기가 원본이 없다고
 * 지우기를 보내 서버와 다른 기기의 기록까지 지운다.
 *
 * @param mapleId 기기 칸의 메이플 ID(원문)
 * @returns `pending` 이면 올리지 못한 기록이 남아 지우지 않았다
 */
export async function discardKeyLostMapleId(mapleId: string, deps: DiscardDeps = DISCARD_DEPS): Promise<'discarded' | 'pending'> {
  await deps.sync()
  for (const entry of await deps.queue()) {
    const owner = await deps.ownerOf(entry.recordType, entry.recordId)
    if (owner.kind === 'mapleId' && owner.mapleId === mapleId) return 'pending'
  }
  await deps.clear(mapleId)
  await deps.setSkipped({ ...(await deps.getSkipped()), [nexonIdHashHex(mapleId)]: 'discarded' })
  deps.afterRecordsChanged(new Set(SERVER_SYNC_TABLES))
  return 'discarded'
}
