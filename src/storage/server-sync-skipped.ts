/**
 * 받기가 줄을 넣지 않고 건너뛰는 메이플 ID. Preferences 의 JSON 한 칸이고 메이플 ID 해시마다 까닭을 든다.
 *
 * - `unknown`: 이 기기가 그 메이플 ID 를 모른다. 이 기기에 키가 없는 부계정이다. 알게 되면 처음부터 다시 받는다
 * - `discarded`: 사용자가 이 기기에서 그 메이플 ID 의 기록을 지웠다. 그 계정에 쓸 수 있는 키가 생기면 처음부터 다시 받는다
 *
 * 깨진 값은 빈 목록으로 읽는다. 그러면 건너뛰던 줄이 들어오지만, 다음 받기가 모르는 메이플 ID 를 다시 적는다.
 *
 * @see docs/foundation/server-sync.md `키 없는 부계정의 기록`
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export type ServerSyncSkipReason = 'unknown' | 'discarded'

export type ServerSyncSkippedMapleIds = Record<string, ServerSyncSkipReason>

function isReason(value: unknown): value is ServerSyncSkipReason {
  return value === 'unknown' || value === 'discarded'
}

export async function getServerSyncSkippedMapleIds(): Promise<ServerSyncSkippedMapleIds> {
  const raw = await preferences.get(STORAGE_KEYS.serverSyncSkippedMapleIds)
  if (raw === null) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([, reason]) => isReason(reason))) as ServerSyncSkippedMapleIds
  } catch {
    return {}
  }
}

export async function setServerSyncSkippedMapleIds(skipped: ServerSyncSkippedMapleIds): Promise<void> {
  if (Object.keys(skipped).length === 0) await preferences.remove(STORAGE_KEYS.serverSyncSkippedMapleIds)
  else await preferences.set(STORAGE_KEYS.serverSyncSkippedMapleIds, JSON.stringify(skipped))
}

/**
 * 비운 메이플 ID 를 목록에서 뺀다. 해제하거나 다른 사람으로 로그인해 그 메이플 ID 의 번호를 지울 때 함께 부른다. 남기면 다시 등록한 뒤에도
 * 받기가 그 줄을 건너뛴다.
 *
 * @param mapleIdHashes 비운 메이플 ID 해시
 */
export async function forgetServerSyncSkippedMapleIds(mapleIdHashes: readonly string[]): Promise<void> {
  const skipped = await getServerSyncSkippedMapleIds()
  const left = Object.fromEntries(Object.entries(skipped).filter(([hash]) => !mapleIdHashes.includes(hash)))
  if (Object.keys(left).length !== Object.keys(skipped).length) await setServerSyncSkippedMapleIds(left)
}

export async function clearServerSyncSkippedMapleIds(): Promise<void> {
  await preferences.remove(STORAGE_KEYS.serverSyncSkippedMapleIds)
}

/** 메이플 ID 를 모르고 넣은 옛 `#` 기록을 한 번 비웠나. */
export async function isServerSyncUnmatchedCleared(): Promise<boolean> {
  return (await preferences.get(STORAGE_KEYS.serverSyncUnmatchedCleared)) !== null
}

export async function markServerSyncUnmatchedCleared(): Promise<void> {
  await preferences.set(STORAGE_KEYS.serverSyncUnmatchedCleared, '1')
}
