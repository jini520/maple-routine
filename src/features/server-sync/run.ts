/**
 * 부팅과 기록을 쓴 뒤에 도는 자리. 서버가 계정을 알게 한 뒤, 저장소 어댑터와 레지스트리를 고리에 꽂아 대기 표를 비운다.
 *
 * **첫 화면을 막지 않는다.** 부르는 쪽이 `void` 로 띄우고 결과를 안 기다린다.
 */
import {
  countServerSyncAttempt,
  listServerSyncQueue,
  removeServerSync,
} from '../../storage/server-sync-queue'
import { serverIdentityHeaders } from '../auth/server-identity'
import { prepareServerAccounts } from './accounts'
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
    // 기록보다 먼저다. 서버는 기록의 메이플 ID 가 보낸 계정에 없으면 거절한다. 실패해도 기록은 보내고, 거절된 건은 대기 표가
    // 다시 보낸다.
    await prepareServerAccounts().catch(() => undefined)
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
