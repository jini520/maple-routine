/**
 * 부팅과 기록을 쓴 뒤에 도는 회차. 서버가 이 기기의 넥슨 계정을 알게 한 뒤 대기 표를 올린다.
 *
 * **첫 화면을 막지 않는다.** 부르는 쪽이 `void` 로 띄우고 결과를 안 기다린다.
 */
import { prepareServerAccounts } from './accounts'
import { pushServerSync } from './push'

/**
 * 계정을 알리고 대기 표를 올린다. **던지지 않는다.**
 *
 * 부팅 곁가지라 실패해도 앱은 떠야 한다. 저장소가 안 열리거나 서버가 답하지 않으면 그 회차를 건너뛰고 다음 회차에 다시 한다.
 */
export async function runServerSync(): Promise<void> {
  try {
    // 기록보다 먼저다. 서버는 기록의 메이플 ID 가 보낸 신원의 것이 아니면 거절한다. 알리기가 실패해도 기록은 보내고, 거절된 건은 대기
    // 표가 다시 보낸다.
    await prepareServerAccounts().catch(() => undefined)
    await pushServerSync()
  } catch {
    // 다음 회차가 다시 한다.
  }
}
