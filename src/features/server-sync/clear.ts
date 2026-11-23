/**
 * 데이터 삭제. 서버에 올리는 기록 묶음은 서버에서 먼저 지우고, 서버가 지운 뒤에만 기기에서 지운다. 기기에서만 지우면 다음 받기가
 * 서버의 기록을 다시 넣는다.
 *
 * ```
 * 동기화를 멈춘다. 도는 동기화가 있으면 끝나기를 기다린다
 * 기록 묶음을 골랐고 신원이 있으면 서버에서 지운다
 *   응답 없음 · 거절 → 멈춤을 풀고 아무것도 지우지 않는다
 * 기기에서 지우고 앱을 다시 띄운다. 멈춤은 풀지 않는다
 * ```
 *
 * @see docs/foundation/server-sync.md `데이터 삭제`
 */
import { clearSyncRecords, type SyncClearGroup } from '../../server/sync'
import type { SendResult } from '../../server/write'
import type { CacheDataSelection } from '../../storage/cache-data'
import { serverIdentityHeaders } from '../auth/server-identity'
import { clearCacheDataAndReload } from '../settings/cache-data'
import { holdServerSync } from './kick'

/** 서버에 올리는 기록 묶음. `캐시` 는 서버에 올리지 않는 값이다. */
const RECORD_GROUPS: readonly SyncClearGroup[] = ['manual', 'boss', 'cashbook', 'enhancement']

/** 데이터 삭제가 밖에 맡기는 일 전부. 테스트가 갈아 끼운다. */
export interface ClearDeps {
  hold(): Promise<() => void>
  identity(): Promise<Record<string, string> | null>
  clearOnServer(headers: Record<string, string>, groups: readonly SyncClearGroup[]): Promise<SendResult>
  clearDeviceAndReload(selection: CacheDataSelection, reload: () => void): Promise<void>
}

const DEFAULT_DEPS: ClearDeps = {
  hold: holdServerSync,
  identity: serverIdentityHeaders,
  clearOnServer: clearSyncRecords,
  clearDeviceAndReload: clearCacheDataAndReload,
}

/**
 * 고른 그룹을 서버와 기기에서 지우고 앱을 다시 띄운다. 서버가 지우지 못하면 아무것도 지우지 않고 `false` 다. 알리는 것은 화면이 한다.
 *
 * 지우는 동안 동기화를 멈춘다. 도는 올리기가 지운 묶음을 다시 올리면 서버가 기기에 id 가 없는 기록과 굳은 날을 되살린다. 기기에서
 * 지운 뒤에는 풀지 않는다. 풀면 미룬 동기화가 다시 띄우기 전에 닫은 DB 를 다시 연다.
 *
 * @param reload 다시 띄우는 함수. 화면이 넘긴다
 */
export async function clearRecordGroupsAndReload(
  selection: CacheDataSelection,
  reload: () => void,
  deps: ClearDeps = DEFAULT_DEPS,
): Promise<boolean> {
  const release = await deps.hold()
  const groups = RECORD_GROUPS.filter((group) => selection[group])
  // 신원이 없는 기기의 기록은 서버에 올라간 적이 없다.
  const headers = groups.length === 0 ? null : await deps.identity()
  if (headers !== null && (await deps.clearOnServer(headers, groups)).outcome !== 'sent') {
    release()
    return false
  }
  await deps.clearDeviceAndReload(selection, reload)
  return true
}
