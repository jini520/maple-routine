jest.mock('../../../native/notifications', () => ({
  __esModule: true,
  hasNotificationPermission: jest.fn(),
}))

jest.mock('../../../native/push', () => ({
  __esModule: true,
  subscribeToPushTopic: jest.fn(),
  unsubscribeFromPushTopic: jest.fn(),
}))

import { hasNotificationPermission } from '../../../native/notifications'
import { subscribeToPushTopic, unsubscribeFromPushTopic } from '../../../native/push'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getNoticeSubscribed } from '../../../storage/notice-settings'
import { NOTICE_TOPIC, useNoticeStore } from '../store'

const subscribe = jest.mocked(subscribeToPushTopic)
const unsubscribe = jest.mocked(unsubscribeFromPushTopic)
const hasPermission = jest.mocked(hasNotificationPermission)

beforeEach(async () => {
  const prefs = installFakePreferences()
  await prefs.remove('noticeSubscribed')
  jest.clearAllMocks()
  subscribe.mockResolvedValue(undefined)
  unsubscribe.mockResolvedValue(undefined)
  hasPermission.mockResolvedValue(true)
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
  // iOS 는 여기서 팝업을 다시 못 띄우므로 말해 주는 것 말고 할 수 있는 일이 없다.
  it('구독을 안 걸고 막힌 이유를 남긴다', async () => {
    hasPermission.mockResolvedValue(false)

    await useNoticeStore.getState().setSubscribed(true)

    expect(subscribe).not.toHaveBeenCalled()
    expect(useNoticeStore.getState().subscribed).toBe(false)
    expect(useNoticeStore.getState().blockedByPermission).toBe(true)
  })

  it('권한이 있으면 막지 않는다', async () => {
    hasPermission.mockResolvedValue(true)

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
