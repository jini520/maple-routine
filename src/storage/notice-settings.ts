/**
 * 공지 알림의 두 값. 무엇을 구독하는가와 권한을 물은 적 있는가.
 *
 * 둘은 다른 것이다. 구독은 **받고 싶은가**이고 권한은 **띄울 수 있는가**다. 권한이 있어도
 * 구독을 끄면 안 오고, 구독 중이어도 권한이 없으면 도착만 하고 화면에는 안 뜬다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import { NO_SUBSCRIPTIONS, type NoticeSubscriptions } from '../types/notice'

/**
 * 토글이 하나였던 시절의 값. **지우지 않는다.**
 *
 * 이 값이 켜져 있으면 그 사람은 `notice` 토픽을 이미 구독하고 있고, 그 토픽이 지금은 앱
 * 공지 자리다. 새 칸이 없을 때만 여기서 물려받으므로 마이그레이션 코드가 따로 없다.
 */
export async function getNoticeSubscribed(): Promise<boolean> {
  return (await preferences.get(STORAGE_KEYS.noticeSubscribed)) === 'on'
}

export async function setNoticeSubscribed(subscribed: boolean): Promise<void> {
  await preferences.set(STORAGE_KEYS.noticeSubscribed, subscribed ? 'on' : 'off')
}

/**
 * 네 토글의 상태. 저장된 것이 없으면 **옛 값에서 앱 공지만 물려받는다.**
 *
 * 깨진 JSON 이면 전부 꺼짐으로 읽는다. 켜져 있다고 잘못 읽으면 스위치는 켜져 있는데 구독은
 * 안 한 상태가 되고, 그것은 화면만 보고는 못 가린다. 반대로 꺼짐으로 읽으면 사용자가 다시
 * 켜면 되고 그때 구독이 실제로 걸린다.
 */
export async function getNoticeSubscriptions(): Promise<NoticeSubscriptions> {
  const raw = await preferences.get(STORAGE_KEYS.noticeSubscriptions)
  if (raw === null) return { ...NO_SUBSCRIPTIONS, app: await getNoticeSubscribed() }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return NO_SUBSCRIPTIONS

    const saved = parsed as Record<string, unknown>
    return {
      app: saved.app === true,
      game: saved.game === true,
      update: saved.update === true,
      event: saved.event === true,
      cashshop: saved.cashshop === true,
    }
  } catch {
    return NO_SUBSCRIPTIONS
  }
}

/**
 * 넷을 통째로 적는다.
 *
 * 앱 공지는 **옛 칸에도 함께 적는다.** 이 버전을 쓰다 옛 버전으로 되돌아가는 경로(OTA 회수)가
 * 있고, 그때 옛 코드는 새 칸을 모른다.
 */
export async function setNoticeSubscriptions(next: NoticeSubscriptions): Promise<void> {
  await preferences.set(STORAGE_KEYS.noticeSubscriptions, JSON.stringify(next))
  await setNoticeSubscribed(next.app)
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
