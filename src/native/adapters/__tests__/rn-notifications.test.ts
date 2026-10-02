// 순수 규칙(`notification-request.test.ts`)이 지키는 것은 "무엇을 넘기는가" 이고, 이 파일이 지키는
// 것은 **어댑터가 포트 계약을 지키는가** 다. 특히 `cancel` 이 `schedule` 한 그 알림을 지목하는지.
// 두 자리가 어긋나면 사용자가 끈 알림이 계속 뜨는데, 그건 코드를 읽어서는 안 보인다.
//
// 목이 흉내 내는 것은 알림 시스템이 아니라 **우리가 부르는 notifee 함수 목록**뿐이다. 열거형은
// 부작용 없는 하위 모듈에서 진짜 정의를 끌어오고(값을 베끼면 상상한 값을 검사하게 된다), 패키지
// 진입점은 import 시점에 네이티브 모듈을 잡아 jest 에서 던지므로 통째로 대체한다.
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  ...jest.requireActual('@notifee/react-native/dist/types/Notification'),
  ...jest.requireActual('@notifee/react-native/dist/types/NotificationAndroid'),
  ...jest.requireActual('@notifee/react-native/dist/types/Trigger'),
  default: {
    requestPermission: jest.fn(),
    getNotificationSettings: jest.fn(),
    createChannel: jest.fn(),
    createTriggerNotification: jest.fn(),
    cancelNotification: jest.fn(),
    cancelTriggerNotification: jest.fn(),
    getTriggerNotificationIds: jest.fn(),
    onForegroundEvent: jest.fn(),
    getInitialNotification: jest.fn(),
  },
}))

import notifee, {
  AuthorizationStatus,
  EventType,
  TriggerType,
  type Event,
  type NotificationSettings,
} from '@notifee/react-native'

import { handleBackgroundNotificationEvent, rnNotificationsPort } from '../rn-notifications'

const mocked = jest.mocked(notifee)

function settings(authorizationStatus: AuthorizationStatus): NotificationSettings {
  return { authorizationStatus } as NotificationSettings
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('권한', () => {
  it.each([
    [AuthorizationStatus.AUTHORIZED, true],
    // iOS 의 조용한 전달. granted 로 접는다.
    [AuthorizationStatus.PROVISIONAL, true],
    [AuthorizationStatus.DENIED, false],
    [AuthorizationStatus.NOT_DETERMINED, false],
  ])('요청 결과 %p → %p', async (status, expected) => {
    mocked.requestPermission.mockResolvedValue(settings(status))
    await expect(rnNotificationsPort.requestPermission()).resolves.toBe(expected)
  })

  // Android 13+ 의 POST_NOTIFICATIONS 런타임 권한은 notifee 가 이 호출 안에서 처리한다.
  it('요청은 notifee.requestPermission 을 쓴다', async () => {
    mocked.requestPermission.mockResolvedValue(settings(AuthorizationStatus.AUTHORIZED))
    await rnNotificationsPort.requestPermission()
    expect(mocked.requestPermission).toHaveBeenCalledTimes(1)
  })

  // 조회는 권한 창을 띄우면 안 된다.
  it('조회는 설정만 읽는다', async () => {
    mocked.getNotificationSettings.mockResolvedValue(settings(AuthorizationStatus.DENIED))
    await expect(rnNotificationsPort.hasPermission()).resolves.toBe(false)
    expect(mocked.requestPermission).not.toHaveBeenCalled()
  })
})

describe('schedule', () => {
  const scheduleAt = new Date(Date.now() + 60_000)

  it('채널을 만든 뒤 예약한다', async () => {
    await rnNotificationsPort.schedule({ id: 7, title: '제목', body: '본문', scheduleAt })

    expect(mocked.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'default', sound: 'default' }),
    )
    expect(mocked.createTriggerNotification).toHaveBeenCalledWith(
      { id: '7', title: '제목', body: '본문', android: { channelId: 'default' } },
      { type: TriggerType.TIMESTAMP, timestamp: scheduleAt.getTime() },
    )
    // 채널이 없으면 Android 는 알림을 아예 안 띄운다. 순서가 뒤집히면 첫 예약을 잃는다.
    expect(mocked.createChannel.mock.invocationCallOrder[0]).toBeLessThan(
      mocked.createTriggerNotification.mock.invocationCallOrder[0],
    )
  })

  // 잘못된 요청이 네이티브까지 가면 그 뒤는 라이브러리 사정이 된다.
  it('지난 시각은 네이티브를 건드리기 전에 던진다', async () => {
    await expect(
      rnNotificationsPort.schedule({
        id: 7,
        title: '제목',
        body: '본문',
        scheduleAt: new Date(Date.now() - 60_000),
      }),
    ).rejects.toThrow('이미 지났습니다')
    expect(mocked.createTriggerNotification).not.toHaveBeenCalled()
    expect(mocked.createChannel).not.toHaveBeenCalled()
  })
})

