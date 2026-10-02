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
 * @see docs/features/notifications.md 로컬 알림과 원격 푸시가 갈라지는 자리
 */

import notifee, { AuthorizationStatus, EventType, type Event, type NotificationSettings } from '@notifee/react-native'

import type { NotificationData, NotificationsPort } from '../ports'

import { channelFor, toNotificationId, toTriggerNotification } from './notification-request'

/**
 * 권한 판정. iOS 는 `.authorized`·`.provisional` 을 허용으로 접는다. notifee 에 `ephemeral` 은
 * 없다. Android 는 `AUTHORIZED`/`DENIED` 둘뿐이라 이 함수가 그대로 맞다.
 */
function isGranted(settings: NotificationSettings): boolean {
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  )
}

/** 알림의 `data` 를 문자열 지도로 좁힌다. notifee 타입은 숫자 · 객체도 허용하지만 우리는 문자열만 싣는다 */
function toData(data: Record<string, unknown> | undefined): NotificationData {
  const result: NotificationData = {}
  for (const [key, value] of Object.entries(data ?? {})) {
    if (typeof value === 'string') result[key] = value
  }
  return result
}

const pressListeners = new Set<(data: NotificationData) => void>()
/** 리스너가 달리기 전에 온 배경 탭. 화면이 리스너를 달 때 넘긴다 */
let pendingPresses: NotificationData[] = []

function deliverPress(data: NotificationData): void {
  if (pressListeners.size === 0) pendingPresses.push(data)
  else pressListeners.forEach((listener) => listener(data))
}

/**
 * `index.ts` 최상위에서 `notifee.onBackgroundEvent` 로 등록하는 처리. 배경에서 온 탭을 같은 리스너로 보낸다.
 *
 * 최상위여야 OS 가 배경에서 앱을 깨울 때 이 처리를 찾는다.
 */
export async function handleBackgroundNotificationEvent({ type, detail }: Event): Promise<void> {
  if (type === EventType.PRESS) deliverPress(toData(detail.notification?.data))
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
    await notifee.createChannel(channelFor(request))
    await notifee.createTriggerNotification(notification, trigger)
  },
  // `cancelTriggerNotification` 이 아니라 `cancelNotification` 이다. 예약 취소와 이미 떠 있는
  // 알림 내리기를 함께 하는 것이 이쪽이다.
  async cancel(id) {
    await notifee.cancelNotification(toNotificationId(id))
  },
  // 세는 것은 **아직 발화하지 않은** 예약뿐이다(Capacitor `getPending()` 과 같은 범위).
  async getPendingCount() {
    const ids = await notifee.getTriggerNotificationIds()
    return ids.length
  },
  addPressListener(handler) {
    pressListeners.add(handler)
    const pending = pendingPresses
    pendingPresses = []
    pending.forEach((data) => handler(data))
    const offForeground = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) handler(toData(detail.notification?.data))
    })
    return () => {
      pressListeners.delete(handler)
      offForeground()
    }
  },
  // iOS 는 같은 탭을 `onForegroundEvent` 로도 보낸다. 거르는 것은 받는 쪽이다.
  async getInitialPress() {
    const initial = await notifee.getInitialNotification()
    return initial === null ? null : toData(initial.notification.data)
  },
}
