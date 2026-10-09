/**
 * 부팅에 한 번 도는 자리. 저장소 어댑터와 레지스트리를 고리에 꽂는다.
 *
 * **첫 화면을 막지 않는다.** 부르는 쪽이 `void` 로 띄우고 결과를 안 기다린다.
 */
import {
  countServerSyncAttempt,
  listServerSyncQueue,
  removeServerSync,
} from '../../storage/server-sync-queue'
import { serverIdentityHeaders } from '../auth/server-identity'
import { SYNC_HANDLERS } from './registry'
import { sweepServerSync, type SweepResult } from './sweep'

/**
 * 못 보낸 것을 다시 보낸다. **던지지 않는다.**
 *
 * 부팅 곁가지라 실패해도 앱은 떠야 한다. 저장소가 안 열리거나 고리가 터지면 그 회차를 건너뛰고
 * 다음 부팅에 다시 시도한다.
 */
export async function runServerSync(): Promise<SweepResult | null> {
  try {
    return await sweepServerSync({
      identity: serverIdentityHeaders,
      list: listServerSyncQueue,
      countAttempt: countServerSyncAttempt,
      remove: removeServerSync,
      handlers: SYNC_HANDLERS,
    })
  } catch {
    return null
  }
}
