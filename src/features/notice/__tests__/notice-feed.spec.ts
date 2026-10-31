// 소식 목록 · 상세를 어디서 받는가.
//
// ① 앱 공지는 우리 서버, 넥슨 네 분류는 넥슨 Open API 다. ② 받기에 실패하면 던지지 않고 null 이다. 목록 쿼리(`notice-query.ts`)가
// 그 null 을 보고 든 값을 지킨다. 겹친 호출을 하나로 접는 것과 캐시는 쿼리의 일이라 여기서는 안 본다.
import { fetchNexonNotice, fetchNexonNoticeList } from '../../../nexon/notice/client'
import { NexonAuthError } from '../../../nexon/errors'
import { fetchNotice, fetchNotices } from '../../../server/notices'
import { getAuthConfig } from '../../../storage/api-key'
import type { Notice, NoticeKind } from '../../../types/notice'
import { fetchNoticeDetail, receiveNoticeKind } from '../notice-feed'
import type { NexonCredential } from '../../../types/auth'

/** 넥슨에 넘기는 자격. 지금은 API 키 한 종류뿐이다. */
const 자격 = (value: string): NexonCredential => ({ type: 'key', value, accountId: 'account-key' })

jest.mock('../../../nexon/notice/client', () => ({
  __esModule: true,
  ...jest.requireActual('../../../nexon/notice/client'),
  fetchNexonNoticeList: jest.fn(),
  fetchNexonNotice: jest.fn(),
}))
jest.mock('../../../server/notices', () => ({ __esModule: true, fetchNotices: jest.fn(), fetchNotice: jest.fn() }))
jest.mock('../../../storage/api-key', () => ({ __esModule: true, getAuthConfig: jest.fn() }))

const nexonList = jest.mocked(fetchNexonNoticeList)
const nexonDetail = jest.mocked(fetchNexonNotice)
const serverList = jest.mocked(fetchNotices)
const serverDetail = jest.mocked(fetchNotice)
const auth = jest.mocked(getAuthConfig)

function notice(id: string, kind: NoticeKind): Notice {
  return { id, kind, title: id, body: '', publishedAt: '2026-09-15T00:00:00.000Z' }
}

beforeEach(() => {
  jest.clearAllMocks()
  auth.mockResolvedValue({ login: null, apiKeys: [{ type: 'key', id: 'account-key', label: '', value: 'key' }] })
})

describe('receiveNoticeKind', () => {
  // 분류 없이 20건을 받으면 넥슨 공지가 몰린 날 앱 공지가 그 밖으로 밀린다.
  it('앱 공지는 서버에서 앱 분류만 20건 받는다', async () => {
    serverList.mockResolvedValueOnce([notice('notice-1', 'app')])

    await expect(receiveNoticeKind('app')).resolves.toEqual([notice('notice-1', 'app')])
    expect(serverList).toHaveBeenCalledWith(20, ['app'])
    expect(nexonList).not.toHaveBeenCalled()
  })

  it('넥슨 분류는 저장된 키로 넥슨 목록을 받는다', async () => {
    nexonList.mockResolvedValueOnce([notice('event-1', 'event')])

    await expect(receiveNoticeKind('event')).resolves.toEqual([notice('event-1', 'event')])
    expect(nexonList).toHaveBeenCalledWith(자격('key'), 'event')
    expect(serverList).not.toHaveBeenCalled()
  })

  // 키 오류 모달은 동기화가 띄운다. 더보기에 들어올 때마다 부르므로 여기서 띄우면 탭을 오갈 때마다 뜬다.
  it('넥슨 실패는 던지지 않고 null 이다', async () => {
    nexonList.mockRejectedValueOnce(new NexonAuthError('무효'))

    await expect(receiveNoticeKind('game')).resolves.toBeNull()
  })

  it('서버 실패도 null 이다', async () => {
    serverList.mockResolvedValueOnce(null)

    await expect(receiveNoticeKind('app')).resolves.toBeNull()
  })

  it('키가 없으면 넥슨을 부르지 않는다', async () => {
    auth.mockResolvedValueOnce(null)

    await expect(receiveNoticeKind('update')).resolves.toBeNull()
    expect(nexonList).not.toHaveBeenCalled()
  })

  // 빈 배열은 실패가 아니라 지금 게시 중인 글이 없다는 답이다. null 로 바꾸면 쿼리가 실패로 읽어 옛 목록을 지킨다.
  it('빈 목록은 실패가 아니라 빈 배열이다', async () => {
    nexonList.mockResolvedValueOnce([])

    await expect(receiveNoticeKind('cashshop')).resolves.toEqual([])
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

  // 없다로 읽으면 캐시에서 멀쩡한 공지가 빠진다.
  it('키가 없으면 넥슨 상세는 실패다', async () => {
    auth.mockResolvedValueOnce(null)

    await expect(fetchNoticeDetail('event-1')).resolves.toEqual({ status: 'failed' })
  })
})
