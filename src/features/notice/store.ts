/**
 * 공지 구독 상태. 스위치 하나가 값이고, 그 값이 곧 토픽 구독 여부다.
 *
 * **저장보다 구독이 먼저다.** FCM 구독이 실패했는데 켜졌다고 저장하면 스위치는 켜져 있고 알림은
 * 안 오는 상태가 남는다. 그 어긋남은 화면만 보고는 못 가린다. 그래서 구독이 성공한 뒤에만 적는다.
 */
import { create } from 'zustand'

import { subscribeToPushTopic, unsubscribeFromPushTopic } from '../../native/push'
import { getNoticeSubscribed, setNoticeSubscribed } from '../../storage/notice-settings'

/**
 * 구독할 토픽 이름. **JS 에 두는 것이 요건이다.** 네이티브에 박으면 OTA 로 못 바꾼다.
 *
 * 서버가 이 이름으로 쏜다. 바꾸면 발송기도 같이 바꿔야 한다.
 */
export const NOTICE_TOPIC = 'notice'

interface NoticeState {
  subscribed: boolean
  /** 저장된 값을 상태에 올린다. 토픽을 다시 구독하지 않는다. */
  restore: () => Promise<void>
  setSubscribed: (subscribed: boolean) => Promise<void>
}

export const useNoticeStore = create<NoticeState>()((set) => ({
  subscribed: false,
  async restore() {
    set({ subscribed: await getNoticeSubscribed() })
  },
  async setSubscribed(subscribed) {
    // 구독이 먼저다. 실패하면 여기서 던지고 저장도 상태도 안 바뀐다.
    if (subscribed) {
      await subscribeToPushTopic(NOTICE_TOPIC)
    } else {
      await unsubscribeFromPushTopic(NOTICE_TOPIC)
    }

    await setNoticeSubscribed(subscribed)
    set({ subscribed })
  },
}))
