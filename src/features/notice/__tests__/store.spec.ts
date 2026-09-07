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
  setNotificationPermissionAsked,
} from '../../../storage/notice-settings'
import { NOTICE_TOPIC, useNoticeStore } from '../store'

const subscribe = jest.mocked(subscribeToPushTopic)
const unsubscribe = jest.mocked(unsubscribeFromPushTopic)
const hasPermission = jest.mocked(hasNotificationPermission)
const requestPermission = jest.mocked(requestNotificationPermission)

beforeEach(async () => {
  const prefs = installFakePreferences()
  await prefs.remove('noticeSubscribed')
  await prefs.remove('notificationPermissionAsked')
  jest.clearAllMocks()
  subscribe.mockResolvedValue(undefined)
  unsubscribe.mockResolvedValue(undefined)
  hasPermission.mockResolvedValue(true)
  requestPermission.mockResolvedValue(true)
  useNoticeStore.setState({ subscribed: false, blockedByPermission: false })
})

describe('구독 토글', () => {
  it('켜면 토픽을 구독하고 저장한다', async () => {
    await useNoticeStore.getState().setSubscribed(true)

    expect(subscribe).toHaveBeenCalledWith(NOTICE_TOPIC)
    expect(useNoticeStore.getState().subscribed).toBe(true)
    await expect(getNoticeSubscribed()).resolves.toBe(true)
  })

  it('끄면 해제하고 저장한다', async () => {
    await useNoticeStore.getState().setSubscribed(true)
    jest.clearAllMocks()

    await useNoticeStore.getState().setSubscribed(false)

    expect(unsubscribe).toHaveBeenCalledWith(NOTICE_TOPIC)
    expect(useNoticeStore.getState().subscribed).toBe(false)
    await expect(getNoticeSubscribed()).resolves.toBe(false)
  })

  // FCM 구독이 실패했는데 켜졌다고 저장하면, 스위치는 켜져 있고 알림은 안 온다.
  // 그 상태는 화면만 보고는 못 가린다.
  it('토픽 구독이 실패하면 저장도 상태도 안 바뀐다', async () => {
    subscribe.mockRejectedValue(new Error('network'))

    await expect(useNoticeStore.getState().setSubscribed(true)).rejects.toThrow('network')

    expect(useNoticeStore.getState().subscribed).toBe(false)
    await expect(getNoticeSubscribed()).resolves.toBe(false)
  })
})

describe('복원', () => {
  it('저장된 값을 읽어 상태에 올린다', async () => {
    await useNoticeStore.getState().setSubscribed(true)
    useNoticeStore.setState({ subscribed: false })

    await useNoticeStore.getState().restore()

    expect(useNoticeStore.getState().subscribed).toBe(true)
  })

  // 복원은 저장된 사실을 읽는 것이지 새로 구독하는 것이 아니다.
  it('복원이 토픽을 다시 구독하지 않는다', async () => {
    await useNoticeStore.getState().setSubscribed(true)
    jest.clearAllMocks()

    await useNoticeStore.getState().restore()

    expect(subscribe).not.toHaveBeenCalled()
  })
})

describe('권한이 없는 채로 켜려 할 때', () => {
  // 조용히 구독만 하면 스위치는 켜져 있고 알림은 안 온다. 사용자는 그것을 고장으로 읽는다.
  // iOS 는 이미 물어본 뒤에는 팝업을 다시 못 띄우므로 말해 주는 것 말고 할 수 있는 일이 없다.
  it('이미 물었으면 구독을 안 걸고 막힌 이유를 남긴다', async () => {
    hasPermission.mockResolvedValue(false)
    await setNotificationPermissionAsked()

    await useNoticeStore.getState().setSubscribed(true)

    expect(subscribe).not.toHaveBeenCalled()
    expect(useNoticeStore.getState().subscribed).toBe(false)
    expect(useNoticeStore.getState().blockedByPermission).toBe(true)
  })

  it('권한이 있으면 막지 않는다', async () => {
    hasPermission.mockResolvedValue(true)
  requestPermission.mockResolvedValue(true)

    await useNoticeStore.getState().setSubscribed(true)

    expect(subscribe).toHaveBeenCalled()
    expect(useNoticeStore.getState().blockedByPermission).toBe(false)
  })

  // 끄는 것은 권한과 무관하다. 권한이 없어도 구독 해제는 되어야 한다.
  it('끄는 길은 권한을 안 본다', async () => {
    hasPermission.mockResolvedValue(false)

    await useNoticeStore.getState().setSubscribed(false)

    expect(unsubscribe).toHaveBeenCalled()
    expect(hasPermission).not.toHaveBeenCalled()
  })
})

describe('한 번도 안 물은 채로 켤 때', () => {
  // iOS 는 앱이 한 번도 안 물으면 **설정에 그 앱의 알림 항목을 안 만든다.** 그래서 여기서
  // 설정으로 보내면 갈 곳이 없는 막다른 길이 된다. 스위치를 켜는 것도 묻는 자리여야 한다.
  it('설정으로 보내지 않고 직접 묻는다', async () => {
    hasPermission.mockResolvedValue(false)

    await useNoticeStore.getState().setSubscribed(true)

    expect(requestPermission).toHaveBeenCalledTimes(1)
    expect(useNoticeStore.getState().blockedByPermission).toBe(false)
  })

  it('물어서 허용하면 구독까지 간다', async () => {
    hasPermission.mockResolvedValue(false)
    requestPermission.mockResolvedValue(true)

    await useNoticeStore.getState().setSubscribed(true)

    expect(subscribe).toHaveBeenCalled()
    expect(useNoticeStore.getState().subscribed).toBe(true)
  })

  it('물었는데 거부하면 막힌다', async () => {
    hasPermission.mockResolvedValue(false)
    requestPermission.mockResolvedValue(false)

    await useNoticeStore.getState().setSubscribed(true)

    expect(subscribe).not.toHaveBeenCalled()
    expect(useNoticeStore.getState().blockedByPermission).toBe(true)
  })

  // 이미 물어본 뒤에는 다시 안 묻는다. iOS 가 팝업을 안 띄우므로 설정으로 보내는 수밖에 없다.
  it('이미 물었으면 다시 안 묻고 설정으로 보낸다', async () => {
    hasPermission.mockResolvedValue(false)
    await setNotificationPermissionAsked()

    await useNoticeStore.getState().setSubscribed(true)

    expect(requestPermission).not.toHaveBeenCalled()
    expect(useNoticeStore.getState().blockedByPermission).toBe(true)
  })
})
