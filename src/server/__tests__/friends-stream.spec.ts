// 서버가 흘리는 NDJSON 을 줄로 모은다. 여기서 막는 사고는 청크 경계에서 줄이 갈라지는 것과,
// 하트비트 빈 줄을 줄로 세는 것이다.
import { FriendsStreamRejected, streamFriends } from '../friends-stream'

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }))

const { fetch: expoFetch } = jest.requireMock('expo/fetch') as Record<string, jest.Mock>

function 응답(status: number, chunks: string[]) {
  const encoder = new TextEncoder()
  const queue = chunks.map((c) => encoder.encode(c))
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader: () => ({
        read: async () => {
          const value = queue.shift()
          return value === undefined ? { done: true, value: undefined } : { done: false, value }
        },
      }),
    },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

it('세션을 Bearer 로 싣고 작업 목록을 JSON 으로 보낸다', async () => {
  expoFetch.mockResolvedValue(응답(200, ['{"t":"end","reason":"done"}\n']))

  await streamFriends('세션', [{ kind: 'character-list' }])

  const [url, init] = expoFetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('https://mapleroutine.store/v1/friends/stream')
  expect(init.method).toBe('POST')
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer 세션')
  expect(JSON.parse(init.body as string)).toEqual({ tasks: [{ kind: 'character-list' }] })
})

it('청크 경계에서 갈라진 줄을 잇고 빈 줄은 버린다', async () => {
  expoFetch.mockResolvedValue(
    응답(200, [
      '{"t":"page","kind":"character-list","n":1,"bo',
      'dy":{"a":1}}\n\n{"t":"done","kind":"character-list","pages":1}\n',
      '{"t":"end","reason":"done"}',
    ]),
  )

  const lines = await streamFriends('세션', [{ kind: 'character-list' }])

  expect(lines).toEqual([
    { t: 'page', kind: 'character-list', n: 1, body: { a: 1 } },
    { t: 'done', kind: 'character-list', pages: 1 },
    { t: 'end', reason: 'done' },
  ])
})

it('JSON 이 아닌 줄은 버린다', async () => {
  expoFetch.mockResolvedValue(응답(200, ['garbage\n{"t":"end","reason":"done"}\n']))

  await expect(streamFriends('세션', [])).resolves.toEqual([{ t: 'end', reason: 'done' }])
})

it('서버가 거절하면 status 를 든 에러를 던진다', async () => {
  expoFetch.mockResolvedValue(응답(401, []))

  await expect(streamFriends('세션', [])).rejects.toMatchObject({ status: 401 })
  await expect(streamFriends('세션', [])).rejects.toBeInstanceOf(FriendsStreamRejected)
})

it('닿지 못하면 fetch 의 실패를 그대로 올린다', async () => {
  expoFetch.mockRejectedValue(new Error('offline'))

  await expect(streamFriends('세션', [])).rejects.toThrow('offline')
})
