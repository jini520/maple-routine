/**
 * `PushPort` 의 RN 구현. 토픽 구독·해제를 Firebase Cloud Messaging 으로 잇는 어댑터.
 *
 * 여기 있는 것이 둘뿐인 이유는 앱이 아는 것이 그 둘뿐이기 때문이다. 무엇을 언제 보낼지는
 * 서버가 정하고, 앱은 어느 토픽을 듣고 있는지만 안다.
 *
 * 등록 토큰을 다루지 않는다. 토큰을 서버에 올리면 사용자 식별자 저장소가 생기고 만료 정리와
 * 개인정보 분류가 통째로 따라온다. 토픽은 기기가 FCM 에 직접 거는 것이라 그 값이 우리를
 * 거치지 않는다.
 *
 * 알림 권한은 이 포트가 아니라 `NotificationsPort.requestPermission` 이 든다. OS 가 보는
 * 권한이 로컬 알림과 같은 하나라, 두 자리에서 물으면 사용자에게 같은 팝업이 두 번 뜬다.
 *
 * `getMessaging()` 을 모듈 최상위가 아니라 함수 안에서 부른다. 최상위에서 부르면 import 시점에
 * 네이티브 모듈을 잡아, 포트 주입보다 먼저 평가되는 자리에서 던진다.
 *
 * ## iOS 는 **APNs 토픽 구독 전에 APNs 토큰을 기다려야 한다**
 *
 * `subscribeToTopic` 은 FCM 토큰을 쓰고, FCM 토큰은 APNs 토큰이 있어야 발급된다. 그런데 APNs
 * 등록은 앱이 뜰 때 시작해 **비동기로 끝난다**. 그 사이에 사용자가 스위치를 누르면 구독이
 * `No APNS token specified before fetching FCM Token` 으로 던진다(실기기 관측 2026-09-10).
 *
 * 기다리는 것이 완화책이 아니라 **그 연산의 전제 조건을 갖추는 일**이다. 토큰 없이 부르면
 * 언제나 실패하므로, 없으면 올 때까지 잠깐 기다렸다 부른다.
 */

import { Platform } from 'react-native'
import {
  getAPNSToken,
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  subscribeToTopic,
  unsubscribeFromTopic,
} from '@react-native-firebase/messaging'

import type { PushData, PushPort } from '../ports'

/** APNs 토큰을 기다리는 총 시간. 이 안에 안 오면 기다려도 안 온다. */
const APNS_WAIT_MS = 5_000
/** 다시 물어보는 간격. */
const APNS_POLL_MS = 250

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 토픽을 걸기 전에 APNs 토큰이 왔는지 본다. 안 왔으면 잠깐 기다린다.
 *
 * **안드로이드는 그냥 지나간다.** APNs 는 애플 것이고 저쪽은 FCM 토큰이 바로 선다.
 *
 * **등록을 우리가 걸지 않는다.** 자동 등록이 기본이라(`firebase.json` 의
 * `messaging_ios_auto_register_for_remote_messages`, 이 저장소에는 그 파일이 없다) 앱이 뜰 때
 * 이미 걸려 있고, `registerDeviceForRemoteMessages()` 를 또 부르면 라이브러리가 `필요 없는
 * 호출` 경고를 찍는다(실기기 관측). 기다리기만 해도 토큰은 온다.
 */
async function waitForApnsToken(): Promise<void> {
  if (Platform.OS !== 'ios') return

  const messaging = getMessaging()
  const until = Date.now() + APNS_WAIT_MS
  for (;;) {
    if ((await getAPNSToken(messaging)) !== null) return
    if (Date.now() >= until) {
      // 여기서 던지는 편이 낫다. 그냥 구독하면 FCM 이 영문 오류를 내고, 사용자는 그것을 읽는다.
      //
      // 여기 닿는 길이 둘이다. 등록이 아직 안 끝났거나(다시 누르면 된다), 자동 등록이 꺼져
      // 있어 영영 안 오거나(설정을 고쳐야 한다). 문구는 둘 다 덮는다.
      throw new Error('기기가 알림 서버에 아직 등록되지 않았어요. 잠시 뒤 다시 시도해 주세요')
    }
    await sleep(APNS_POLL_MS)
  }
}

export const rnPushPort: PushPort = {
  async subscribe(topic) {
    await waitForApnsToken()
    await subscribeToTopic(getMessaging(), topic)
  },
  async unsubscribe(topic) {
    // 해제도 FCM 토큰을 쓴다. 끄는 길이 토큰 때문에 막히면 구독을 못 지운다.
    await waitForApnsToken()
    await unsubscribeFromTopic(getMessaging(), topic)
  },
  addMessageListener(handler) {
    return onMessage(getMessaging(), (message) => handler(toData(message.data)))
  },
  addOpenedListener(handler) {
    return onNotificationOpenedApp(getMessaging(), (message) => handler(toData(message.data)))
  },
  async getInitialNotification() {
    const message = await getInitialNotification(getMessaging())
    return message === null ? null : toData(message.data)
  },
}

/**
 * `data` 를 문자열 지도로 좁힌다.
 *
 * 타입은 `{ [key: string]: string | number | object }` 인데 FCM 이 실제로 싣는 것은 문자열뿐이다.
 * 그래도 좁히는 이유는 서버가 실수로 다른 것을 실었을 때 화면까지 흘러가지 않게 하려는 것이다.
 */
function toData(data: Record<string, unknown> | undefined): PushData {
  const out: PushData = {}
  for (const [key, value] of Object.entries(data ?? {})) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}
