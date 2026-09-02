/**
 * `NotificationsPort` 의 RN 구현(— 밖으로 나가는 시그니처는 Capacitor 구현과
 * 한 글자도 다르지 않다). 정책은(서버 푸시 없이 로컬 알림만).
 *
 * **notifee 를 고른 근거는 "실제로 붙는다"이다.** 이 저장소의 Expo SDK 57(RN 0.86)에서
 * `expo prebuild` → `assembleDebug` 로 확인했다 — 오토링킹(`:notifee_react-native`)·
 * `PackageList.java` 등록·dex 안 `app.notifee.core.*` 클래스까지 들어간다. 라이브러리가 2024-12
 * 릴리스라 새 아키텍처(TurboModule) 대응이 없는데도 되는 것은 RN 의 interop 레이어 덕이므로,
 * 이 사실은 **런타임이 아니라 빌드까지만** 확인된 것이다(아래 «검증되지 않은 것»).
 *
 * 그 밖에 이 포트가 필요로 하는 것을 전부 준다 — 호출부가 정한 ID 로 예약·취소하고
 * (`createTriggerNotification`/`cancelNotification`), 예약된 것만 세고
 * (`getTriggerNotificationIds`), Android 13+ 의 `POST_NOTIFICATIONS` 런타임 권한을 자기가
 * 처리한다(`NotifeeApiModule.java:250-286`, 권한 선언은 notifee core 의 매니페스트가 병합한다).
 *
 * ---
 *
 * ⚠️ **Capacitor 시절 예약은 이 코드가 취소할 수 없다**(`docs/migration/data.md` 결정 4).
 *
 * 그 예약들은 앱이 아니라 **OS 가 들고 있다** — Android 는 알림 ID 를 request code 로 삼은
 * `PendingIntent` + `AlarmManager`(`LocalNotificationManager.java:411-419`), iOS 는
 * `UNUserNotificationCenter` 다. 프레임워크를 바꿔도 그대로 남아 발화하는데, notifee 는 자기가
 * 만든 것만 알므로 아래 `cancel`·`getPendingCount` 는 **옛 예약을 보지도 지우지도 못한다.**
 * 그래서 전환 후 첫 실행에 옛 예약이 남아 있으면 중복 알림·유령 알림이 난다.
 *
 * 그 1회성 정리는 **여기가 아니라** 앱 부팅 흐름에 들어가고(플랫폼 API 로 통째로 비운 뒤 현재
 * 설정대로 재예약), 실기기와 함께 2단계에서 설계한다. 여기서 넣으면 검증할 수 없는 코드만 는다.
 *
 * ---
 *
 * **검증되지 않은 것** — 실기기에서 알림이 실제로 뜨는 것, 옛 채널(`'default'`)을 물려받은 기기의
 * 중요도·소리, notifee 의 기본 트리거가 WorkManager 라는 점(Capacitor 는 `AlarmManager` 를 쓰고
 * 가능하면 `setExact` 였다 — `LocalNotificationManager.java:374-395`). 뒤엣것은 발화 시각이 더
 * 느슨해질 수 있다는 뜻이고, 정확 알람으로 바꾸는 것은 Android 12+ 의 `SCHEDULE_EXACT_ALARM`
 * 권한 흐름을 동반하는 별개 결정이다(는 이미 지연·누락을 감수한다고 적어 두었다).
 */

import notifee, { AuthorizationStatus, type NotificationSettings } from '@notifee/react-native'

import type { NotificationsPort } from '../ports'

import {
  NOTIFICATION_CHANNEL,
  toNotificationId,
  toTriggerNotification,
} from './notification-request'

/**
 * Capacitor 의 판정과 맞춘다 — iOS `checkPermissions` 가 `.authorized`·`.ephemeral`·`.provisional`
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
    // 변환이 먼저다 — 잘못된 요청(지난 시각·정수 아닌 ID)은 네이티브를 건드리기 전에 멈춘다.
    const { notification, trigger } = toTriggerNotification(request, Date.now())
    // 채널이 없으면 Android 는 알림을 아예 안 띄운다. `createNotificationChannel` 은 멱등이라
    // (이미 있으면 설정을 안 바꾼다) 예약마다 불러도 되고, 그래서 "만들었던가"를 기억하는
    // 모듈 상태를 두지 않는다 — 그 상태가 어긋나면 알림이 조용히 사라진다.
    await notifee.createChannel(NOTIFICATION_CHANNEL)
    await notifee.createTriggerNotification(notification, trigger)
  },
  // `cancelTriggerNotification` 이 아니라 `cancelNotification` 이다 — Capacitor 의 `cancel` 은
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
