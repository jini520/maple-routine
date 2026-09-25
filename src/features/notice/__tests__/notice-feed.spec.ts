// 소식 목록 · 상세를 어디서 받는가.
//
// ① 앱 공지는 우리 서버, 넥슨 네 분류는 넥슨 Open API 다. ② 받기에 실패하면 사본을 안 건드린다(실패는 null).
// ③ 같은 분류를 받는 중에 또 부르면 새로 부르지 않는다. 더보기에 들어올 때마다 부르므로 탭을 오가면 겹친다.
import { fetchNexonNotice, fetchNexonNoticeList } from '../../../nexon/notice/client'
import { NexonAuthError } from '../../../nexon/errors'
import { fetchNotice, fetchNotices } from '../../../server/notices'
import { getAuthConfig } from '../../../storage/api-key'
import type { Notice, NoticeKind } from '../../../types/notice'
import { saveNoticeResponse } from '../notice-copy'
import { fetchNoticeDetail, groupNoticesByKind, refreshNoticeKind, refreshNoticeKinds } from '../notice-feed'
import type { NexonCredential } from '../../../types/auth'

/** 넥슨에 넘기는 자격. 지금은 API 키 한 종류뿐이다. */
const 자격 = (value: string): NexonCredential => ({ kind: 'apiKey', value })

jest.mock('../../../nexon/notice/client', () => ({
  __esModule: true,
  ...jest.requireActual('../../../nexon/notice/client'),
  fetchNexonNoticeList: jest.fn(),
  fetchNexonNotice: jest.fn(),
}))
jest.mock('../../../server/notices', () => ({ __esModule: true, fetchNotices: jest.fn(), fetchNotice: jest.fn() }))
jest.mock('../../../storage/api-key', () => ({ __esModule: true, getAuthConfig: jest.fn() }))
jest.mock('../notice-copy', () => ({ __esModule: true, saveNoticeResponse: jest.fn(async () => {}) }))

const nexonList = jest.mocked(fetchNexonNoticeList)
const nexonDetail = jest.mocked(fetchNexonNotice)
const serverList = jest.mocked(fetchNotices)
const serverDetail = jest.mocked(fetchNotice)
const auth = jest.mocked(getAuthConfig)
const save = jest.mocked(saveNoticeResponse)

function notice(id: string, kind: NoticeKind): Notice {
  return { id, kind, title: id, body: '', publishedAt: '2026-09-15T00:00:00.000Z' }
}

beforeEach(() => {
  jest.clearAllMocks()
  auth.mockResolvedValue({ apiKey: 'key' })
})

describe('refreshNoticeKind', () => {
  it('앱 공지는 서버에서 받아 사본을 바꾼다', async () => {
    serverList.mockResolvedValueOnce([notice('notice-1', 'app')])

    await expect(refreshNoticeKind('app')).resolves.toEqual([notice('notice-1', 'app')])
    expect(serverList).toHaveBeenCalledWith(20, ['app'])
    expect(nexonList).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledWith('app', [notice('notice-1', 'app')])
  })

  it('넥슨 분류는 저장된 키로 넥슨 목록을 받아 사본을 바꾼다', async () => {
    nexonList.mockResolvedValueOnce([notice('event-1', 'event')])

    await expect(refreshNoticeKind('event')).resolves.toEqual([notice('event-1', 'event')])
    expect(nexonList).toHaveBeenCalledWith(자격('key'), 'event')
    expect(serverList).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledWith('event', [notice('event-1', 'event')])
  })

  // 키 오류 모달은 동기화가 띄운다. 더보기에 들어올 때마다 부르므로 여기서 띄우면 탭을 오갈 때마다 뜬다.
  it('넥슨 실패는 던지지 않고 null 이고 사본을 안 건드린다', async () => {
    nexonList.mockRejectedValueOnce(new NexonAuthError('무효'))

    await expect(refreshNoticeKind('game')).resolves.toBeNull()
    expect(save).not.toHaveBeenCalled()
  })

  it('서버 실패도 null 이고 사본을 안 건드린다', async () => {
    serverList.mockResolvedValueOnce(null)

    await expect(refreshNoticeKind('app')).resolves.toBeNull()
    expect(save).not.toHaveBeenCalled()
  })

  it('키가 없으면 넥슨을 부르지 않는다', async () => {
    auth.mockResolvedValueOnce(null)

    await expect(refreshNoticeKind('update')).resolves.toBeNull()
    expect(nexonList).not.toHaveBeenCalled()
  })

  // 빈 배열은 실패가 아니라 지금 게시 중인 글이 없다는 답이다.
  it('빈 목록도 사본을 바꾼다', async () => {
    nexonList.mockResolvedValueOnce([])

    await expect(refreshNoticeKind('cashshop')).resolves.toEqual([])
    expect(save).toHaveBeenCalledWith('cashshop', [])
  })

  it('같은 분류를 받는 중에 또 부르면 그 조회를 기다린다', async () => {
    let resolve: (value: Notice[]) => void = () => {}
    nexonList.mockReturnValueOnce(new Promise((r) => (resolve = r)))

    const first = refreshNoticeKind('event')
    const second = refreshNoticeKind('event')
    resolve([notice('event-2', 'event')])

    await expect(Promise.all([first, second])).resolves.toEqual([
      [notice('event-2', 'event')],
      [notice('event-2', 'event')],
    ])
    expect(nexonList).toHaveBeenCalledTimes(1)

    // 끝난 뒤에는 다시 부른다.
    nexonList.mockResolvedValueOnce([])
    await refreshNoticeKind('event')
    expect(nexonList).toHaveBeenCalledTimes(2)
  })
})

