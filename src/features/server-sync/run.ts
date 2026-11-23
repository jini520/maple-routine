/**
 * 한 번의 동기화. 서버가 이 기기의 넥슨 계정을 알게 한 뒤 대기 표를 올리고 다른 기기가 올린 기록을 받는다.
 *
 * **첫 화면을 막지 않는다.** 부르는 쪽이 `void` 로 띄우고 결과를 안 기다린다.
 */
import { prepareServerAccounts } from './accounts'
import { pullServerSync } from './pull'
import { pushServerSync } from './push'

/**
 * 계정을 알리고 올린 뒤 받는다. **던지지 않는다.**
 *
 * 부팅 곁가지라 실패해도 앱은 떠야 한다. 저장소가 안 열리거나 서버가 답하지 않으면 그 단계를 건너뛰고 다음 동기화에 다시 한다.
 * 올리기를 먼저 해야 아직 못 올린 기기 값이 받은 값에 덮이지 않고, 올리기의 거절로 지운 줄의 서버 값이 같은 동기화에 들어온다.
 * 올리기가 멈춰도 받는다. 남은 대기 줄의 기록은 받기가 건너뛴다.
 */
export async function runServerSync(): Promise<void> {
  // 기록보다 먼저다. 서버는 기록의 메이플 ID 가 보낸 신원의 것이 아니면 거절한다. 알리기가 실패해도 기록은 보내고, 거절된 건은 대기
  // 표가 다시 보낸다.
  await prepareServerAccounts().catch(() => undefined)
  await pushServerSync().catch(() => undefined)
  await pullServerSync().catch(() => undefined)
}
