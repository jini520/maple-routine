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
 */

import { getMessaging, subscribeToTopic, unsubscribeFromTopic } from '@react-native-firebase/messaging'

import type { PushPort } from '../ports'

export const rnPushPort: PushPort = {
  async subscribe(topic) {
    await subscribeToTopic(getMessaging(), topic)
  },
  async unsubscribe(topic) {
    await unsubscribeFromTopic(getMessaging(), topic)
  },
}
