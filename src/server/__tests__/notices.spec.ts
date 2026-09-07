// 우리 서버를 격리하는 어댑터. `nexon/` 이 넥슨 API 에 하는 것과 같은 자리다.
//
// 여기가 지키는 것은 **화면이 네트워크를 안 보는 것**이다. 실패가 어떤 모양이든 화면은
// `null` 이나 빈 배열을 받고, 그러면 로컬에 쌓인 것만 그린다. 서버가 죽어도 앱이 산다.
import { fetchNotice, fetchNotices } from '../notices'

const 응답 = {
  items: [
    { id: 'a', title: '점검', body: '본문', publishedAt: '2026-09-08T00:00:00.000Z' },
  ],
  nextCursor: null,
}

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('목록', () => {
  it('받은 것을 그대로 준다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(ok(응답))

    await expect(fetchNotices()).resolves.toEqual(응답.items)
  })

  it('우리 서버의 주소로 부른다', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(ok(응답))

    await fetchNotices()

    expect(String(spy.mock.calls[0][0])).toContain('mapleroutine.store/v1/notices')
  })

  // 서버가 죽어도 앱은 돈다. 화면은 로컬에 쌓인 것을 그리면 된다.
  it('네트워크가 실패하면 빈 배열', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))

    await expect(fetchNotices()).resolves.toEqual([])
  })

  it('5xx 도 빈 배열', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 502 } as Response)

    await expect(fetchNotices()).resolves.toEqual([])
  })

  // 서버가 계약을 어겼을 때 화면까지 흘러가면 빈 칸이 그려진다. 여기서 거른다.
  it('모양이 안 맞는 항목은 버린다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      ok({ items: [{ id: 'a' }, 응답.items[0]], nextCursor: null }),
    )

    const got = await fetchNotices()
    expect(got).toHaveLength(1)
    expect(got[0].id).toBe('a')
  })

  it('items 가 배열이 아니면 빈 배열', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(ok({ items: '이상함' }))

    await expect(fetchNotices()).resolves.toEqual([])
  })
})

describe('상세', () => {
  it('받은 것을 준다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(ok(응답.items[0]))

    await expect(fetchNotice('a')).resolves.toEqual(응답.items[0])
  })

  it('id 를 주소에 넣는다', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(ok(응답.items[0]))

    await fetchNotice('공백 있는 id')

    // 인코딩을 안 하면 공백이 주소를 깬다.
    expect(String(spy.mock.calls[0][0])).toContain(encodeURIComponent('공백 있는 id'))
  })

  it('404 면 null', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response)

    await expect(fetchNotice('없다')).resolves.toBeNull()
  })

  it('네트워크 실패도 null', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))

    await expect(fetchNotice('a')).resolves.toBeNull()
  })
})
