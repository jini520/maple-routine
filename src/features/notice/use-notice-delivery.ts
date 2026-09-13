/**
 * 공지 푸시가 앱에 닿는 경로 셋을 한 자리에서 잇는 훅.
 *
 * ```
 * 앞에 있을 때 도착      onMessage                FCM 이 OS 에 안 넘긴다. 여기서만 받는다
 * 배경에서 탭            onNotificationOpenedApp
 * 죽어 있다 탭으로 열림   getInitialNotification   한 번만 답한다
 * ```
 *
 * **하나라도 빠지면 어떤 경로에서만 안 먹는다.** 코드를 읽어서는 안 보이고 기기에서 그 경로를
 * 밟아야 드러나는 종류의 결함이라, 셋을 한 파일에 모아 두고 테스트가 셋을 다 센다.
 *
 * **배경에서 도착만 하고 안 탭한 것은 여기 안 온다.** `notification` 페이로드는 OS 가 직접
 * 그리고 JS 를 안 깨우기 때문이다. 그 구멍은 서버 조회가 메운다.
 *
 * **어느 길도 기기에 쓰지 않는다.** 공지의 기준은 서버라서, 앞에서 오면 배너가 서버를 다시 묻고
 * 탭하면 상세가 서버에 묻는다.
 */
import { useEffect } from 'react'

import {
  addPushMessageListener,
  addPushOpenedListener,
  getInitialPushNotification,
  type PushData,
} from '../../native/push'
import { useNoticeBannerStore } from './banner-store'
import { parseNotice } from './receive'

export function useNoticeDelivery(
  /** 상세로 미는 함수. 공지로 읽히는 푸시를 탭했을 때만 불린다. */
  openDetail: (noticeId: string) => void,
): void {
  useEffect(() => {
    const opened = (data: PushData): void => {
      const notice = parseNotice(data)
      if (notice !== null) openDetail(notice.id)
    }

    // 앞에 있을 때는 화면을 밀지 않는다. 보던 화면을 밀어내면 사용자가 하던 일을 잃는다.
    //
    // 대신 today 배너가 서버를 다시 묻는다. 이 경로는 OS 가 알림을 안 그려서, 아무것도 안 하면
    // 화면에 아무 일도 안 일어난다.
    const offMessage = addPushMessageListener((data) => {
      if (parseNotice(data) === null) return
      void useNoticeBannerStore
        .getState()
        .refresh()
        .catch(() => undefined)
    })
    const offOpened = addPushOpenedListener(opened)

    // 죽어 있던 앱을 연 경우. **마운트당 한 번**이 계약이다. 한 번만 답하는 API라
    // 두 곳에서 읽으면 뒤가 빈손이 된다.
    void getInitialPushNotification()
      .then((data) => {
        if (data !== null) opened(data)
      })
      .catch(() => undefined)

    return () => {
      offMessage()
      offOpened()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
