// 이 화면이 지키는 것.
//
// ① 스위치가 설정 본화면이 아니라 여기 있다. 목록과 함께 서야 사용자가 무엇을 켜는지 안다.
// ② 목록은 사본이나 응답을 받은 순서 그대로 그린다. 화면이 다시 정렬하지 않는다.
// ③ 행을 누르면 상세로 밀되 **`noticeId` 만** 넘긴다. 본문을 넘기면 알림에서 온 경로와
//    목록에서 온 경로가 서로 다른 내용을 그릴 수 있다.
import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { __resetToastsForTest, useToastStore } from '../../../features/toast/store'
import { refreshNoticeKinds } from '../../../features/notice/notice-feed'
import { getNotices } from '../../../storage/notices'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'
import { SettingsNoticesScreen } from '../SettingsNoticesScreen'
import type { Notice, NoticeKind } from '../../../types/notice'

jest.mock('../../../storage/notices', () => ({ __esModule: true, getNotices: jest.fn() }))
jest.mock('../../../features/notice/notice-feed', () => ({
  __esModule: true,
  refreshNoticeKinds: jest.fn(),
}))
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: jest.fn(),
}))

const notices = jest.mocked(getNotices)
const refresh = jest.mocked(refreshNoticeKinds)

/**
 * 갈래마다 받을 것을 정해 둔다. 빠진 갈래와 `null` 은 실패라 화면에 안 알린다
 * (사본이 그대로 서야 한다).
 */
function serveNotices(byKind: Partial<Record<NoticeKind, Notice[] | null>>): void {
  refresh.mockImplementation(async (kinds, onReceived) => {
    for (const kind of kinds) {
      const received = byKind[kind] ?? null
      if (received !== null) onReceived(kind, received)
    }
    return { allFailed: kinds.every((kind) => (byKind[kind] ?? null) === null) }
  })
}
const navigate = jest.fn()
const goBack = jest.fn()

function notice(id: string, title: string, publishedAt: string, kind: NoticeKind = 'app'): Notice {
  return { id, kind, title, body: `${id} 본문`, publishedAt }
}

beforeEach(() => {
  jest.clearAllMocks()
  __resetToastsForTest()
  notices.mockResolvedValue([])
  serveNotices({})
  jest.mocked(useSettingsNavigation).mockReturnValue({ navigate, goBack } as never)
})

/** 스켈레톤은 스스로 숨는 장식이라 숨은 요소까지 훑어야 보인다. */
const HIDDEN = { includeHiddenElements: true } as const

