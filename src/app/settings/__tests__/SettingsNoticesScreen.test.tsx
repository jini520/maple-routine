// 이 화면이 지키는 것.
//
// ① 스위치가 설정 본화면이 아니라 여기 있다. 목록과 함께 서야 사용자가 무엇을 켜는지 안다.
// ② 목록은 저장소가 준 것을 그대로 그린다. 화면이 다시 정렬하지 않는다.
// ③ 행을 누르면 상세로 밀되 **`noticeId` 만** 넘긴다. 본문을 넘기면 알림에서 온 경로와
//    목록에서 온 경로가 서로 다른 내용을 그릴 수 있다.
import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useNoticeStore } from '../../../features/notice/store'
import { NOTICE_TOPICS } from '../../../features/notice/topics'
import { NO_SUBSCRIPTIONS } from '../../../types/notice'
import { fetchNotices } from '../../../server/notices'
import { getNotices, mergeNotices } from '../../../storage/notices'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'
import { SettingsNoticesScreen } from '../SettingsNoticesScreen'
import type { Notice } from '../../../types/notice'

jest.mock('../../../storage/notices', () => ({
  __esModule: true,
  getNotices: jest.fn(),
  mergeNotices: jest.fn(async () => {}),
}))
jest.mock('../../../server/notices', () => ({ __esModule: true, fetchNotices: jest.fn(async () => []) }))
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: jest.fn(),
}))

const notices = jest.mocked(getNotices)
const remote = jest.mocked(fetchNotices)
const merge = jest.mocked(mergeNotices)
const navigate = jest.fn()
const goBack = jest.fn()

function notice(id: string, title: string, publishedAt: string): Notice {
  return { id, kind: 'app', title, body: `${id} 본문`, publishedAt }
}

beforeEach(() => {
  jest.clearAllMocks()
  notices.mockResolvedValue([])
  remote.mockResolvedValue([])
  merge.mockResolvedValue(undefined)
  jest.mocked(useSettingsNavigation).mockReturnValue({ navigate, goBack } as never)
  useNoticeStore.setState({
    subscriptions: NO_SUBSCRIPTIONS,
    blockedByPermission: false,
    setSubscribed: jest.fn().mockResolvedValue(undefined),
  })
})

describe('구독 스위치', () => {
  it('네 토글이 다 있다', async () => {
    const view = await renderOverlay(<SettingsNoticesScreen />)

    for (const topic of NOTICE_TOPICS) {
      expect(view.getByLabelText(`${topic.label} 알림`)).toBeTruthy()
    }
  })

  it('꺼져 있으면 켜는 쪽으로 부른다', async () => {
    const setSubscribed = jest.fn().mockResolvedValue(undefined)
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS, setSubscribed })
    const view = await renderOverlay(<SettingsNoticesScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('게임 공지사항 알림'))
    })

    expect(setSubscribed).toHaveBeenCalledWith('game', true)
  })

  it('켜져 있으면 끄는 쪽으로 부른다', async () => {
    const setSubscribed = jest.fn().mockResolvedValue(undefined)
    useNoticeStore.setState({
      subscriptions: { ...NO_SUBSCRIPTIONS, cashshop: true },
      setSubscribed,
    })
    const view = await renderOverlay(<SettingsNoticesScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐시샵 알림'))
    })

    expect(setSubscribed).toHaveBeenCalledWith('cashshop', false)
  })
})

describe('목록', () => {
  it('받은 것이 없으면 빈 상태를 말한다', async () => {
    const view = await renderOverlay(<SettingsNoticesScreen />)

    expect(view.getByText('아직 받은 공지가 없습니다')).toBeTruthy()
  })

  it('저장소가 준 순서를 그대로 그린다', async () => {
    notices.mockResolvedValue([
      notice('b', '나중 공지', '2026-09-05T00:00:00Z'),
      notice('a', '먼저 공지', '2026-09-01T00:00:00Z'),
    ])
    const view = await renderOverlay(<SettingsNoticesScreen />)

    const rows = view.getAllByTestId('notice-row')
    expect(rows).toHaveLength(2)
    expect(view.getByText('나중 공지')).toBeTruthy()
  })

  it('누르면 noticeId 만 넘겨 상세로 민다', async () => {
    notices.mockResolvedValue([notice('a', '점검 안내', '2026-09-01T00:00:00Z')])
    const view = await renderOverlay(<SettingsNoticesScreen />)

    await act(async () => {
      fireEvent.press(view.getByTestId('notice-row'))
    })

    expect(navigate).toHaveBeenCalledWith('SettingsNoticeDetail', { noticeId: 'a' })
  })
})

describe('권한이 없어 막혔을 때', () => {
  it('평소에는 안내가 없다', async () => {
    const view = await renderOverlay(<SettingsNoticesScreen />)

    expect(view.queryByLabelText('알림 권한 설정 열기')).toBeNull()
  })

  // 조용히 두면 사용자는 스위치가 안 켜지는 것을 고장으로 읽는다.
  it('막히면 설정으로 가는 길을 준다', async () => {
    useNoticeStore.setState({ blockedByPermission: true })
    const view = await renderOverlay(<SettingsNoticesScreen />)

    expect(view.getByLabelText('알림 권한 설정 열기')).toBeTruthy()
    expect(view.getByText('기기에서 알림이 꺼져 있어요')).toBeTruthy()
  })
})

describe('서버 보강', () => {
  // 푸시는 배경에서 도착만 한 공지를 못 쌓는다. 그 구멍을 이 조회가 메운다.
  it('서버 것을 받아 기기에 합친다', async () => {
    const 서버것 = notice('server-1', '서버에서 온 공지', '2026-09-09T00:00:00Z')
    remote.mockResolvedValue([서버것])
    notices.mockResolvedValueOnce([]).mockResolvedValue([서버것])

    const view = await renderOverlay(<SettingsNoticesScreen />)

    await waitFor(() => expect(merge).toHaveBeenCalledWith([서버것]))
    await waitFor(() => expect(view.getByText('서버에서 온 공지')).toBeTruthy())
  })

  // 조회 실패가 화면 전체의 실패가 되면 안 된다. 로컬 것은 그대로 보여야 한다.
  it('조회가 실패해도 로컬 것을 그린다', async () => {
    remote.mockRejectedValue(new Error('offline'))
    notices.mockResolvedValue([notice('local-1', '기기에 있던 공지', '2026-09-01T00:00:00Z')])

    const view = await renderOverlay(<SettingsNoticesScreen />)

    expect(view.getByText('기기에 있던 공지')).toBeTruthy()
  })

  it('서버가 빈손이면 합치지 않는다', async () => {
    remote.mockResolvedValue([])

    await renderOverlay(<SettingsNoticesScreen />)

    expect(merge).not.toHaveBeenCalled()
  })
})
