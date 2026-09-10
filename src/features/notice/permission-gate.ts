/**
 * 알림 권한을 묻는 **단 한 번**의 자리.
 *
 * iOS 는 한 번 거부하면 다시 못 묻는다. 시스템 팝업이 두 번째로는 아예 안 뜨고 설정 앱으로
 * 보내는 수밖에 없다. 그래서 이 한 번을 어디에 쓰느냐가 결정이고, 답은 **캐릭터를 고른 직후**다.
 *
 * 첫 실행에 맥락 없이 묻는 것보다 낫다. 캐릭터를 고르는 자리는 앱을 실제로 쓰기 시작한
 * 지점이라 사용자가 이 앱이 무엇인지 안다. 설정을 뒤져 스위치를 찾는 사람만 묻는 것보다도
 * 낫다. 그 사람은 대부분 없다.
 *
 * 대가는 그 자리에서 거부한 사람을 영영 잃는다는 것이다. 그래서 나중에 스위치를 켜는데 권한이
 * 없으면 화면이 OS 설정으로 가는 길을 안내해야 한다.
 */
import { requestNotificationPermission } from '../../native/notifications'
import {
  getNotificationPermissionAsked,
  setNotificationPermissionAsked,
} from '../../storage/notice-settings'
import { useNoticeStore } from './store'

/**
 * 아직 안 물었으면 묻는다. 허용하면 구독까지 켠다.
 *
 * **던지지 않는다.** 부르는 자리가 캐릭터 저장 흐름이라, 여기서 던지면 캐릭터가 안 저장된
 * 것처럼 보인다. 알림은 그 흐름의 곁가지다.
 */
export async function askNotificationPermissionOnce(): Promise<void> {
  if (await getNotificationPermissionAsked()) return

  // **묻기 전에 적는다.** OS 팝업은 뜨는 순간 소모된다. 뒤에 적으면 그 사이에 앱이 죽었을 때
  // 다시 물으려 하고, 그때는 팝업이 안 떠서 사용자는 아무 일도 안 일어난 것을 본다.
  await setNotificationPermissionAsked()

  const granted = await requestNotificationPermission().catch(() => false)
  if (!granted) return

  // 허용한 그 순간이 사용자가 알림을 받겠다고 답한 자리다. 설정에 들어가 다시 켜라고 하지 않는다.
  //
  // **넷을 다 켜지는 않는다.** 업데이트·이벤트와 캐시샵은 패치 날 한꺼번에 올라와서, 묻지도
  // 않고 켜면 그날 알림이 아홉 번 울린다(`topics.ts` 의 DEFAULT_SUBSCRIPTIONS).
  await useNoticeStore.getState().subscribeDefaults().catch(() => undefined)
}