// 더보기와 같은 버그가 이 화면에도 있었다. 상태 초깃값이 빈 배열이라, 받아 보기도 전에
// `아직 받은 진행 중인 이벤트가 없습니다` 를 세우고 그다음에 카드가 들어왔다.
describe('조회 중', () => {
  /** 영원히 받는 중. 진입 조회가 안 끝나면 화면은 계속 모르는 상태다. */
  function neverSettles(): void {
    refresh.mockReturnValue(new Promise(() => {}))
  }

  it('배너 갈래는 카드 모양 스켈레톤이 선다', async () => {
    neverSettles()

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['event'], title: '진행 중인 이벤트' } }} />,
    )

    expect(view.getAllByTestId('notice-card-skeleton', HIDDEN).length).toBeGreaterThan(0)
    expect(view.queryByText('아직 받은 진행 중인 이벤트가 없습니다')).toBeNull()
  })

  it('글 갈래는 줄 모양 스켈레톤이 선다', async () => {
    neverSettles()

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '공지 사항' } }} />,
    )

    expect(view.getByTestId('notice-lines-skeleton', HIDDEN)).toBeTruthy()
    expect(view.queryByText('아직 받은 공지 사항이 없습니다')).toBeNull()
  })

  // 보여줄 것이 있으면 기다리게 하지 않는다.
  it('사본에 글이 있으면 스켈레톤을 건너뛴다', async () => {
    neverSettles()
    notices.mockResolvedValue([notice('c-1', '사본 제목', '2026-09-15T00:00:00.000Z', 'game')])

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '공지 사항' } }} />,
    )

    await waitFor(() => expect(view.getByText('사본 제목')).toBeTruthy())
    expect(view.queryByTestId('notice-lines-skeleton', HIDDEN)).toBeNull()
  })

  // 실패한 갈래는 `onReceived` 를 안 부른다. 그 마무리가 없으면 영영 스켈레톤으로 남는다.
  it('조회가 전부 실패해도 스켈레톤은 안 남는다', async () => {
    serveNotices({})

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['event'], title: '진행 중인 이벤트' } }} />,
    )

    await waitFor(() => expect(view.getByText('아직 받은 진행 중인 이벤트가 없습니다')).toBeTruthy())
    expect(view.queryAllByTestId('notice-card-skeleton', HIDDEN)).toHaveLength(0)
  })
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

    const view = await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '공지 사항' } }} />)

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
    await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '공지 사항' } }} />)

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(refresh.mock.calls[0][0]).toEqual(['game'])
  })

  // 기준(서버 · 넥슨 목록)에서 내린 글이 목록에 남던 자리. 사본을 바꾸는 일은 받는 쪽이 한다.
  it('성공하면 받은 목록을 그린다', async () => {
    const 남은것 = notice('kept', '남은 공지', '2026-09-01T00:00:00Z')
    notices.mockResolvedValue([notice('deleted', '지운 공지', '2026-09-05T00:00:00Z'), 남은것])
    serveNotices({ app: [남은것] })

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )

    await waitFor(() => expect(view.queryByText('지운 공지')).toBeNull())
    expect(view.getByText('남은 공지')).toBeTruthy()
  })

  it('빈 목록을 받으면 빈 상태를 그린다', async () => {
    notices.mockResolvedValue([notice('deleted', '지운 공지', '2026-09-05T00:00:00Z')])
    serveNotices({ app: [] })

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
    serveNotices({ game: [notice('game-new', '받은 게임 공지', '2026-09-09T00:00:00Z', 'game')] })

    const view = await renderOverlay(<SettingsNoticesScreen />)

    await waitFor(() => expect(view.getByText('받은 게임 공지')).toBeTruthy())
    expect([...refresh.mock.calls[0][0]].sort()).toEqual(['app', 'cashshop', 'event', 'game', 'update'])
    expect(view.queryByText('게임 공지 사본')).toBeNull()
    expect(view.getAllByTestId('notice-row').map((row) => row.props.accessibilityLabel)).toEqual([
      '받은 게임 공지',
      '앱 공지 사본',
    ])
  })
})

// 이 화면도 소식을 받고는 머무는 동안 다시 받을 길이 없었다. 더보기와 같은 이유로 당김이 선다.
// 인디케이터 조립은 `ScreenScroll` 이 지고, 화면이 지는 것은 무엇을 부르는가 와 실패를 말하는가 다.
describe('당겨서 새로고침', () => {
  async function pull(view: { getByTestId: (id: string) => AtomElement }): Promise<void> {
    await act(async () => {
      view.getByTestId('screen-scroll').props.refreshControl.props.onRefresh()
    })
  }

  it('당기면 보고 있는 갈래만 다시 받는다', async () => {
    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['event'], title: '진행 중인 이벤트' } }} />,
    )
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))

    await pull(view)

    expect(refresh).toHaveBeenCalledTimes(2)
    expect(refresh.mock.calls[1][0]).toEqual(['event'])
  })

  it('당겨서 받은 것을 그린다', async () => {
    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    serveNotices({ app: [notice('app-new', '방금 올라온 공지', '2026-09-16T00:00:00Z')] })

    await pull(view)

    expect(view.getByText('방금 올라온 공지')).toBeTruthy()
  })

  // 당김은 사용자가 요청한 조회다. 아무 일도 안 일어나면 고장으로 읽힌다.
  it('전부 실패하면 토스트로 말한다', async () => {
    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))

    await pull(view)

    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(['소식을 불러오지 못했습니다'])
  })

  it('받으면 조용하다', async () => {
    serveNotices({ app: [notice('app-1', '공지', '2026-09-16T00:00:00Z')] })
    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))

    await pull(view)

    expect(useToastStore.getState().toasts).toEqual([])
  })

  // 진입 조회는 사용자가 부탁한 적이 없다. 실패를 말하는 것은 당김뿐이다.
  it('진입 조회가 실패해도 토스트는 없다', async () => {
    await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />)

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(useToastStore.getState().toasts).toEqual([])
  })
})
