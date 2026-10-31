import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

jest.mock('../notice-feed', () => ({ receiveNoticeKind: jest.fn() }))
jest.mock('../../../storage/notice-banner', () => ({
  keepDismissedNotices: jest.fn(async () => undefined),
  getDismissedNoticeIds: jest.fn(async () => []),
  dismissNotice: jest.fn(async () => undefined),
  forgetDismissedNotice: jest.fn(async () => undefined),
}))

import type { Notice } from '../../../types/notice'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import { resetNoticeDismissalForTests } from '../banner-dismissal'
import { findCachedNotice, forgetNotice, noticesOptions, refreshNoticeKinds, useNoticeBanner, useNotices } from '../notice-query'

const { receiveNoticeKind: receiveMock } = jest.requireMock('../notice-feed') as Record<string, jest.Mock>
const { keepDismissedNotices: keepMock, getDismissedNoticeIds: dismissedMock } = jest.requireMock(
  '../../../storage/notice-banner',
) as Record<string, jest.Mock>

function notice(id: string, kind: Notice['kind'] = 'app', publishedAt = '2026-10-31T00:00:00.000Z'): Notice {
  return { id, kind, title: id, body: '', publishedAt }
}

const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  queryClient.clear()
  resetNoticeDismissalForTests()
  jest.clearAllMocks()
  dismissedMock.mockResolvedValue([])
  receiveMock.mockImplementation(async (kind: string) => [notice(`${kind}-1`, kind as Notice['kind'])])
})

it('분류마다 열쇠이고, 기기에 저장되며, 진입과 복귀마다 받는다', () => {
  const options = noticesOptions('event')
  expect(options.queryKey).toEqual(queryKeys.notices('event'))
  expect(options.meta).toEqual({ persist: true, source: 'server' })
  expect(options.staleTime).toBe(0)
  expect(options.refetchOnWindowFocus).toBe('always')
})

// 실패를 데이터로 넣으면 있던 목록이 사라진다. 던져야 쿼리가 든 값을 지킨다.
it('받기에 실패하면 든 값을 지킨다', async () => {
  await queryClient.fetchQuery(noticesOptions('game'))
  receiveMock.mockResolvedValue(null)

  await expect(queryClient.fetchQuery({ ...noticesOptions('game'), staleTime: 0 })).rejects.toThrow()

  expect(queryClient.getQueryData(queryKeys.notices('game'))).toEqual([notice('game-1', 'game')])
})

// 닫은 기록은 앱 공지 id 만 든다. 게임 공지 응답으로 정리하면 닫아 둔 배너가 전부 되살아난다.
it('앱 공지를 받은 자리에서만 닫은 기록을 정리한다', async () => {
  await queryClient.fetchQuery(noticesOptions('game'))
  expect(keepMock).not.toHaveBeenCalled()

  await queryClient.fetchQuery(noticesOptions('app'))
  expect(keepMock).toHaveBeenCalledWith(['app-1'])
})

describe('refreshNoticeKinds', () => {
  it('신선해도 다시 받고, 전부 실패했을 때만 그렇게 말한다', async () => {
    await queryClient.fetchQuery(noticesOptions('app'))
    receiveMock.mockImplementation(async (kind: string) => (kind === 'app' ? [notice('app-2')] : null))

    const partial = await refreshNoticeKinds(['app', 'event'])
    expect(partial.allFailed).toBe(false)
    expect(queryClient.getQueryData(queryKeys.notices('app'))).toEqual([notice('app-2')])

    receiveMock.mockResolvedValue(null)
    const all = await refreshNoticeKinds(['app', 'event'])
    expect(all.allFailed).toBe(true)
  })
})

describe('useNotices', () => {
  it('첫 조회 중은 `null`, 받으면 목록, 실패했는데 든 값도 없으면 빈 배열이다', async () => {
    // 응답을 붙들어 둔다. 바로 끝나면 `renderHook` 을 기다리는 사이에 도착해 첫 조회 중을 볼 수 없다.
    let answer = (): void => undefined
    const answered = new Promise<void>((resolve) => {
      answer = resolve
    })
    receiveMock.mockImplementation(async (kind: string) => {
      await answered
      return kind === 'app' ? [notice('app-1')] : null
    })

    const { result } = await renderHook(() => useNotices(['app', 'event']), { wrapper })
    expect(result.current).toEqual({ app: null, event: null })

    answer()
    await waitFor(() => expect(result.current.app).toEqual([notice('app-1')]))
    await waitFor(() => expect(result.current.event).toEqual([]))
  })
})

describe('캐시 안의 공지 하나', () => {
  it('분류를 가리지 않고 id 로 찾고, 서버가 없다고 한 공지는 전 분류에서 뺀다', async () => {
    await queryClient.fetchQuery(noticesOptions('app'))
    await queryClient.fetchQuery(noticesOptions('event'))

    expect(findCachedNotice('event-1')).toEqual(notice('event-1', 'event'))
    expect(findCachedNotice('none')).toBeNull()

    await forgetNotice('event-1')
    expect(findCachedNotice('event-1')).toBeNull()
    expect(queryClient.getQueryData(queryKeys.notices('app'))).toEqual([notice('app-1')])
  })
})

describe('useNoticeBanner', () => {
  // 후보는 가장 최근 앱 공지 하나뿐이다. 그것을 닫으면 옛 공지가 올라오지 않고 자리가 빈다.
  it('가장 최근 앱 공지를 세우고, 닫으면 비운다', async () => {
    receiveMock.mockImplementation(async () => [notice('app-2', 'app', '2026-10-31T01:00:00.000Z'), notice('app-1')])

    const { result } = await renderHook(() => useNoticeBanner(), { wrapper })
    await waitFor(() => expect(result.current.notice?.id).toBe('app-2'))

    await result.current.dismiss()
    await waitFor(() => expect(result.current.notice).toBeNull())
  })

  it('기기에 닫은 기록이 있으면 처음부터 안 세운다', async () => {
    receiveMock.mockImplementation(async () => [notice('app-2', 'app', '2026-10-31T01:00:00.000Z')])
    dismissedMock.mockResolvedValue(['app-2'])

    const { result } = await renderHook(() => useNoticeBanner(), { wrapper })
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.notices('app'))).toBeDefined())

    expect(result.current.notice).toBeNull()
  })
})
