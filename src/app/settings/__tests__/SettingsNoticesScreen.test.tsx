// 이 화면이 지키는 것.
//
// ① 스위치가 설정 본화면이 아니라 여기 있다. 목록과 함께 서야 사용자가 무엇을 켜는지 안다.
// ② 목록은 쿼리 캐시에서 온다. 분류가 하나면 캐시가 준 순서 그대로 그리고, 여럿이면 최근 발행순으로 섞는다.
// ③ 행을 누르면 상세로 밀되 **`noticeId` 만** 넘긴다. 본문을 넘기면 알림에서 온 경로와
//    목록에서 온 경로가 서로 다른 내용을 그릴 수 있다.
import { act, fireEvent, within } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { refreshNoticeKinds, useNotices, type NoticesByKind } from '../../../features/notice/notice-query'
import { queryKeys } from '../../../features/query/keys'
import { __resetToastsForTest, useToastStore } from '../../../features/toast/store'
import { useRefetchStaleOnFocus } from '../../../hooks/useRefetchStaleOnFocus'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'
import { SettingsNoticesScreen } from '../SettingsNoticesScreen'
import type { Notice, NoticeKind } from '../../../types/notice'

// 소식은 쿼리 캐시에 든 목록을 그린다. 쿼리가 받고 실패에 든 값을 지키는 것은 `notice-query.spec` 이 본다.
jest.mock('../../../features/notice/notice-query', () => ({
  __esModule: true,
  useNotices: jest.fn(),
  refreshNoticeKinds: jest.fn(),
}))
// 들어올 때 만료된 쿼리를 받는 훅. 쿼리 클라이언트 없이 그리므로 어느 열쇠로 불렸는지만 본다.
jest.mock('../../../hooks/useRefetchStaleOnFocus', () => ({ __esModule: true, useRefetchStaleOnFocus: jest.fn() }))
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: jest.fn(),
}))

const cache = jest.mocked(useNotices)
const refresh = jest.mocked(refreshNoticeKinds)
const navigate = jest.fn()
const goBack = jest.fn()

/** 쿼리 캐시에 든 목록. 적지 않은 갈래는 `missing` 이다. `null` 은 아직 모른다, 빈 배열은 받아 봤는데 없다. */
function cacheNotices(byKind: Partial<Record<NoticeKind, Notice[] | null>>, missing: Notice[] | null = []): void {
  cache.mockImplementation(
    (kinds) =>
      Object.fromEntries(
        kinds.map((kind) => [kind, kind in byKind ? (byKind[kind] as Notice[] | null) : missing]),
      ) as NoticesByKind,
  )
}

function notice(id: string, title: string, publishedAt: string, kind: NoticeKind = 'app'): Notice {
  return { id, kind, title, body: `${id} 본문`, publishedAt }
}

beforeEach(() => {
  jest.clearAllMocks()
  __resetToastsForTest()
  cacheNotices({})
  refresh.mockResolvedValue({ allFailed: false })
  jest.mocked(useSettingsNavigation).mockReturnValue({ navigate, goBack } as never)
})

/** 스켈레톤은 스스로 숨는 장식이라 숨은 요소까지 훑어야 보인다. */
const HIDDEN = { includeHiddenElements: true } as const

