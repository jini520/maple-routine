// 우리 서버를 격리하는 어댑터. `nexon/` 이 넥슨 API 에 하는 것과 같은 자리다.
//
// 여기가 지키는 것은 **화면이 네트워크를 안 보는 것**이다. 실패가 어떤 모양이든 화면은 실패 하나를
// 받고 사본을 그린다. 그리고 **실패와 빈 응답을 가른다.** 빈 응답은 사본을 비우고 실패는 사본을
// 안 건드리므로, 둘이 같은 값으로 오면 서버가 죽은 날 사본이 지워진다.
import { fetchNotice, fetchNotices } from '../notices'

const 응답 = {
  items: [
    { id: 'a', kind: 'game', title: '점검', body: '본문', publishedAt: '2026-09-08T00:00:00.000Z' },
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

  // 서버가 죽어도 앱은 돈다. 화면은 사본을 그리면 된다.
  it('네트워크가 실패하면 null', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))

    await expect(fetchNotices()).resolves.toBeNull()
  })

  it('5xx 도 null', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 502 } as Response)

    await expect(fetchNotices()).resolves.toBeNull()
  })

  // 서버에 공지가 없다는 답이다. 실패와 같은 값으로 내면 사본을 비울 수 없다.
  it('빈 items 는 빈 배열', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(ok({ items: [], nextCursor: null }))

    await expect(fetchNotices()).resolves.toEqual([])
  })

  // 서버가 계약을 어겼을 때 화면까지 흘러가면 빈 칸이 그려진다. 여기서 거른다.
  it('모양이 안 맞는 항목은 버린다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      ok({ items: [{ id: 'a' }, 응답.items[0]], nextCursor: null }),
    )

    const got = await fetchNotices()
    expect(got).toHaveLength(1)
    expect(got?.[0]?.id).toBe('a')
  })

  // 계약을 어긴 응답을 성공으로 읽으면 서버 버그 하나가 사본을 전부 지운다.
  it('items 가 배열이 아니면 null', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(ok({ items: '이상함' }))

    await expect(fetchNotices()).resolves.toBeNull()
  })

  it('본문이 JSON 이 아니면 null', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    } as unknown as Response)

    await expect(fetchNotices()).resolves.toBeNull()
  })
})

describe('계약을 어긴 응답', () => {
  // 서버가 분류를 안 실어 보내던 시절이 있다. 그때 것도 화면이 서야 한다.
  it('분류가 없으면 앱 공지로 읽는다', async () => {
    const 옛것 = { id: 'a', title: '점검', body: '본문', publishedAt: '2026-09-08T00:00:00.000Z' }
    jest.spyOn(global, 'fetch').mockResolvedValue(ok({ items: [옛것], nextCursor: null }))

    await expect(fetchNotices()).resolves.toEqual([{ ...옛것, kind: 'app' }])
  })

  // 모르는 블록을 그리는 코드가 없어서 그대로 두면 빈 칸이 난다. 그 조각만 버린다.
  it('모르는 블록은 버리고 아는 것만 남긴다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      ok({
        ...응답.items[0],
        blocks: [
          { type: 'text', text: '본문' },
          { type: '아직없는것', text: '뭔가' },
          { type: 'image', src: 'https://x.test/a.png' },
        ],
      }),
    )

    await expect(fetchNotice('a')).resolves.toMatchObject({
      status: 'found',
      notice: {
        blocks: [
          { type: 'text', text: '본문' },
          { type: 'image', src: 'https://x.test/a.png' },
        ],
      },
    })
  })

  it('분류를 주면 주소에 싣는다', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(ok(응답))

    await fetchNotices(20, ['update', 'event'])

    expect(String(spy.mock.calls[0][0])).toContain('kind=update,event')
  })
})

describe('상세', () => {
  it('받은 것을 준다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(ok(응답.items[0]))

    await expect(fetchNotice('a')).resolves.toEqual({ status: 'found', notice: 응답.items[0] })
  })

  it('id 를 주소에 넣는다', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(ok(응답.items[0]))

    await fetchNotice('공백 있는 id')

    // 인코딩을 안 하면 공백이 주소를 깬다.
    expect(String(spy.mock.calls[0][0])).toContain(encodeURIComponent('공백 있는 id'))
  })

  // 서버가 그 id 를 없다고 답했다. 실패와 가르지 않으면 지운 공지가 사본에서 안 빠진다.
  it('404 면 없다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response)

    await expect(fetchNotice('없다')).resolves.toEqual({ status: 'missing' })
  })

  it('네트워크 실패는 실패', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))

    await expect(fetchNotice('a')).resolves.toEqual({ status: 'failed' })
  })

  it('5xx 는 실패', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 502 } as Response)

    await expect(fetchNotice('a')).resolves.toEqual({ status: 'failed' })
  })

  // 200 인데 계약을 어긴 본문은 없다는 답이 아니다. 없다로 읽으면 사본에서 멀쩡한 공지가 빠진다.
  it('200 인데 모양이 안 맞으면 실패', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(ok({ id: 'a' }))

    await expect(fetchNotice('a')).resolves.toEqual({ status: 'failed' })
  })
})