describe('cancel', () => {
  // 이 포트에서 가장 조용하게 깨지는 자리다. 어긋나도 예외가 없고, 사용자가 끈 알림만 계속 뜬다.
  it('예약할 때 쓴 ID 를 그대로 지목한다', async () => {
    await rnNotificationsPort.schedule({
      id: 1234,
      title: '제목',
      body: '본문',
      scheduleAt: new Date(Date.now() + 60_000),
    })
    const [scheduled] = mocked.createTriggerNotification.mock.calls[0]

    await rnNotificationsPort.cancel(1234)

    expect(mocked.cancelNotification).toHaveBeenCalledWith(scheduled.id)
  })

  // 예약 취소만으로는 이미 뜬 알림이 남는다.
  it('떠 있는 알림까지 내리는 쪽을 쓴다', async () => {
    await rnNotificationsPort.cancel(1234)
    expect(mocked.cancelNotification).toHaveBeenCalledWith('1234')
    expect(mocked.cancelTriggerNotification).not.toHaveBeenCalled()
  })
})

describe('getPendingCount', () => {
  it('아직 발화하지 않은 예약을 센다', async () => {
    mocked.getTriggerNotificationIds.mockResolvedValue(['1', '2', '3'])
    await expect(rnNotificationsPort.getPendingCount()).resolves.toBe(3)
  })

  it('예약이 없으면 0 이다', async () => {
    mocked.getTriggerNotificationIds.mockResolvedValue([])
    await expect(rnNotificationsPort.getPendingCount()).resolves.toBe(0)
  })
})

describe('data', () => {
  // 탭했을 때 어느 약속인지 다시 찾는 열쇠다. 빠지면 탭이 아무 데도 못 간다.
  it('요청의 data 를 알림에 싣는다', async () => {
    await rnNotificationsPort.schedule({
      id: 7,
      title: '제목',
      body: '본문',
      scheduleAt: new Date(Date.now() + 60_000),
      data: { kind: 'party-appointment', appointmentId: 'a1', dateKey: '2026-10-08' },
    })

    expect(mocked.createTriggerNotification.mock.calls[0]![0].data).toEqual({
      kind: 'party-appointment',
      appointmentId: 'a1',
      dateKey: '2026-10-08',
    })
  })
})

// 탭이 앱에 닿는 길 셋(앞 · 배경 · 죽어 있다 열림)을 한 리스너로 모은다.
describe('알림 탭', () => {
  function press(data: Record<string, string>): Event {
    return { type: EventType.PRESS, detail: { notification: { id: '1', data } } }
  }

  it('앞에서 누른 탭을 리스너로 보내고, 누름이 아닌 것은 버린다', () => {
    const handler = jest.fn()
    let foreground: ((event: Event) => void) | undefined
    mocked.onForegroundEvent.mockImplementation((observer) => {
      foreground = observer
      return () => undefined
    })

    const off = rnNotificationsPort.addPressListener(handler)
    foreground!(press({ kind: 'k' }))
    foreground!({ type: EventType.DELIVERED, detail: { notification: { id: '1', data: { kind: 'x' } } } })
    off()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ kind: 'k' })
  })

  // 배경 탭은 화면이 리스너를 달기 전에 올 수 있다. 붙들었다가 넘긴다.
  it('리스너가 없을 때 온 배경 탭은 붙들었다가 리스너를 달 때 넘긴다', async () => {
    mocked.onForegroundEvent.mockReturnValue(() => undefined)
    await handleBackgroundNotificationEvent(press({ kind: 'later' }))
    const handler = jest.fn()

    const off = rnNotificationsPort.addPressListener(handler)

    expect(handler).toHaveBeenCalledWith({ kind: 'later' })
    off()
  })

  it('리스너가 있으면 배경 탭을 바로 넘긴다', async () => {
    mocked.onForegroundEvent.mockReturnValue(() => undefined)
    const handler = jest.fn()
    const off = rnNotificationsPort.addPressListener(handler)

    await handleBackgroundNotificationEvent(press({ kind: 'now' }))

    expect(handler).toHaveBeenCalledWith({ kind: 'now' })
    off()
  })

  it('죽어 있다 탭으로 열렸으면 그 data 를 준다', async () => {
    mocked.getInitialNotification.mockResolvedValue({
      notification: { id: '1', data: { kind: 'cold' } },
      pressAction: { id: 'default' },
    })

    await expect(rnNotificationsPort.getInitialPress()).resolves.toEqual({ kind: 'cold' })
  })

  it('탭으로 열리지 않았으면 null 이다', async () => {
    mocked.getInitialNotification.mockResolvedValue(null)

    await expect(rnNotificationsPort.getInitialPress()).resolves.toBeNull()
  })
})
