jest.mock('../../../native/notifications', () => ({
  __esModule: true,
  hasNotificationPermission: jest.fn(),
  requestNotificationPermission: jest.fn(),
}))

jest.mock('../../../native/push', () => ({
  __esModule: true,
  subscribeToPushTopic: jest.fn(),
  unsubscribeFromPushTopic: jest.fn(),
}))

import {
  hasNotificationPermission,
  requestNotificationPermission,
} from '../../../native/notifications'
import { subscribeToPushTopic, unsubscribeFromPushTopic } from '../../../native/push'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import {
  getNoticeSubscribed,
  getNoticeSubscriptions,
  setNotificationPermissionAsked,
} from '../../../storage/notice-settings'
import { NO_SUBSCRIPTIONS } from '../../../types/notice'
import { useNoticeStore } from '../store'

const subscribe = jest.mocked(subscribeToPushTopic)
const unsubscribe = jest.mocked(unsubscribeFromPushTopic)
const hasPermission = jest.mocked(hasNotificationPermission)
const requestPermission = jest.mocked(requestNotificationPermission)

let prefs: ReturnType<typeof installFakePreferences>

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('noticeSubscribed')
  await prefs.remove('noticeSubscriptions')
  await prefs.remove('notificationPermissionAsked')
  jest.clearAllMocks()
  subscribe.mockResolvedValue(undefined)
  unsubscribe.mockResolvedValue(undefined)
  hasPermission.mockResolvedValue(true)
  requestPermission.mockResolvedValue(true)
  useNoticeStore.setState({
    subscriptions: NO_SUBSCRIPTIONS,
    pending: {},
    blockedByPermission: false,
  })
})

describe('구독 토글', () => {
  it('켜면 그 토픽을 구독하고 저장한다', async () => {
    await useNoticeStore.getState().setSubscribed('game', true)

    expect(subscribe).toHaveBeenCalledWith('notice-game')
    expect(useNoticeStore.getState().subscriptions.game).toBe(true)
    await expect(getNoticeSubscriptions()).resolves.toMatchObject({ game: true })
  })

  it('끄면 해제하고 저장한다', async () => {
    await useNoticeStore.getState().setSubscribed('game', true)
    jest.clearAllMocks()

    await useNoticeStore.getState().setSubscribed('game', false)

    expect(unsubscribe).toHaveBeenCalledWith('notice-game')
    expect(useNoticeStore.getState().subscriptions.game).toBe(false)
    await expect(getNoticeSubscriptions()).resolves.toMatchObject({ game: false })
  })

  // 이벤트로 나가는 것이 썬데이뿐이라 그 줄이 제 이름을 갖는다.
  it('썬데이는 자기 토픽을 쓴다', async () => {
    await useNoticeStore.getState().setSubscribed('event', true)

    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledWith('notice-event')
  })

  it('토글끼리 서로를 안 건드린다', async () => {
    await useNoticeStore.getState().setSubscribed('app', true)
    await useNoticeStore.getState().setSubscribed('cashshop', true)

    expect(useNoticeStore.getState().subscriptions).toEqual({
      app: true,
      game: false,
      update: false,
      event: false,
      cashshop: true,
    })
  })

  // FCM 구독이 실패했는데 켜졌다고 저장하면, 스위치는 켜져 있고 알림은 안 온다.
  // 그 상태는 화면만 보고는 못 가린다.
  it('토픽 구독이 실패하면 저장도 상태도 안 바뀐다', async () => {
    subscribe.mockRejectedValue(new Error('network'))

    await expect(useNoticeStore.getState().setSubscribed('game', true)).rejects.toThrow('network')

    expect(useNoticeStore.getState().subscriptions.game).toBe(false)
    await expect(getNoticeSubscriptions()).resolves.toMatchObject({ game: false })
  })
})

