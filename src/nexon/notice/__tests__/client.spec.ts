// 넥슨 공지 목록 · 상세를 앱의 `Notice` 로 옮기는 규칙.
//
// 목록 응답의 배열 키가 분류마다 다르고, 이벤트 · 캐시샵만 썸네일과 기간을 준다. 표본의 필드는 2026-09-15 실측 응답에서 잘라 왔다.
import { NexonBadRequestError, NexonNetworkError } from '../../errors'
import { requestJson } from '../../http'
import { fetchNexonNotice, fetchNexonNoticeList, nexonNoticeRef } from '../client'

jest.mock('../../http', () => ({ __esModule: true, requestJson: jest.fn() }))

const request = jest.mocked(requestJson)

beforeEach(() => {
  request.mockReset()
})

describe('fetchNexonNoticeList', () => {
  it('분류마다 다른 경로와 배열 키를 읽는다', async () => {
    request.mockResolvedValueOnce({ update_notice: [] })
    await fetchNexonNoticeList('key', 'update')
    expect(request).toHaveBeenCalledWith('/maplestory/v1/notice-update', 'key')

    request.mockResolvedValueOnce({ cashshop_notice: [] })
    await fetchNexonNoticeList('key', 'cashshop')
    expect(request).toHaveBeenLastCalledWith('/maplestory/v1/notice-cashshop', 'key')
  })

  // id 는 서버 사본과 같은 모양이어야 알림을 탭해도 같은 상세가 열린다.
  it('이벤트 항목을 `{분류}-{notice_id}` · ISO UTC · 썸네일 · 기간으로 옮긴다', async () => {
    request.mockResolvedValueOnce({
      event_notice: [
        {
          title: '넥슨 라이브 채널 오픈 기념 이벤트',
          url: 'https://maplestory.nexon.com/News/Event/1374',
          thumbnail_url: 'https://file.nexon.com/NxFile/download/FileDownloader.aspx?oidFile=1',
          notice_id: 1374,
          date: '2026-09-10T11:08+09:00',
          date_event_start: '2026-09-10T19:20+09:00',
          date_event_end: '2026-09-16T23:59+09:00',
        },
      ],
    })

    expect(await fetchNexonNoticeList('key', 'event')).toEqual([
      {
        id: 'event-1374',
        kind: 'event',
        title: '넥슨 라이브 채널 오픈 기념 이벤트',
        body: '',
        publishedAt: '2026-09-10T02:08:00.000Z',
        link: 'https://maplestory.nexon.com/News/Event/1374',
        thumbnailUrl: 'https://file.nexon.com/NxFile/download/FileDownloader.aspx?oidFile=1',
        startsAt: '2026-09-10T10:20:00.000Z',
        endsAt: '2026-09-16T14:59:00.000Z',
      },
    ])
  })

  // 상시 판매 상품은 기간이 null 이다. 빈 칸을 만들지 않고 필드를 뺀다.
  it('캐시샵 기간은 `date_sale_*` 이고 없으면 필드가 없다', async () => {
    request.mockResolvedValueOnce({
      cashshop_notice: [
        {
          title: '8월 20일 캐시아이템 업데이트 - 마스터라벨 플러스',
          url: 'https://maplestory.nexon.com/News/CashShop/Sale/1',
          thumbnail_url: 'https://file.nexon.com/a',
          notice_id: 1,
          date: '2026-08-20T08:14+09:00',
          date_sale_start: null,
          date_sale_end: null,
          ongoing_flag: 'true',
        },
        {
          title: '8월 20일 캐시아이템 업데이트 - 메이플스토리 보스 패키지',
          url: 'https://maplestory.nexon.com/News/CashShop/Sale/2',
          thumbnail_url: 'https://file.nexon.com/b',
          notice_id: 2,
          date: '2026-08-20T08:14+09:00',
          date_sale_start: '2026-08-20T10:00+09:00',
          date_sale_end: '2026-09-16T23:59+09:00',
          ongoing_flag: 'false',
        },
      ],
    })

    const [ongoing, limited] = await fetchNexonNoticeList('key', 'cashshop')
    expect(ongoing).not.toHaveProperty('startsAt')
    expect(ongoing).not.toHaveProperty('endsAt')
    expect(limited).toMatchObject({ startsAt: '2026-08-20T01:00:00.000Z', endsAt: '2026-09-16T14:59:00.000Z' })
  })

  it('게임 공지는 썸네일 · 기간이 없다', async () => {
    request.mockResolvedValueOnce({
      notice: [{ title: '9/17(목) 넥슨 정기점검 안내', url: 'https://x', notice_id: 149862, date: '2026-09-15T14:44+09:00' }],
    })

    const [notice] = await fetchNexonNoticeList('key', 'game')
    expect(notice).toEqual({
      id: 'game-149862',
      kind: 'game',
      title: '9/17(목) 넥슨 정기점검 안내',
      body: '',
      publishedAt: '2026-09-15T05:44:00.000Z',
      link: 'https://x',
    })
  })

  // 한 건을 버리는 편이 목록 전체를 버리는 것보다 낫다.
  it('id · 제목 · 날짜 중 하나라도 못 읽는 항목만 버린다', async () => {
    request.mockResolvedValueOnce({
      notice: [
        { title: '번호 없음', notice_id: null, date: '2026-09-15T14:44+09:00' },
        { title: 1, notice_id: 1, date: '2026-09-15T14:44+09:00' },
        { title: '날짜 깨짐', notice_id: 2, date: 'nope' },
        { title: '멀쩡함', notice_id: 3, date: '2026-09-15T14:44+09:00' },
      ],
    })

    expect((await fetchNexonNoticeList('key', 'game')).map((n) => n.id)).toEqual(['game-3'])
  })

  // 계약을 어긴 응답을 빈 목록으로 읽으면 넥슨 쪽 고장 하나가 기기의 사본을 지운다.
  it('배열 키가 없으면 빈 목록이 아니라 실패다', async () => {
    request.mockResolvedValueOnce({ something_else: [] })

    await expect(fetchNexonNoticeList('key', 'event')).rejects.toBeInstanceOf(NexonNetworkError)
  })
})

