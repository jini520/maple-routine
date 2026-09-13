/** @jest-environment jsdom */
// 진입점 넷을 한 훅이 든다. 하나라도 빠지면 **어떤 경로에서만** 안 먹는 증상이 나는데,
// 그건 코드를 읽어서는 안 보이고 기기에서 그 경로를 밟아야만 드러난다.
//
//   앞에 있을 때 도착   → onMessage. FCM 이 OS 에 안 넘기므로 여기서만 받는다
//   배경에서 탭         → onNotificationOpenedApp
//   죽어 있다 탭으로 열림 → getInitialNotification. **한 번만 답한다**
//
// 배경에서 도착만 하고 안 탭한 것은 여기 안 온다. notification 페이로드는 JS 를 안 깨운다.
// 그 구멍은 서버 조회가 메운다.
//
// **어느 길도 기기에 쓰지 않는다.** 공지의 기준은 서버라 푸시 내용을 저장하면 서버가 지운 공지를
// 기기에서 지울 신호가 없다. 앞에 있을 때 오면 배너가 서버를 다시 묻고, 탭하면 상세가 서버에 묻는다.
import { renderHook, waitFor } from '@testing-library/react'

jest.mock('../../../native/push', () => ({
  __esModule: true,
  addPushMessageListener: jest.fn(() => () => {}),
  addPushOpenedListener: jest.fn(() => () => {}),
  getInitialPushNotification: jest.fn(async () => null),
}))
jest.mock('../banner-store', () => {
  const refresh = jest.fn(async () => {})
  return { __esModule: true, useNoticeBannerStore: { getState: () => ({ refresh }) } }
})

import {
  addPushMessageListener,
  addPushOpenedListener,
  getInitialPushNotification,
} from '../../../native/push'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { useNoticeBannerStore } from '../banner-store'
import { useNoticeDelivery } from '../use-notice-delivery'

const onMessage = jest.mocked(addPushMessageListener)
const onOpened = jest.mocked(addPushOpenedListener)
const initial = jest.mocked(getInitialPushNotification)
const refresh = jest.mocked(useNoticeBannerStore.getState().refresh)
const openDetail = jest.fn()
let prefs = installFakePreferences()

const 공지 = {
  noticeId: 'a',
  title: '점검',
  body: '본문',
  publishedAt: '2026-09-07T12:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  prefs = installFakePreferences()
  onMessage.mockReturnValue(() => {})
  onOpened.mockReturnValue(() => {})
  initial.mockResolvedValue(null)
})

describe('진입점 셋을 다 단다', () => {
  it('앞에 있을 때와 탭 둘 다 구독한다', () => {
    renderHook(() => useNoticeDelivery(openDetail))

    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(onOpened).toHaveBeenCalledTimes(1)
  })

  it('언마운트하면 둘 다 해제한다', () => {
    const offMessage = jest.fn()
    const offOpened = jest.fn()
    onMessage.mockReturnValue(offMessage)
    onOpened.mockReturnValue(offOpened)

    renderHook(() => useNoticeDelivery(openDetail)).unmount()

    expect(offMessage).toHaveBeenCalled()
    expect(offOpened).toHaveBeenCalled()
  })
})

describe('앞에 있을 때 도착', () => {
  // 이 길은 OS 가 알림을 안 그린다. 배너가 서버를 다시 묻지 않으면 화면에 아무 일도 안 일어난다.
  it('배너가 서버를 다시 묻고 화면을 밀지 않는다', async () => {
    renderHook(() => useNoticeDelivery(openDetail))
    onMessage.mock.calls[0][0](공지)

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(openDetail).not.toHaveBeenCalled()
  })

  it('푸시 내용을 기기에 쓰지 않는다', async () => {
    renderHook(() => useNoticeDelivery(openDetail))
    onMessage.mock.calls[0][0](공지)

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(prefs.set).not.toHaveBeenCalled()
  })

  it('공지가 아닌 푸시로는 서버를 안 묻는다', () => {
    renderHook(() => useNoticeDelivery(openDetail))
    onMessage.mock.calls[0][0]({ 아무거나: '값' })

    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('탭', () => {
  it('상세를 민다', async () => {
    renderHook(() => useNoticeDelivery(openDetail))
    onOpened.mock.calls[0][0](공지)

    await waitFor(() => expect(openDetail).toHaveBeenCalledWith('a'))
  })

  it('푸시 내용을 기기에 쓰지 않는다', async () => {
    renderHook(() => useNoticeDelivery(openDetail))
    onOpened.mock.calls[0][0](공지)

    await waitFor(() => expect(openDetail).toHaveBeenCalled())
    expect(prefs.set).not.toHaveBeenCalled()
  })

  // 이벤트·캐시샵 본문은 이미지 한 장이라 평문이 0자로 온다. 본문을 필수로 보면 그 알림이
  // 공지가 아닌 것으로 읽혀서, 눌러도 아무 일이 안 일어난다.
  it('본문이 빈 알림도 상세를 민다', async () => {
    renderHook(() => useNoticeDelivery(openDetail))
    onOpened.mock.calls[0][0]({ ...공지, noticeId: 'event-1374', kind: 'event', body: '' })

    await waitFor(() => expect(openDetail).toHaveBeenCalledWith('event-1374'))
  })

  it('공지가 아닌 푸시로는 안 민다', () => {
    renderHook(() => useNoticeDelivery(openDetail))
    onOpened.mock.calls[0][0]({ 아무거나: '값' })

    expect(openDetail).not.toHaveBeenCalled()
  })
})

describe('죽어 있다 탭으로 열림', () => {
  it('있으면 상세를 민다', async () => {
    initial.mockResolvedValue(공지)

    renderHook(() => useNoticeDelivery(openDetail))

    await waitFor(() => expect(openDetail).toHaveBeenCalledWith('a'))
  })

  it('없으면 아무 일도 없다', async () => {
    renderHook(() => useNoticeDelivery(openDetail))

    await waitFor(() => expect(initial).toHaveBeenCalled())
    expect(openDetail).not.toHaveBeenCalled()
  })

  // 한 번만 답하는 API 라 두 번 읽으면 뒤가 빈손이다. 마운트당 한 번이 계약이다.
  it('한 번만 읽는다', async () => {
    const { rerender } = renderHook(() => useNoticeDelivery(openDetail))
    rerender({})

    await waitFor(() => expect(initial).toHaveBeenCalledTimes(1))
  })
})