// 더보기와 같은 버그가 이 화면에도 있었다. 받아 보기도 전에 `아직 받은 진행 중인 이벤트가 없습니다` 를
// 세우고 그다음에 카드가 들어왔다. 캐시가 `null`(아직 모른다)인 동안은 스켈레톤이다.
describe('조회 중', () => {
  it('배너 갈래는 카드 모양 스켈레톤이 선다', async () => {
    cacheNotices({}, null)

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['event'], title: '진행 중인 이벤트' } }} />,
    )

    expect(view.getAllByTestId('notice-card-skeleton', HIDDEN).length).toBeGreaterThan(0)
    expect(view.queryByText('아직 받은 진행 중인 이벤트가 없습니다')).toBeNull()
  })

  it('글 갈래는 줄 모양 스켈레톤이 선다', async () => {
    cacheNotices({}, null)

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '공지 사항' } }} />,
    )

    expect(view.getByTestId('notice-lines-skeleton', HIDDEN)).toBeTruthy()
    expect(view.queryByText('아직 받은 공지 사항이 없습니다')).toBeNull()
  })

  // 보여줄 것이 있으면 기다리게 하지 않는다. 다섯을 볼 때 한 분류라도 알면 그것을 그린다.
  it('한 분류라도 알면 스켈레톤 대신 그 목록을 그린다', async () => {
    cacheNotices({ game: [notice('c-1', '아는 공지', '2026-09-15T00:00:00.000Z', 'game')] }, null)

    const view = await renderOverlay(<SettingsNoticesScreen />)

    expect(view.getByText('아는 공지')).toBeTruthy()
    expect(view.queryByTestId('notice-lines-skeleton', HIDDEN)).toBeNull()
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

    expect([...cache.mock.calls[0][0]].sort()).toEqual(['app', 'cashshop', 'event', 'game', 'update'])
    expect(view.getByText('아직 받은 소식이 없습니다')).toBeTruthy()
  })

  // 한 목록에 다 담으면 점검 안내와 캐시아이템이 섞인다.
  it('준 분류만 본다', async () => {
    cacheNotices({
      game: [notice('game-1', '점검 안내', '2026-09-09T00:00:00Z', 'game')],
      cashshop: [notice('cashshop-1', '캐시 업데이트', '2026-09-08T00:00:00Z', 'cashshop')],
    })

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '공지사항' } }} />,
    )

    expect(cache).toHaveBeenCalledWith(['game'])
    expect(view.getByText('점검 안내')).toBeTruthy()
    expect(view.queryByText('캐시 업데이트')).toBeNull()
  })

  // 날짜를 일부러 뒤섞어 둔다. 화면이 날짜로 다시 정렬하면 어느 방향이든 순서가 달라진다.
  it('분류가 하나면 캐시가 준 순서를 그대로 그린다', async () => {
    cacheNotices({
      app: [
        notice('b', '가운데 공지', '2026-09-03T00:00:00Z'),
        notice('c', '나중 공지', '2026-09-05T00:00:00Z'),
        notice('a', '먼저 공지', '2026-09-01T00:00:00Z'),
      ],
    })

    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )

    const titles = view
      .getAllByTestId('notice-row')
      .map((row) => within(row).getByText(/공지$/).props.children)
    expect(titles).toEqual(['가운데 공지', '나중 공지', '먼저 공지'])
  })

  // 분류가 여럿이면 캐시마다 순서가 따로라, 섞은 목록은 최근 발행순이다.
  it('분류가 여럿이면 최근 발행순으로 섞는다', async () => {
    cacheNotices({
      app: [notice('app-old', '앱 공지', '2026-09-02T00:00:00Z')],
      game: [notice('game-new', '게임 공지', '2026-09-09T00:00:00Z', 'game')],
    })

    const view = await renderOverlay(<SettingsNoticesScreen />)

    expect(view.getAllByTestId('notice-row').map((row) => row.props.accessibilityLabel)).toEqual([
      '게임 공지',
      '앱 공지',
    ])
  })

  it('누르면 noticeId 만 넘겨 상세로 민다', async () => {
    cacheNotices({ app: [notice('a', '점검 안내', '2026-09-01T00:00:00Z')] })
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
    cacheNotices({ [kind]: [notice(`${kind}-1`, '배너 공지', '2026-09-10T00:00:00Z', kind)] })

    const view = await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: [kind], title } }} />)

    expect(view.getAllByTestId('notice-banner-card')).toHaveLength(1)
    expect(view.queryByTestId('notice-row')).toBeNull()
  })

  it('글 공지는 제목을 자르지 않는 글 줄이다', async () => {
    cacheNotices({ game: [notice('game-1', '아주 긴 게임 공지 제목', '2026-09-10T00:00:00Z', 'game')] })

    const view = await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '공지 사항' } }} />)

    expect(view.getByText('아주 긴 게임 공지 제목').props.numberOfLines).toBeUndefined()
    expect(view.queryByTestId('notice-banner-card')).toBeNull()
  })

  // 조사를 `이` 로 고정하면 `아직 받은 업데이트이 없습니다` 가 된다.
  it('빈 문구의 조사를 이름에 맞춘다', async () => {
    const view = await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: ['update'], title: '업데이트' } }} />)

    expect(view.getByText('아직 받은 업데이트가 없습니다')).toBeTruthy()
  })
})

// 들어올 때마다 만료된 쿼리를 받는다. 당김과 달리 사용자가 부탁한 조회가 아니라 실패를 말하지 않는다.
describe('받기', () => {
  it('들어오면 만료된 공지 쿼리를 다시 받고, 당김용 조회는 부르지 않는다', async () => {
    await renderOverlay(<SettingsNoticesScreen route={{ params: { kinds: ['game'], title: '공지 사항' } }} />)

    expect(useRefetchStaleOnFocus).toHaveBeenCalledWith(queryKeys.allNotices())
    expect(refresh).not.toHaveBeenCalled()
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

    await pull(view)

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh.mock.calls[0][0]).toEqual(['event'])
  })

  // 당김은 사용자가 요청한 조회다. 아무 일도 안 일어나면 고장으로 읽힌다.
  it('전부 실패하면 토스트로 말한다', async () => {
    refresh.mockResolvedValue({ allFailed: true })
    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )

    await pull(view)

    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(['소식을 불러오지 못했습니다'])
  })

  // 키가 없으면 넥슨 네 갈래가 언제나 실패다. 그때마다 말하면 앱 공지를 제대로 받고도 토스트가 뜬다.
  it('하나라도 받으면 조용하다', async () => {
    const view = await renderOverlay(
      <SettingsNoticesScreen route={{ params: { kinds: ['app'], title: '앱 공지사항' } }} />,
    )

    await pull(view)

    expect(useToastStore.getState().toasts).toEqual([])
  })
})
