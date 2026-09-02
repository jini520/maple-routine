// 순수 규칙 — 채널 정의·ID 변환·예약 시각 판정. 셋 다 틀려도 타입 에러가 안 나고 예외도 안 나는
// 종류라(무음 채널 / 취소 안 되는 알림 / 지난 시각 예약) 막는 것은 이 파일뿐이다.
//
// notifee 를 목으로 바꾸는 것은 이 모듈이 열거형 **값**(`AndroidImportance`·`TriggerType`)을 쓰기
// 때문이다. 패키지 진입점은 import 시점에 네이티브 모듈을 잡아 jest 에서는 그냥 던진다
// (`NotifeeNativeModule.js:32-38`). 열거형이 든 하위 모듈은 그 부작용이 없으므로 **진짜 정의를
// 그대로 끌어온다**. 값을 손으로 베끼면 상상한 값을 검사하게 된다.
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  ...jest.requireActual('@notifee/react-native/dist/types/NotificationAndroid'),
  ...jest.requireActual('@notifee/react-native/dist/types/Trigger'),
}))

import { AndroidImportance, TriggerType } from '@notifee/react-native'

import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CHANNEL_ID,
  toNotificationId,
  toTriggerNotification,
} from '../notification-request'

const NOW = Date.parse('2026-08-11T10:00:00.000Z')

function request(overrides: Partial<Parameters<typeof toTriggerNotification>[0]> = {}) {
  return {
    id: 42,
    title: '주간 보스 리셋',
    body: '아직 안 잡은 보스가 있어요',
    scheduleAt: new Date(NOW + 60_000),
    ...overrides,
  }
}

describe('채널', () => {
  // 값이 바뀌면 새 채널이 생기고 옛 채널에 걸린 Capacitor 시절 예약과 갈라진다.
  it('Capacitor 의 기본 채널 ID 를 그대로 쓴다', () => {
    expect(NOTIFICATION_CHANNEL_ID).toBe('default')
    expect(NOTIFICATION_CHANNEL.id).toBe('default')
  })

  it('중요도가 Capacitor 와 같은 DEFAULT 다', () => {
    expect(NOTIFICATION_CHANNEL.importance).toBe(AndroidImportance.DEFAULT)
  })

  // notifee 의 기본값은 "소리 없음"이라 이 값을 빼면 채널이 통째로 무음이 된다 —
  // Capacitor 는 아무것도 안 해서 시스템 기본음이 났으므로 정반대다.
  it('시스템 기본 알림음을 쓴다', () => {
    expect(NOTIFICATION_CHANNEL.sound).toBe('default')
  })
})

describe('toNotificationId', () => {
  it('숫자 ID 를 문자열로 바꾼다', () => {
    expect(toNotificationId(42)).toBe('42')
  })

  // `cancel(id)` 이 `schedule` 한 알림을 지목하려면 이 왕복이 성립해야 한다.
  it.each([0, 1, 42, -7, Number.MAX_SAFE_INTEGER])('%p 는 왕복 손실이 없다', (id) => {
    expect(Number(toNotificationId(id))).toBe(id)
  })

  // `String(NaN)` 은 `'NaN'` 이라 변환은 되지만 되돌아오지 않는다. 취소할 수 없는 알림이 된다.
  it.each([Number.NaN, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2])(
    '%p 는 정수가 아니라 던진다',
    (id) => {
      expect(() => toNotificationId(id)).toThrow('정수')
    },
  )
})

describe('toTriggerNotification', () => {
  it('알림 본문과 채널을 담는다', () => {
    const { notification } = toTriggerNotification(request(), NOW)
    expect(notification).toEqual({
      id: '42',
      title: '주간 보스 리셋',
      body: '아직 안 잡은 보스가 있어요',
      android: { channelId: 'default' },
    })
  })

  it('예약 시각을 타임스탬프 트리거로 바꾼다', () => {
    const { trigger } = toTriggerNotification(request(), NOW)
    expect(trigger).toEqual({ type: TriggerType.TIMESTAMP, timestamp: NOW + 60_000 })
  })

  // Capacitor 는 iOS 가 거절하고 Android 가 즉시 발화해 플랫폼끼리 달랐다. 여기서는 둘 다 던진다 —
  //  가 앱 실행마다 재예약을 전제하므로 즉시 발화를 고르면 시계가 조금 어긋난 재예약
  // 한 번이 알림 무더기가 된다.
  it('지난 시각은 던진다', () => {
    expect(() => toTriggerNotification(request({ scheduleAt: new Date(NOW - 1) }), NOW)).toThrow(
      '이미 지났습니다',
    )
  })

  it('지금과 같은 시각도 던진다', () => {
    expect(() => toTriggerNotification(request({ scheduleAt: new Date(NOW) }), NOW)).toThrow(
      '이미 지났습니다',
    )
  })

  // `NaN <= now` 는 false 라 지난 시각 검사를 그냥 통과한다. 따로 걸러야 네이티브까지 안 간다.
  it('Invalid Date 는 던진다', () => {
    expect(() =>
      toTriggerNotification(request({ scheduleAt: new Date('언제인지 모름') }), NOW),
    ).toThrow('올바르지 않습니다')
  })
})
