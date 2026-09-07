/**
 * 공지 알림의 두 값. 구독 여부와 권한을 물은 적 있는가.
 *
 * 둘은 다른 것이다. 구독은 **받고 싶은가**이고 권한은 **띄울 수 있는가**다. 권한이 있어도
 * 구독을 끄면 안 오고, 구독 중이어도 권한이 없으면 도착만 하고 화면에는 안 뜬다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/** 기본은 꺼짐. 켠 사람만 받는다. */
export async function getNoticeSubscribed(): Promise<boolean> {
  return (await preferences.get(STORAGE_KEYS.noticeSubscribed)) === 'on'
}

export async function setNoticeSubscribed(subscribed: boolean): Promise<void> {
  await preferences.set(STORAGE_KEYS.noticeSubscribed, subscribed ? 'on' : 'off')
}

/**
 * 물은 적 있으면 참. **OS 에 묻지 않고 우리가 기억한다.**
 *
 * 안드로이드의 `denied` 는 거부했다와 아직 안 물었다를 구분해 주지 않는 상태가 있다. 그것을
 * 안 물었다로 읽으면 거부한 사용자에게 팝업이 계속 뜬다.
 */
export async function getNotificationPermissionAsked(): Promise<boolean> {
  return (await preferences.get(STORAGE_KEYS.notificationPermissionAsked)) === 'yes'
}

/**
 * 물었다고 적는다. **되돌리는 함수를 두지 않는다.** 물은 사실은 취소되지 않고, 되돌릴 수 있게
 * 두면 그 길이 곧 사용자에게 팝업을 두 번 띄우는 길이 된다.
 */
export async function setNotificationPermissionAsked(): Promise<void> {
  await preferences.set(STORAGE_KEYS.notificationPermissionAsked, 'yes')
}