// 진입 조회와 당김이 같이 쓰는 함수. 도착하는 대로 알리고, 전부 끝난 뒤에 판정을 낸다.
describe('refreshNoticeKinds', () => {
  it('준 갈래를 전부 부르고 도착하는 대로 알린다', async () => {
    serverList.mockResolvedValueOnce([notice('notice-1', 'app')])
    nexonList.mockResolvedValueOnce([notice('event-1', 'event')])
    const received = jest.fn()

    await refreshNoticeKinds(['app', 'event'], received)

    expect(received).toHaveBeenCalledWith('app', [notice('notice-1', 'app')])
    expect(received).toHaveBeenCalledWith('event', [notice('event-1', 'event')])
  })

  // 실패한 갈래는 사본이 그대로 서야 한다. 빈 배열로 알리면 화면이 그 갈래를 비운다.
  it('실패한 갈래는 알리지 않는다', async () => {
    serverList.mockResolvedValueOnce(null)
    nexonList.mockResolvedValueOnce([notice('event-1', 'event')])
    const received = jest.fn()

    await refreshNoticeKinds(['app', 'event'], received)

    expect(received).toHaveBeenCalledTimes(1)
    expect(received).toHaveBeenCalledWith('event', [notice('event-1', 'event')])
  })

  // 키가 없으면 넥슨 네 갈래가 전부 null 이다. 그때도 앱 공지를 받았으면 사용자에게 할 말이 없다.
  it('하나라도 성공하면 allFailed 가 거짓이다', async () => {
    serverList.mockResolvedValueOnce([notice('notice-1', 'app')])
    nexonList.mockRejectedValueOnce(new Error('망'))

    await expect(refreshNoticeKinds(['app', 'event'], jest.fn())).resolves.toEqual({ allFailed: false })
  })

  it('전부 실패하면 allFailed 가 참이다', async () => {
    serverList.mockResolvedValueOnce(null)
    nexonList.mockRejectedValueOnce(new Error('망'))

    await expect(refreshNoticeKinds(['app', 'event'], jest.fn())).resolves.toEqual({ allFailed: true })
  })

  // 빈 배열은 실패가 아니라 지금 게시 중인 글이 없다는 답이다.
  it('빈 목록만 받아도 실패가 아니다', async () => {
    nexonList.mockResolvedValueOnce([])
    const received = jest.fn()

    await expect(refreshNoticeKinds(['event'], received)).resolves.toEqual({ allFailed: false })
    expect(received).toHaveBeenCalledWith('event', [])
  })

  // 인디케이터가 이 약속에 매달린다. 먼저 끝난 갈래에서 닫으면 아직 도는 조회가 남은 채로 다 됐다고 말한다.
  it('갈래 하나라도 도는 동안은 안 끝난다', async () => {
    let resolveEvent: (value: Notice[]) => void = () => {}
    serverList.mockResolvedValueOnce([notice('notice-1', 'app')])
    nexonList.mockReturnValueOnce(new Promise((r) => (resolveEvent = r)))
    const done = jest.fn()

    const pending = refreshNoticeKinds(['app', 'event'], jest.fn())
    void pending.then(done)
    // 앱 공지는 이미 끝났다. 몇 바퀴를 돌려도 event 가 남아 있는 한 안 끝나야 한다.
    for (let i = 0; i < 10; i += 1) await Promise.resolve()
    expect(done).not.toHaveBeenCalled()

    resolveEvent([])
    await pending
    expect(done).toHaveBeenCalled()
  })
})

describe('fetchNoticeDetail', () => {
  it('넥슨 id 는 넥슨 상세를 부른다', async () => {
    nexonDetail.mockResolvedValueOnce({ status: 'missing' })

    await expect(fetchNoticeDetail('cashshop-1004')).resolves.toEqual({ status: 'missing' })
    expect(nexonDetail).toHaveBeenCalledWith(자격('key'), 'cashshop', 1004)
    expect(serverDetail).not.toHaveBeenCalled()
  })

  it('앱 공지 id 는 서버 상세를 부른다', async () => {
    serverDetail.mockResolvedValueOnce({ status: 'failed' })

    await expect(fetchNoticeDetail('notice-20260915-164132')).resolves.toEqual({ status: 'failed' })
    expect(serverDetail).toHaveBeenCalledWith('notice-20260915-164132')
    expect(nexonDetail).not.toHaveBeenCalled()
  })

  // 없다로 읽으면 사본에서 멀쩡한 공지가 빠진다.
  it('키가 없으면 넥슨 상세는 실패다', async () => {
    auth.mockResolvedValueOnce(null)

    await expect(fetchNoticeDetail('event-1')).resolves.toEqual({ status: 'failed' })
  })
})

describe('groupNoticesByKind', () => {
  it('분류마다 순서를 지켜 나눈다', () => {
    const grouped = groupNoticesByKind([notice('a', 'game'), notice('b', 'event'), notice('c', 'game')])

    expect(grouped.game.map((n) => n.id)).toEqual(['a', 'c'])
    expect(grouped.event.map((n) => n.id)).toEqual(['b'])
    expect(grouped.app).toEqual([])
  })
})
