// 이 화면이 지키는 것.
//
// ① 스위치가 설정 본화면이 아니라 여기 있다. 목록과 함께 서야 사용자가 무엇을 켜는지 안다.
// ② 목록은 사본이나 응답을 받은 순서 그대로 그린다. 화면이 다시 정렬하지 않는다.
// ③ 행을 누르면 상세로 밀되 **`noticeId` 만** 넘긴다. 본문을 넘기면 알림에서 온 경로와
//    목록에서 온 경로가 서로 다른 내용을 그릴 수 있다.
import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { refreshNoticeKind } from '../../../features/notice/notice-feed'
import { getNotices } from '../../../storage/notices'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'
import { SettingsNoticesScreen } from '../SettingsNoticesScreen'
import type { Notice, NoticeKind } from '../../../types/notice'

jest.mock('../../../storage/notices', () => ({ __esModule: true, getNotices: jest.fn() }))
jest.mock('../../../features/notice/notice-feed', () => ({
  __esModule: true,
  refreshNoticeKind: jest.fn(async () => null),
}))
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: jest.fn(),
}))

const notices = jest.mocked(getNotices)
const refresh = jest.mocked(refreshNoticeKind)
const navigate = jest.fn()
const goBack = jest.fn()

function notice(id: string, title: string, publishedAt: string, kind: NoticeKind = 'app'): Notice {
  return { id, kind, title, body: `${id} 본문`, publishedAt }
}

beforeEach(() => {
  jest.clearAllMocks()
  notices.mockResolvedValue([])
  refresh.mockResolvedValue(null)
  jest.mocked(useSettingsNavigation).mockReturnValue({ navigate, goBack } as never)
})

describe('목록', () => {
  // 제목은 부르는 쪽이 준다. 소식 카드의 행 이름이 그대로 화면 제목이자 빈 상태 문구가 된다.
  it('받은 것이 없으면 그 분류 이름으로 빈 상태를 말한다', async () => {
    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['cashshop'], title: '캐시샵 업데이트' } }} />,
    )

    expect(view.getByText('아직 받은 캐시샵 업데이트가 없습니다')).toBeTruthy()
  })

  it('분류를 안 주면 소식 전부다', async () => {
    const view = await renderOverlay(<SettingsNoticesScreen />)

    expect(view.getByText('아직 받은 소식이 없습니다')).toBeTruthy()
  })

  // 한 목록에 다 담으면 점검 안내와 캐시아이템이 섞인다.
  it('준 분류만 그린다', async () => {
    notices.mockResolvedValue([
      { id: 'game-1', kind: 'game', title: '점검 안내', body: '본문', publishedAt: '2026-09-09T00:00:00Z' },
      { id: 'cashshop-1', kind: 'cashshop', title: '캐시 업데이트', body: '본문', publishedAt: '2026-09-08T00:00:00Z' },
    ])

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '공지사항' } }} />,
    )

    await waitFor(() => expect(view.getByText('점검 안내')).toBeTruthy())
    expect(view.queryByText('캐시 업데이트')).toBeNull()
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


describe('모양', () => {
  // 두 분류는 본문이 그림 한 장이라 제목만으로는 무엇인지 알 수 없다.
  it.each([
    ['event', '진행 중인 이벤트'],
    ['cashshop', '캐시샵 업데이트'],
  ] as const)('%s 는 그림 · 제목 · 기간 카드를 쌓는다', async (kind, title) => {
    notices.mockResolvedValue([notice(`${kind}-1`, '배너 공지', '2026-09-10T00:00:00Z', kind)])

    const view = await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: [kind], title } }} />)

    await waitFor(() => expect(view.getAllByTestId('notice-banner-card')).toHaveLength(1))
    expect(view.queryByTestId('notice-row')).toBeNull()
  })

  it('글 공지는 제목을 자르지 않는 글 줄이다', async () => {
    notices.mockResolvedValue([notice('game-1', '아주 긴 게임 공지 제목', '2026-09-10T00:00:00Z', 'game')])

    const view = await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '게임 공지사항' } }} />)

    await waitFor(() => expect(view.getByText('아주 긴 게임 공지 제목')).toBeTruthy())
    expect(view.getByText('아주 긴 게임 공지 제목').props.numberOfLines).toBeUndefined()
    expect(view.queryByTestId('notice-banner-card')).toBeNull()
  })

  // 조사를 `이` 로 고정하면 `아직 받은 업데이트이 없습니다` 가 된다.
  it('빈 문구의 조사를 이름에 맞춘다', async () => {
    const view = await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: ['update'], title: '업데이트' } }} />)

    expect(view.getByText('아직 받은 업데이트가 없습니다')).toBeTruthy()
  })
})

describe('받기', () => {
  it('그 분류만 받는다', async () => {
    await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '게임 공지사항' } }} />)

    await waitFor(() => expect(refresh).toHaveBeenCalledWith('game'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  // 기준(서버 · 넥슨 목록)에서 내린 글이 목록에 남던 자리. 사본을 바꾸는 일은 받는 쪽이 한다.
  it('성공하면 받은 목록을 그린다', async () => {
    const 남은것 = notice('kept', '남은 공지', '2026-09-01T00:00:00Z')
    notices.mockResolvedValue([notice('deleted', '지운 공지', '2026-09-05T00:00:00Z'), 남은것])
    refresh.mockResolvedValue([남은것])

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )

    await waitFor(() => expect(view.queryByText('지운 공지')).toBeNull())
    expect(view.getByText('남은 공지')).toBeTruthy()
  })

  it('빈 목록을 받으면 빈 상태를 그린다', async () => {
    notices.mockResolvedValue([notice('deleted', '지운 공지', '2026-09-05T00:00:00Z')])
    refresh.mockResolvedValue([])

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )

    await waitFor(() => expect(view.getByText('아직 받은 앱 공지사항이 없습니다')).toBeTruthy())
  })

  // 받기 실패가 화면 전체의 실패가 되면 안 된다. 사본은 그대로 보여야 한다.
  it('받기가 실패하면 사본을 그린다', async () => {
    notices.mockResolvedValue([notice('local-1', '기기에 있던 공지', '2026-09-01T00:00:00Z')])

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(view.getByText('기기에 있던 공지')).toBeTruthy()
  })

  // 분류마다 따로 받으므로 받은 분류만 바뀌고, 섞인 목록은 최근 발행순으로 선다.
  it('분류를 안 주면 다섯을 따로 받아 받은 분류만 바꾼다', async () => {
    notices.mockResolvedValue([
      notice('app-old', '앱 공지 사본', '2026-09-02T00:00:00Z'),
      notice('game-old', '게임 공지 사본', '2026-09-01T00:00:00Z', 'game'),
    ])
    refresh.mockImplementation(async (kind) =>
      kind === 'game' ? [notice('game-new', '받은 게임 공지', '2026-09-09T00:00:00Z', 'game')] : null,
    )

    const view = await renderOverlay(<SettingsNoticesScreen />)

    await waitFor(() => expect(view.getByText('받은 게임 공지')).toBeTruthy())
    expect(refresh).toHaveBeenCalledTimes(5)
    expect(view.queryByText('게임 공지 사본')).toBeNull()
    expect(view.getAllByTestId('notice-row').map((row) => row.props.accessibilityLabel)).toEqual([
      '받은 게임 공지',
      '앱 공지 사본',
    ])
  })
})