describe('nexonNoticeRef', () => {
  it('넥슨 분류와 번호를 읽는다', () => {
    expect(nexonNoticeRef('cashshop-1004')).toEqual({ kind: 'cashshop', noticeId: 1004 })
    expect(nexonNoticeRef('game-149862')).toEqual({ kind: 'game', noticeId: 149862 })
  })

  // 앱 공지 id 는 `notice-20260915-164132` 꼴이라 넥슨 상세로 가면 안 된다.
  it('앱 공지 · 모르는 모양은 null 이다', () => {
    expect(nexonNoticeRef('notice-20260915-164132')).toBeNull()
    expect(nexonNoticeRef('app-1')).toBeNull()
    expect(nexonNoticeRef('event-')).toBeNull()
    expect(nexonNoticeRef('event-12a')).toBeNull()
  })
})

describe('fetchNexonNotice', () => {
  it('상세 경로에 번호를 붙여 부르고 본문을 블록으로 바꾼다', async () => {
    request.mockResolvedValueOnce({
      title: '넥슨 라이브 채널 오픈 기념 이벤트',
      url: 'https://maplestory.nexon.com/News/Event/1374',
      contents: '<div><img src="https://lwi.nexon.com/a.png"></div>',
      date: '2026-09-10T11:08+09:00',
    })

    const lookup = await fetchNexonNotice('key', 'event', 1374)

    expect(request).toHaveBeenCalledWith('/maplestory/v1/notice-event/detail?notice_id=1374', 'key')
    expect(lookup).toEqual({
      status: 'found',
      notice: {
        id: 'event-1374',
        kind: 'event',
        title: '넥슨 라이브 채널 오픈 기념 이벤트',
        body: '',
        publishedAt: '2026-09-10T02:08:00.000Z',
        link: 'https://maplestory.nexon.com/News/Event/1374',
        blocks: [{ type: 'image', src: 'https://lwi.nexon.com/a.png' }],
      },
    })
  })

  // 넥슨은 목록에 지금 떠 있는 글만 상세를 준다. 내린 글의 답이 400 OPENAPI00004 다.
  it('400 OPENAPI00004 만 없다는 답이다', async () => {
    request.mockRejectedValueOnce(new NexonBadRequestError('거부', 'OPENAPI00004'))
    expect(await fetchNexonNotice('key', 'event', 1)).toEqual({ status: 'missing' })

    request.mockRejectedValueOnce(new NexonBadRequestError('거부', 'OPENAPI00005'))
    expect(await fetchNexonNotice('key', 'event', 1)).toEqual({ status: 'failed' })

    request.mockRejectedValueOnce(new NexonNetworkError('끊김'))
    expect(await fetchNexonNotice('key', 'event', 1)).toEqual({ status: 'failed' })
  })

  it('제목을 못 읽으면 실패다', async () => {
    request.mockResolvedValueOnce({ contents: '<p>본문</p>', date: '2026-09-10T11:08+09:00' })

    expect(await fetchNexonNotice('key', 'game', 1)).toEqual({ status: 'failed' })
  })
})
