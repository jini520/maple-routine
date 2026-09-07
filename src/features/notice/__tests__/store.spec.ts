jest.mock('../../../native/push', () => ({
  __esModule: true,
  subscribeToPushTopic: jest.fn(),
  unsubscribeFromPushTopic: jest.fn(),
}))

import { subscribeToPushTopic, unsubscribeFromPushTopic } from '../../../native/push'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getNoticeSubscribed } from '../../../storage/notice-settings'
import { NOTICE_TOPIC, useNoticeStore } from '../store'

const subscribe = jest.mocked(subscribeToPushTopic)
const unsubscribe = jest.mocked(unsubscribeFromPushTopic)

beforeEach(async () => {
  const prefs = installFakePreferences()
  await prefs.remove('noticeSubscribed')
  jest.clearAllMocks()
  subscribe.mockResolvedValue(undefined)
  unsubscribe.mockResolvedValue(undefined)
  useNoticeStore.setState({ subscribed: false })
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