describe('복원', () => {
  it('저장된 값을 읽어 상태에 올린다', async () => {
    await useNoticeStore.getState().setSubscribed('cashshop', true)
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS })

    await useNoticeStore.getState().restore()

    expect(useNoticeStore.getState().subscriptions.cashshop).toBe(true)
  })

  // 토글이 하나였던 시절의 값이다. 그 사람은 `notice` 토픽을 이미 구독하고 있고, 그 토픽이
  // 지금은 앱 공지 자리다. 물려받지 않으면 스위치가 꺼져 보이는데 알림은 계속 온다.
  it('옛 값이 켜져 있으면 앱 공지로 이어받는다', async () => {
    await prefs.set('noticeSubscribed', 'on')

    await useNoticeStore.getState().restore()

    expect(useNoticeStore.getState().subscriptions).toEqual({
      app: true,
      game: false,
      update: false,
      event: false,
      cashshop: false,
    })
  })

  // OTA 를 회수하면 옛 코드가 다시 돈다. 그 코드는 새 칸을 모른다.
  it('앱 공지는 옛 칸에도 함께 적는다', async () => {
    await useNoticeStore.getState().setSubscribed('app', true)

    await expect(getNoticeSubscribed()).resolves.toBe(true)
  })

  // 복원은 저장된 사실을 읽는 것이지 새로 구독하는 것이 아니다.
  it('복원이 토픽을 다시 구독하지 않는다', async () => {
    await useNoticeStore.getState().setSubscribed('game', true)
    jest.clearAllMocks()

    await useNoticeStore.getState().restore()

    expect(subscribe).not.toHaveBeenCalled()
  })
})

describe('권한을 허용한 자리에서 켜는 기본 묶음', () => {
  // 패치 날 이벤트 5건과 캐시샵 4건이 같은 분에 올라온다(실측). 묻지도 않고 켜면 그날 알림이
  // 아홉 번 울린다.
  it('앱 공지·게임 공지·썬데이 셋을 켠다', async () => {
    await useNoticeStore.getState().subscribeDefaults()

    expect(useNoticeStore.getState().subscriptions).toEqual({
      app: true,
      game: true,
      event: true,
      update: false,
      cashshop: false,
    })
    expect(subscribe).toHaveBeenCalledTimes(3)
  })

  it('안 켜는 것은 해제도 안 부른다', async () => {
    await useNoticeStore.getState().subscribeDefaults()

    expect(unsubscribe).not.toHaveBeenCalled()
  })
})

