/**
 * `NotificationsPort` 의 RN 구현. 로컬 알림 예약·취소를 notifee 로 잇는 어댑터.
 *
 * 호출부가 정한 ID 로 예약·취소하고(`createTriggerNotification` · `cancelNotification`), 예약된
 * 것만 세며(`getTriggerNotificationIds`), Android 13+ 의 `POST_NOTIFICATIONS` 런타임 권한을 자기가
 * 처리한다.
 *
 * ⚠️ **이 코드가 취소할 수 없는 예약이 있다.** 프레임워크를 바꾸기 전에 잡힌 예약은 앱이 아니라
 * OS 가 들고 있어서(Android `AlarmManager`, iOS `UNUserNotificationCenter`) notifee 가 보지도
 * 지우지도 못한다. 남아 있으면 중복·유령 알림이 난다. 그 1회성 정리는 여기가 아니라 부팅 흐름의
 * 일이다.
 *
 * @see docs/features/notifications.md 서버 푸시 없이 로컬 알림만 쓰는 정책
 */

import notifee, { AuthorizationStatus, type NotificationSettings } from '@notifee/react-native'

import type { NotificationsPort } from '../ports'

import {
  NOTIFICATION_CHANNEL,
  toNotificationId,
  toTriggerNotification,
} from './notification-request'

/**
 * Capacitor 의 판정과 맞춘다. iOS `checkPermissions` 가 `.authorized`·`.ephemeral`·`.provisional`
 * 셋을 모두 `"granted"` 로 접었다(`LocalNotificationsPlugin.swift:138-139`). notifee 에 `ephemeral`
 * 은 없다. Android 는 `AUTHORIZED`/`DENIED` 둘뿐이라 이 함수가 그대로 맞다.
 */
function isGranted(settings: NotificationSettings): boolean {
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  )
}

export const rnNotificationsPort: NotificationsPort = {
  async requestPermission() {
    return isGranted(await notifee.requestPermission())
  },
  async hasPermission() {
    return isGranted(await notifee.getNotificationSettings())
  },
  async schedule(request) {
    // 변환이 먼저다. 잘못된 요청(지난 시각·정수 아닌 ID)은 네이티브를 건드리기 전에 멈춘다.
    const { notification, trigger } = toTriggerNotification(request, Date.now())
    // 채널이 없으면 Android 는 알림을 아예 안 띄운다. `createNotificationChannel` 은 멱등이라
    // (이미 있으면 설정을 안 바꾼다) 예약마다 불러도 되고, 그래서 "만들었던가"를 기억하는
    // 모듈 상태를 두지 않는다. 그 상태가 어긋나면 알림이 조용히 사라진다.
    await notifee.createChannel(NOTIFICATION_CHANNEL)
    await notifee.createTriggerNotification(notification, trigger)
  },
  // `cancelTriggerNotification` 이 아니라 `cancelNotification` 이다. Capacitor 의 `cancel` 은
  // 예약 취소와 **이미 떠 있는 알림 내리기**를 함께 했고(`LocalNotificationManager.java:399-409`)
  // notifee 에서 그 둘을 함께 하는 것이 이쪽이다.
  async cancel(id) {
    await notifee.cancelNotification(toNotificationId(id))
  },
  // 세는 것은 **아직 발화하지 않은** 예약뿐이다(Capacitor `getPending()` 과 같은 범위).
  async getPendingCount() {
    const ids = await notifee.getTriggerNotificationIds()
    return ids.length
  },
}
