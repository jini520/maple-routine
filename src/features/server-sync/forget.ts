/**
 * 연결 해제가 서버 쪽을 함께 거두는 자리. 처리방침이 적은 삭제 요구권을 사실로 만든다.
 *
 * 하는 일 둘이고 **순서가 요건이다.**
 *
 * 1. 서버에 `내 자리를 지워라` 를 보낸다. **기기에서 키를 지우기 전**이어야 한다 - 자기를 밝힐
 *    값이 그 키에서 나오므로, 지운 뒤에는 무엇을 지워 달라고 말할 길이 없다.
 * 2. 대기 표를 비운다. 남겨 두면 다음에 **다른 키를 넣은 사람이 앞사람의 기록을 자기 이름으로**
 *    올린다.
 *
 * **통신이 실패해도 진행한다.** 기기에서 지우는 것이 본론이고, 그 경우 서버에 표본이 남는다.
 * 처리방침이 그 사실과 문의처를 함께 적는다.
 */
import { deleteMyServerData } from '../../server/drop-price'
import { clearServerSyncQueue } from '../../storage/server-sync-queue'
import { serverIdentityHeaders } from '../auth/server-identity'

/** 지웠는지 돌려준다. `false` 는 통신이 실패했거나 밝힐 수단이 없었다는 뜻이다. */
export async function forgetServerData(): Promise<boolean> {
  let deleted = false
  try {
    const headers = await serverIdentityHeaders()
    if (headers !== null) {
      deleted = (await deleteMyServerData(headers)).outcome === 'sent'
    }
  } catch {
    // 밝힐 수단을 읽다가 터졌다. 아래 비우기는 그래도 해야 한다.
  }

  // 서버에 못 보냈어도 비운다. 못 보낸 줄이 다음 사람의 신원으로 나가는 것이 더 나쁘다.
  try {
    await clearServerSyncQueue()
  } catch {
    // 저장소가 안 열렸다. 연결 해제 자체를 막지 않는다.
  }

  return deleted
}
