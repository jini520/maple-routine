/**
 * 공지 구독 상태. 스위치 하나가 값이고, 그 값이 곧 토픽 구독 여부다.
 *
 * **저장보다 구독이 먼저다.** FCM 구독이 실패했는데 켜졌다고 저장하면 스위치는 켜져 있고 알림은
 * 안 오는 상태가 남는다. 그 어긋남은 화면만 보고는 못 가린다. 그래서 구독이 성공한 뒤에만 적는다.
 */
import { create } from 'zustand'

import {
  hasNotificationPermission,
  requestNotificationPermission,
} from '../../native/notifications'
import { subscribeToPushTopic, unsubscribeFromPushTopic } from '../../native/push'
import {
  getNoticeSubscribed,
  getNotificationPermissionAsked,
  setNoticeSubscribed,
  setNotificationPermissionAsked,
} from '../../storage/notice-settings'

/**
 * 구독할 토픽 이름. **JS 에 두는 것이 요건이다.** 네이티브에 박으면 OTA 로 못 바꾼다.
 *
 * 서버가 이 이름으로 쏜다. 바꾸면 발송기도 같이 바꿔야 한다.
 */
export const NOTICE_TOPIC = 'notice'

interface NoticeState {
  subscribed: boolean
  /**
   * 켜려 했는데 알림 권한이 없어 막혔다.
   *
   * 조용히 구독만 하면 스위치는 켜져 있고 알림은 안 오는데, 사용자는 그것을 고장으로 읽는다.
   * iOS 는 여기서 팝업을 다시 못 띄우므로 말해 주는 것 말고 할 수 있는 일이 없다.
   */
  blockedByPermission: boolean
  /** 저장된 값을 상태에 올린다. 토픽을 다시 구독하지 않는다. */
  restore: () => Promise<void>
  setSubscribed: (subscribed: boolean) => Promise<void>
}

/**
 * 권한이 없을 때 한 번 더 시도한다. 받아 냈으면 참.
 *
 * **한 번도 안 물었으면 여기서 묻는다.** iOS 는 앱이 한 번도 안 물으면 설정에 그 앱의 알림
 * 항목을 아예 안 만든다. 그래서 그 상태로 설정에 보내면 갈 곳이 없는 막다른 길이 된다.
 * 스위치를 켜는 것도 사용자가 알림을 원한다고 말한 자리이므로 묻기에 맞다.
 *
 * **이미 물었으면 다시 안 묻는다.** 그때는 OS 가 팝업을 안 띄워서 부르나 마나이고, 설정으로
 * 보내는 것 말고 할 수 있는 일이 없다.
 */
async function ensurePermission(): Promise<boolean> {
  if (await getNotificationPermissionAsked()) return false

  // 묻기 전에 적는다. 팝업은 뜨는 순간 소모된다.
  await setNotificationPermissionAsked()
  return requestNotificationPermission().catch(() => false)
}

export const useNoticeStore = create<NoticeState>()((set) => ({
  subscribed: false,
  blockedByPermission: false,
  async restore() {
    set({ subscribed: await getNoticeSubscribed() })
  },
  async setSubscribed(subscribed) {
    if (subscribed) {
      // **켤 때만 권한을 본다.** 끄는 길은 권한과 무관하고, 거기서 막으면 권한 없는 사용자가
      // 구독을 해제할 방법이 없어진다.
      if (!(await hasNotificationPermission()) && !(await ensurePermission())) {
        set({ blockedByPermission: true })
        return
      }
      await subscribeToPushTopic(NOTICE_TOPIC)
    } else {
      await unsubscribeFromPushTopic(NOTICE_TOPIC)
    }

    await setNoticeSubscribed(subscribed)
    set({ subscribed, blockedByPermission: false })
  },
}))
