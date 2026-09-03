/**
 * 로컬 알림에서 **실기기 없이 검증되는 규칙**. 채널 정의·ID 변환·예약 시각 판정.
 *
 * `capacitor-storage-keys.ts`·`capacitor-sqlite-open.ts` 와 같은 자리다.
 * 여기 있는 셋은 전부 틀려도 컴파일되고 예외도 안 나는 종류라 이걸 막는 것은 테스트뿐이다.
 * ID 가 어긋나면 **끈 알림이 계속 뜨고**, 채널 소리를 빠뜨리면 **알림이 조용히 무음이 된다**.
 */

import {
  AndroidImportance,
  TriggerType,
  type AndroidChannel,
  type Notification,
  type TimestampTrigger,
} from '@notifee/react-native'

import type { LocalNotificationRequest } from '../ports'

/**
 * Capacitor 시절 채널 ID 를 그대로 쓴다.
 *
 * 새 ID 를 만들면 사용자 알림 설정에 채널이 하나 더 생기고, 옛 채널에 걸려 있는 예약은 그대로
 * 남는다. 같은 ID 를 쓰면 업데이트로 올라온 기기는 이미 있는 채널을 그대로 재사용한다. Android
 * 는 만들어진 채널의 중요도·소리를 이후 `createNotificationChannel` 로 바꾸지 않는다.
 */
export const NOTIFICATION_CHANNEL_ID = 'default'

/**
 * 새로 설치한 기기에서 만들어질 채널. 이름·설명은 `"Default"`, 중요도는 `IMPORTANCE_DEFAULT` 다.
 *
 * `sound: 'default'` 가 빠지면 무음 채널이 된다. Android 의 `NotificationChannel` 은 생성자
 * 기본값이 시스템 기본 알림음이지만 notifee 는 기본값이 소리 없음이고 시스템 기본음이
 * `'default'` 다. 같은 아무것도 안 함 이 두 라이브러리에서 반대 결과를 낸다.
 *
 * 나머지(lights·vibration·visibility)는 notifee 기본값을 그대로 둔다. Android 의
 * `NotificationChannel` 기본값과 정확히 대응시킬 수 없고, 업데이트로 올라온 기기에서는 어차피
 * 옛 채널이 이겨서 차이가 나타나지 않는다.
 */
export const NOTIFICATION_CHANNEL: AndroidChannel = {
  id: NOTIFICATION_CHANNEL_ID,
  name: 'Default',
  description: 'Default',
  importance: AndroidImportance.DEFAULT,
  sound: 'default',
}

/**
 * 포트의 숫자 ID → notifee 의 문자열 ID.
 *
 * **ID 는 앱 전체에 걸친 계약이다**. `cancel(id)` 가 `schedule` 한 그 알림을 지목해야 하므로
 * 해시·접두사처럼 되돌릴 수 없는 변환을 쓰면 안 된다. `String` ↔ `Number` 는 왕복 무손실이라
 * 그 조건을 만족하는 가장 단순한 변환이고, 예약과 취소가 **같은 이 함수 하나**를 쓰기 때문에
 * 두 자리가 어긋날 수 없다.
 *
 * 정수가 아니면 던진다. `String(NaN)` 은 `'NaN'` 이라 변환 자체는 되지만 되돌아오지 않아
 * **취소할 수 없는 알림**이 만들어지는데, 그건 화면 어디에도 안 나타난다.
 */
export function toNotificationId(id: number): string {
  if (!Number.isSafeInteger(id)) {
    throw new Error(`알림 ID 는 정수여야 합니다: ${id}. 정수가 아니면 취소로 되찾을 수 없습니다.`)
  }
  return String(id)
}

export interface TriggerNotificationRequest {
  notification: Notification
  trigger: TimestampTrigger
}

/**
 * `LocalNotificationRequest` → notifee `createTriggerNotification` 의 두 인자.
 *
 * 지난 시각은 예약하지 않고 던진다. 즉시 발화를 고르지 않는 것은 앱 실행 시 재예약을 전제하기
 * 때문이다. 시계가 조금만 어긋나도 재예약 한 번이 알림 무더기가 된다. 호출부의 계산 실수는
 * 사용자에게 알림으로 새어 나가는 대신 여기서 멈춘다.
 *
 * `now` 를 인자로 받는 것은 판정을 실기기 없이 검사하기 위해서다.
 */
export function toTriggerNotification(
  request: LocalNotificationRequest,
  now: number,
): TriggerNotificationRequest {
  const timestamp = request.scheduleAt.getTime()
  if (!Number.isFinite(timestamp)) {
    // Invalid Date. 이걸 거르지 않으면 `NaN <= now` 가 false 라 아래 검사를 그냥 통과하고,
    // notifee 의 `isNumber(NaN)` 도 true 라 timestamp NaN 이 그대로 네이티브까지 간다.
    throw new Error(`알림 예약 시각이 올바르지 않습니다 (id ${request.id}).`)
  }
  if (timestamp <= now) {
    throw new Error(
      `알림 예약 시각이 이미 지났습니다: ${request.scheduleAt.toISOString()} (id ${request.id}).`,
    )
  }
  return {
    notification: {
      id: toNotificationId(request.id),
      title: request.title,
      body: request.body,
      android: { channelId: NOTIFICATION_CHANNEL_ID },
    },
    trigger: { type: TriggerType.TIMESTAMP, timestamp },
  }
}