describe('전체 스위치', () => {
  // 화면에서 감추기만 하면 구독은 FCM 쪽에 남아, 스위치는 꺼져 있는데 알림은 오는 상태가 된다.
  it('끄면 켜져 있던 것을 실제로 해제한다', async () => {
    await useNoticeStore.getState().setSubscribed('app', true)
    await useNoticeStore.getState().setSubscribed('cashshop', true)
    jest.clearAllMocks()

    await useNoticeStore.getState().setAllSubscribed(false)

    expect(unsubscribe.mock.calls.map((call) => call[0]).sort()).toEqual([
      'notice',
      'notice-cashshop',
    ])
    expect(useNoticeStore.getState().subscriptions).toEqual(NO_SUBSCRIPTIONS)
    await expect(getNoticeSubscriptions()).resolves.toEqual(NO_SUBSCRIPTIONS)
  })

  // 안 켠 것을 또 해제하면 FCM 왕복이 공짜로 늘고 실패할 자리도 는다.
  it('안 켠 것은 해제도 안 부른다', async () => {
    await useNoticeStore.getState().setSubscribed('app', true)
    jest.clearAllMocks()

    await useNoticeStore.getState().setAllSubscribed(false)

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('켜면 기본 묶음 셋을 켠다', async () => {
    await useNoticeStore.getState().setAllSubscribed(true)

    expect(useNoticeStore.getState().subscriptions).toEqual({
      app: true,
      game: true,
      event: true,
      update: false,
      cashshop: false,
    })
  })

  // 켜는 길은 개별 스위치와 같은 문을 지난다.
  it('권한이 없으면 켜지 않고 막힌 이유를 남긴다', async () => {
    hasPermission.mockResolvedValue(false)
    await setNotificationPermissionAsked()

    await useNoticeStore.getState().setAllSubscribed(true)

    expect(subscribe).not.toHaveBeenCalled()
    expect(useNoticeStore.getState().subscriptions).toEqual(NO_SUBSCRIPTIONS)
    expect(useNoticeStore.getState().blockedByPermission).toBe(true)
  })

  // 끄는 길은 권한과 무관하다. 거기서 막으면 권한 없는 사용자가 구독을 해제할 방법이 없어진다.
  it('끄는 길은 권한을 안 본다', async () => {
    await useNoticeStore.getState().setSubscribed('app', true)
    hasPermission.mockResolvedValue(false)
    jest.clearAllMocks()

    await useNoticeStore.getState().setAllSubscribed(false)

    expect(unsubscribe).toHaveBeenCalled()
    expect(hasPermission).not.toHaveBeenCalled()
  })
})

describe('권한이 없는 채로 켜려 할 때', () => {
  // 조용히 구독만 하면 스위치는 켜져 있고 알림은 안 온다. 사용자는 그것을 고장으로 읽는다.
  // iOS 는 이미 물어본 뒤에는 팝업을 다시 못 띄우므로 말해 주는 것 말고 할 수 있는 일이 없다.
  it('이미 물었으면 구독을 안 걸고 막힌 이유를 남긴다', async () => {
    hasPermission.mockResolvedValue(false)
    await setNotificationPermissionAsked()

    await useNoticeStore.getState().setSubscribed('game', true)

    expect(subscribe).not.toHaveBeenCalled()
    expect(useNoticeStore.getState().subscriptions.game).toBe(false)
    expect(useNoticeStore.getState().blockedByPermission).toBe(true)
  })

  it('권한이 있으면 막지 않는다', async () => {
    hasPermission.mockResolvedValue(true)
    requestPermission.mockResolvedValue(true)

    await useNoticeStore.getState().setSubscribed('game', true)

    expect(subscribe).toHaveBeenCalled()
    expect(useNoticeStore.getState().blockedByPermission).toBe(false)
  })

  // 끄는 것은 권한과 무관하다. 권한이 없어도 구독 해제는 되어야 한다.
  it('끄는 길은 권한을 안 본다', async () => {
    await useNoticeStore.getState().setSubscribed('game', true)
    hasPermission.mockResolvedValue(false)
    jest.clearAllMocks()

    await useNoticeStore.getState().setSubscribed('game', false)

    expect(unsubscribe).toHaveBeenCalled()
    expect(hasPermission).not.toHaveBeenCalled()
  })
})

describe('한 번도 안 물은 채로 켤 때', () => {
  // iOS 는 앱이 한 번도 안 물으면 **설정에 그 앱의 알림 항목을 안 만든다.** 그래서 여기서
  // 설정으로 보내면 갈 곳이 없는 막다른 길이 된다. 스위치를 켜는 것도 묻는 자리여야 한다.
  it('설정으로 보내지 않고 직접 묻는다', async () => {
    hasPermission.mockResolvedValue(false)

    await useNoticeStore.getState().setSubscribed('game', true)

    expect(requestPermission).toHaveBeenCalledTimes(1)
    expect(useNoticeStore.getState().blockedByPermission).toBe(false)
  })

  it('물어서 허용하면 구독까지 간다', async () => {
    hasPermission.mockResolvedValue(false)
    requestPermission.mockResolvedValue(true)

    await useNoticeStore.getState().setSubscribed('game', true)

    expect(subscribe).toHaveBeenCalled()
    expect(useNoticeStore.getState().subscriptions.game).toBe(true)
  })

  it('물었는데 거부하면 막힌다', async () => {
    hasPermission.mockResolvedValue(false)
    requestPermission.mockResolvedValue(false)

    await useNoticeStore.getState().setSubscribed('game', true)

    expect(subscribe).not.toHaveBeenCalled()
    expect(useNoticeStore.getState().blockedByPermission).toBe(true)
  })

  // 이미 물어본 뒤에는 다시 안 묻는다. iOS 가 팝업을 안 띄우므로 설정으로 보내는 수밖에 없다.
  it('이미 물었으면 다시 안 묻고 설정으로 보낸다', async () => {
    hasPermission.mockResolvedValue(false)
    await setNotificationPermissionAsked()

    await useNoticeStore.getState().setSubscribed('game', true)

    expect(requestPermission).not.toHaveBeenCalled()
    expect(useNoticeStore.getState().blockedByPermission).toBe(true)
  })
})

// 구독은 FCM 왕복이라 몇 초가 걸린다. 그 사이 누름을 막으면 사용자는 반응이 느리다고 본다. 막지
// 않으려면 겹침을 스토어가 없애야 한다. 다섯이 저장 값 하나를 고쳐 쓰고 저장할 값을 왕복 뒤에
// 읽어서, 둘이 겹치면 늦게 끝난 쪽이 먼저 끝난 쪽을 덮는다.
describe('왕복 중의 누름', () => {
  /** 풀어 줄 때까지 안 끝나는 왕복. 그동안 뒤의 요청은 줄에서 기다린다. */
  function 멈춘왕복(): { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void } {
    let resolve!: () => void
    let reject!: (e: Error) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  /** 앞 요청이 왕복에 들어설 때까지. 목과 가짜 저장소가 전부 마이크로태스크라 한 틱이면 된다. */
  const 한틱 = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

  it('누른 값은 왕복을 기다리지 않고 바로 적힌다', async () => {
    const 대기 = 멈춘왕복()
    subscribe.mockReturnValueOnce(대기.promise)

    const done = useNoticeStore.getState().setSubscribed('game', true)

    expect(useNoticeStore.getState().pending).toEqual({ game: true })
    expect(useNoticeStore.getState().subscriptions.game).toBe(false)

    대기.resolve()
    await done

    expect(useNoticeStore.getState().pending).toEqual({})
    expect(useNoticeStore.getState().subscriptions.game).toBe(true)
  })

  it('앞 요청이 도는 동안 다른 스위치를 눌러도 바로 적힌다', async () => {
    const 대기 = 멈춘왕복()
    subscribe.mockReturnValueOnce(대기.promise)
    const first = useNoticeStore.getState().setSubscribed('game', true)
    await 한틱()

    const second = useNoticeStore.getState().setSubscribed('cashshop', true)

    expect(useNoticeStore.getState().pending).toEqual({ game: true, cashshop: true })
    // 줄이 하나씩 돌린다. 앞 것이 끝나기 전에는 둘째 구독을 부르지 않는다.
    expect(subscribe).toHaveBeenCalledTimes(1)

    대기.resolve()
    await Promise.all([first, second])

    // 둘이 서로를 덮지 않는다.
    expect(useNoticeStore.getState().subscriptions).toMatchObject({ game: true, cashshop: true })
    await expect(getNoticeSubscriptions()).resolves.toMatchObject({ game: true, cashshop: true })
  })

  // 늦게 끝난 요청이 이기면 마지막으로 누른 것과 다른 상태로 끝난다.
  it('켜기, 끄기 연타는 끄기로 끝난다', async () => {
    const 대기 = 멈춘왕복()
    subscribe.mockReturnValueOnce(대기.promise)
    const on = useNoticeStore.getState().setSubscribed('game', true)
    await 한틱()

    const off = useNoticeStore.getState().setSubscribed('game', false)

    expect(useNoticeStore.getState().pending).toEqual({ game: false })

    대기.resolve()
    await Promise.all([on, off])

    expect(unsubscribe).toHaveBeenCalledWith('notice-game')
    expect(useNoticeStore.getState().subscriptions.game).toBe(false)
    expect(useNoticeStore.getState().pending).toEqual({})
    await expect(getNoticeSubscriptions()).resolves.toMatchObject({ game: false })
  })

  it('켜기, 끄기, 켜기는 서버에 구독 한 번만 보낸다', async () => {
    const 대기 = 멈춘왕복()
    subscribe.mockReturnValueOnce(대기.promise)
    const presses = [useNoticeStore.getState().setSubscribed('game', true)]
    await 한틱()
    presses.push(useNoticeStore.getState().setSubscribed('game', false))
    presses.push(useNoticeStore.getState().setSubscribed('game', true))

    대기.resolve()
    await Promise.all(presses)

    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(unsubscribe).not.toHaveBeenCalled()
    expect(useNoticeStore.getState().subscriptions.game).toBe(true)
  })

  // 요청은 차례가 왔을 때 누른 값을 읽는다. 그때 저장된 값과 같으면 보낼 것이 없다.
  it('차례가 오기 전에 되돌린 누름은 서버에 아무것도 안 보낸다', async () => {
    const 대기 = 멈춘왕복()
    subscribe.mockReturnValueOnce(대기.promise)
    const first = useNoticeStore.getState().setSubscribed('cashshop', true)
    await 한틱()
    const presses = [
      useNoticeStore.getState().setSubscribed('game', true),
      useNoticeStore.getState().setSubscribed('game', false),
    ]

    대기.resolve()
    await Promise.all([first, ...presses])

    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledWith('notice-cashshop')
    expect(useNoticeStore.getState().subscriptions.game).toBe(false)
  })

  it('실패하면 그 스위치만 돌아간다', async () => {
    subscribe.mockImplementation(async (topic) => {
      if (topic === 'notice-game') throw new Error('망 끊김')
    })

    const [game, cashshop] = await Promise.allSettled([
      useNoticeStore.getState().setSubscribed('game', true),
      useNoticeStore.getState().setSubscribed('cashshop', true),
    ])

    expect(game).toMatchObject({ status: 'rejected' })
    expect(cashshop).toMatchObject({ status: 'fulfilled' })
    expect(useNoticeStore.getState().subscriptions).toMatchObject({ game: false, cashshop: true })
    expect(useNoticeStore.getState().pending).toEqual({})
  })

  it('실패한 요청 뒤에 같은 스위치를 또 눌렀으면 마지막 누름을 따른다', async () => {
    await useNoticeStore.getState().setSubscribed('game', true)
    jest.clearAllMocks()
    const 대기 = 멈춘왕복()
    unsubscribe.mockReturnValueOnce(대기.promise)
    const off = useNoticeStore.getState().setSubscribed('game', false)
    await 한틱()
    const on = useNoticeStore.getState().setSubscribed('game', true)

    대기.reject(new Error('망 끊김'))
    await Promise.allSettled([off, on])

    expect(useNoticeStore.getState().subscriptions.game).toBe(true)
    expect(useNoticeStore.getState().pending).toEqual({})
    // 마지막 누름이 이미 저장된 값이라 다시 구독하지 않는다.
    expect(subscribe).not.toHaveBeenCalled()
  })

  // 전체와 개별이 같은 줄에 서야 서로를 덮지 않는다.
  it('개별 켜기가 도는 중에 전체를 끄면 전부 꺼진 채로 끝난다', async () => {
    await useNoticeStore.getState().setSubscribed('app', true)
    jest.clearAllMocks()
    const 대기 = 멈춘왕복()
    subscribe.mockReturnValueOnce(대기.promise)
    const on = useNoticeStore.getState().setSubscribed('game', true)
    await 한틱()

    const allOff = useNoticeStore.getState().setAllSubscribed(false)

    expect(useNoticeStore.getState().pending).toEqual(NO_SUBSCRIPTIONS)

    대기.resolve()
    await Promise.all([on, allOff])

    expect(unsubscribe.mock.calls.map((call) => call[0]).sort()).toEqual(['notice', 'notice-game'])
    expect(useNoticeStore.getState().subscriptions).toEqual(NO_SUBSCRIPTIONS)
    await expect(getNoticeSubscriptions()).resolves.toEqual(NO_SUBSCRIPTIONS)
  })

  it('전체 켜기가 도는 중에 끈 스위치는 꺼진 채로 끝난다', async () => {
    const 대기 = 멈춘왕복()
    subscribe.mockReturnValueOnce(대기.promise)
    const allOn = useNoticeStore.getState().setAllSubscribed(true)
    await 한틱()

    const off = useNoticeStore.getState().setSubscribed('event', false)

    대기.resolve()
    await Promise.all([allOn, off])

    expect(subscribe).toHaveBeenCalledTimes(2)
    expect(useNoticeStore.getState().subscriptions).toEqual({
      ...NO_SUBSCRIPTIONS,
      app: true,
      game: true,
    })
  })

  // 켜진 채로 남으면 알림은 안 오는데 스위치는 켜져 보인다.
  it('권한에 막히면 누른 값을 버린다', async () => {
    hasPermission.mockResolvedValue(false)
    await setNotificationPermissionAsked()

    await useNoticeStore.getState().setSubscribed('game', true)

    expect(useNoticeStore.getState().pending).toEqual({})
    expect(useNoticeStore.getState().blockedByPermission).toBe(true)
  })
})
