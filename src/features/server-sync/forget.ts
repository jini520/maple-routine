/**
 * 로그아웃 · 계정 삭제가 서버 쪽을 거두는 자리.
 *
 * - 계정 삭제는 **기기에서 키를 지우기 전**에 보낸다. 서버가 사람을 찾을 값이 그 키에서 나온다.
 * - 못 보낸 것(대기 표 · 사용 로그 표)은 로그아웃할 때 비운다. 누가 만든 줄인지 적혀 있지 않아, 남기면 다음에 다른 키로
 *   로그인한 사람의 신원으로 나간다.
 */
import { deleteMeOnServer } from '../../server/account-deletion'
import { clearServerSyncQueue } from '../../storage/server-sync-queue'
import { clearUsageEvents } from '../../storage/usage-events'
import { serverIdentityHeaders } from '../auth/server-identity'

/** 계정 삭제를 예약한다. 서버가 받았을 때만 `true` 다. 던지지 않는다. */
export async function requestAccountDeletion(): Promise<boolean> {
  try {
    const headers = await serverIdentityHeaders()
    if (headers === null) return false
    return (await deleteMeOnServer(headers)).outcome === 'sent'
  } catch {
    return false
  }
}

/** 못 보낸 것을 버린다. 하나가 터져도 나머지를 비우고 던지지 않는다. 로그아웃을 막지 않는다. */
export async function clearUnsentServerData(): Promise<void> {
  await Promise.allSettled([clearServerSyncQueue(), clearUsageEvents()])
}
