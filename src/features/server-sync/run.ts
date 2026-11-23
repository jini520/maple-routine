/**
 * 부팅에 도는 회차. 서버가 이 기기의 넥슨 계정을 알게 한다. 대기 표의 기록을 올리는 일은 아직 없다.
 *
 * **첫 화면을 막지 않는다.** 부르는 쪽이 `void` 로 띄우고 결과를 안 기다린다.
 */
import { prepareServerAccounts } from './accounts'

/**
 * 계정을 서버에 알린다. **던지지 않는다.**
 *
 * 부팅 곁가지라 실패해도 앱은 떠야 한다. 저장소가 안 열리거나 서버가 답하지 않으면 그 회차를 건너뛰고 다음 부팅에 다시 한다.
 */
export async function runServerSync(): Promise<void> {
  try {
    await prepareServerAccounts()
  } catch {
    // 다음 회차가 다시 한다.
  }
}
