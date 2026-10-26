import {
  isInvalidApiKeyError,
  NexonAuthError,
  NexonBadRequestError,
  NexonMaintenanceError,
  NexonNetworkError,
  NexonRateLimitError,
  NexonSignInRequiredError,
} from '../errors'
import { __setDeveloperKeysForTest } from '../developer-keys'
import { requestJson, setFriendsStreamForTest, setMaintenanceReporter } from '../http'
import type { StreamLine } from '../../server/friends-stream'
import type { NexonCredential } from '../../types/auth'

/** 넥슨에 넘기는 자격. 지금은 API 키 한 종류뿐이다. */
const 자격 = (value: string): NexonCredential => ({ type: 'key', value, accountId: null })

// 전역을 잠시 갈아 끼우는 도우미. 원래 값을 기억해 두고
// `unstubAllGlobals` 가 되돌린다.
const 원래전역: Record<string, unknown> = {}

function stubGlobal(name: string, value: unknown): void {
  if (!(name in 원래전역)) 원래전역[name] = (globalThis as Record<string, unknown>)[name]
  ;(globalThis as Record<string, unknown>)[name] = value
}

function unstubAllGlobals(): void {
  for (const [name, value] of Object.entries(원래전역)) {
    ;(globalThis as Record<string, unknown>)[name] = value
  }
}

// 비-2xx 응답 본문의 error.name(넥슨 에러 코드)을 살린다. 전에는 401/403/429만
// 갈라내고 나머지를 전부 NexonNetworkError로 뭉갰는데, 400 안에 성질이 전혀 다른 세 실패가
// 들어 있다. OPENAPI00003(영구 조회 불가)· OPENAPI00004(그 날짜 조회 불가)·
// OPENAPI00009(아직 집계 전, 시간이 지나면 풀린다). 코드가 없으면 이 셋을 구분할 방법이 없다.

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error('not json')
      return body
    },
  } as unknown as Response
}

afterEach(() => {
  unstubAllGlobals()
})

describe('requestJson: 에러 코드 보존', () => {
  it('400 응답 본문의 error.name을 NexonBadRequestError.code로 살린다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(400, { error: { name: 'OPENAPI00003', message: 'Please input valid id' } })),
    )

    await expect(requestJson('/x', 자격('key'))).rejects.toBeInstanceOf(NexonBadRequestError)
    await expect(requestJson('/x', 자격('key'))).rejects.toMatchObject({ code: 'OPENAPI00003' })
  })

  it.each(['OPENAPI00004', 'OPENAPI00009'])('400 %s 도 그대로 담는다', async (code) => {
    stubGlobal('fetch', jest.fn(async () => response(400, { error: { name: code } })))

    await expect(requestJson('/x', 자격('key'))).rejects.toMatchObject({ code })
  })

  it('400인데 본문을 읽을 수 없으면 code는 null이다. 알 수 없는 실패로 degrade한다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(400, undefined)))

    await expect(requestJson('/x', 자격('key'))).rejects.toMatchObject({ code: null })
  })

  it('본문에 error가 없어도 code는 null이고 던지는 것은 여전히 NexonBadRequestError다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(400, { something: 'else' })))

    const error = await requestJson('/x', 자격('key')).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(NexonBadRequestError)
    expect((error as NexonBadRequestError).code).toBeNull()
  })

  it('사용자에게 보일 수 있는 message에 넥슨 원문을 넣지 않는다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(400, { error: { name: 'OPENAPI00003', message: 'Please input valid id' } })),
    )

    const error = (await requestJson('/x', 자격('key')).catch((caught: unknown) => caught)) as Error
    expect(error.message).not.toContain('Please input valid id')
  })
})

describe('requestJson: 기존 분기 유지', () => {
  it.each([401, 403])('%i 는 NexonAuthError', async (status) => {
    stubGlobal('fetch', jest.fn(async () => response(status, { error: { name: 'OPENAPI00001' } })))
    await expect(requestJson('/x', 자격('key'))).rejects.toBeInstanceOf(NexonAuthError)
  })

  it('429 는 NexonRateLimitError', async () => {
    stubGlobal('fetch', jest.fn(async () => response(429, { error: { name: 'OPENAPI00007' } })))
    await expect(requestJson('/x', 자격('key'))).rejects.toBeInstanceOf(NexonRateLimitError)
  })

  it('5xx 는 NexonNetworkError (BadRequest가 아니다)', async () => {
    stubGlobal('fetch', jest.fn(async () => response(503, { error: { name: 'WHATEVER' } })))
    const error = await requestJson('/x', 자격('key')).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(NexonNetworkError)
    expect(error).not.toBeInstanceOf(NexonBadRequestError)
  })

  it('fetch 자체가 실패하면 NexonNetworkError', async () => {
    stubGlobal('fetch', jest.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(requestJson('/x', 자격('key'))).rejects.toBeInstanceOf(NexonNetworkError)
  })

  it('200 인데 JSON이 아니면 NexonNetworkError', async () => {
    stubGlobal('fetch', jest.fn(async () => response(200, undefined)))
    await expect(requestJson('/x', 자격('key'))).rejects.toBeInstanceOf(NexonNetworkError)
  })
})

// 자격을 문자열이 아니라 객체로 받는다(#535). 전송 경로를 가르는 자리를 이 파일 하나로
// 모으려는 것이다. 넥슨 로그인이 붙으면 프렌즈 API 넷만 서버를 거치고 나머지는 지금처럼
// 넥슨을 직접 부른다. 갈림이 client 파일마다 흩어지면 새는 자리를 못 센다.
describe('requestJson: 자격 객체', () => {
  it('API 키 자격이면 그 값을 x-nxopen-api-key 로 보낸다', async () => {
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => response(200, { ok: true }))
    stubGlobal('fetch', fetcher)

    await requestJson('/x', { type: 'key', value: '내키', accountId: null })

    const headers = fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['x-nxopen-api-key']).toBe('내키')
  })

  it('키 말고 다른 것은 헤더에 안 실린다', async () => {
    // 자격 객체가 커져도 넥슨에 나가는 것은 키뿐이어야 한다.
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => response(200, { ok: true }))
    stubGlobal('fetch', fetcher)

    await requestJson('/x', { type: 'key', value: '내키', accountId: null })

    const headers = fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(Object.keys(headers)).toEqual(['x-nxopen-api-key'])
  })
})

// 전송 경로가 둘이다. 자격이 넥슨 로그인이면 프렌즈 API 여섯은 우리 서버의 스트림을 거치고,
// API 키면 지금처럼 앱이 넥슨을 직접 부른다. 가르는 판정이 이 파일 밖으로 새면 안 된다.
describe('requestJson: 로그인 자격의 프렌즈 경로는 서버 스트림으로 간다', () => {
  // 앱은 토큰을 안 든다. 넥슨 보안 가이드라인이 액세스 토큰을 서버에서만 관리하라고 적어서다.
  const 로그인 = { type: 'login', value: '내세션', accountId: null } as const

  function 잡는스트림(lines: StreamLine[] | (() => Promise<StreamLine[]>)) {
    const stream = jest.fn(typeof lines === 'function' ? lines : async () => lines)
    setFriendsStreamForTest(stream)
    return stream
  }
  const 쪽 = (task: Record<string, unknown>, n: number, body: unknown): StreamLine =>
    ({ t: 'page', ...task, n, body }) as StreamLine
  const 끝 = (task: Record<string, unknown>, pages: number): StreamLine =>
    ({ t: 'done', ...task, pages }) as StreamLine

  afterEach(() => {
    setFriendsStreamForTest(null)
  })

  it('넥슨에 직접 안 가고 세션을 스트림에 넘긴다', async () => {
    const fetcher = jest.fn()
    stubGlobal('fetch', fetcher)
    const task = { kind: 'character-list' }
    const stream = 잡는스트림([쪽(task, 1, { character_list: [] }), 끝(task, 1), { t: 'end', reason: 'done' }])

    await requestJson('/maplestory/v1/character/list', 로그인)

    expect(fetcher).not.toHaveBeenCalled()
    expect(stream).toHaveBeenCalledWith('내세션', [{ kind: 'character-list' }])
  })

  it.each([
    ['/maplestory/v1/history/cube?count=1000&date=2026-09-25', { kind: 'cube', date: '2026-09-25' }],
    ['/maplestory/v1/history/starforce?count=1000&date=2026-09-25', { kind: 'starforce', date: '2026-09-25' }],
    ['/maplestory/v1/history/potential?count=1000&date=2026-09-25', { kind: 'potential', date: '2026-09-25' }],
    ['/maplestory/v1/history/soul-potential?count=1000&date=2026-09-25', { kind: 'soul-potential', date: '2026-09-25' }],
    ['/maplestory/v1/scheduler/character-state?ocid=o1&date=2026-09-25', { kind: 'character-state', ocid: 'o1', date: '2026-09-25' }],
    ['/maplestory/v1/scheduler/character-state?ocid=o1', { kind: 'character-state', ocid: 'o1' }],
  ])('%s 는 서버 작업으로 바뀐다', async (path, task) => {
    const stream = 잡는스트림([쪽(task, 1, { ok: true }), 끝(task, 1), { t: 'end', reason: 'done' }])

    await expect(requestJson(path, 로그인)).resolves.toEqual({ ok: true })
    expect(stream).toHaveBeenCalledWith('내세션', [task])
  })

  it('쪽이 여럿이면 배열을 잇고 next_cursor 는 null 이다. 부르는 쪽의 커서 고리는 한 번에 끝난다', async () => {
    const task = { kind: 'cube', date: '2026-09-25' }
    잡는스트림([
      쪽(task, 1, { count: 2, next_cursor: 'c1', cube_history: [{ id: 'a' }, { id: 'b' }] }),
      쪽(task, 2, { count: 1, next_cursor: null, cube_history: [{ id: 'c' }] }),
      끝(task, 2),
      { t: 'end', reason: 'done' },
    ])

    await expect(requestJson('/maplestory/v1/history/cube?count=1000&date=2026-09-25', 로그인)).resolves.toEqual({
      count: 2,
      next_cursor: null,
      cube_history: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    })
  })

  it('다른 작업의 줄은 섞이지 않는다', async () => {
    const mine = { kind: 'character-state', ocid: 'o1', date: '2026-09-25' }
    const other = { kind: 'character-state', ocid: 'o2', date: '2026-09-25' }
    잡는스트림([쪽(other, 1, { who: 'other' }), 쪽(mine, 1, { who: 'mine' }), 끝(other, 1), 끝(mine, 1), { t: 'end', reason: 'done' }])

    await expect(
      requestJson('/maplestory/v1/scheduler/character-state?ocid=o1&date=2026-09-25', 로그인),
    ).resolves.toEqual({ who: 'mine' })
  })

  it('fail 줄은 직접 부른 것과 같은 에러로 간다. 400 은 코드까지', async () => {
    const task = { kind: 'cube', date: '2026-09-25' }
    const path = '/maplestory/v1/history/cube?count=1000&date=2026-09-25'
    const fail = (status: number, code?: string): StreamLine =>
      ({ t: 'fail', ...task, status, ...(code === undefined ? {} : { code }) }) as StreamLine

    잡는스트림([fail(400, 'OPENAPI00009'), { t: 'end', reason: 'done' }])
    await expect(requestJson(path, 로그인)).rejects.toMatchObject({ code: 'OPENAPI00009' })
    await expect(requestJson(path, 로그인)).rejects.toBeInstanceOf(NexonBadRequestError)

    잡는스트림([fail(429), { t: 'end', reason: 'done' }])
    await expect(requestJson(path, 로그인)).rejects.toBeInstanceOf(NexonRateLimitError)

    잡는스트림([fail(401), { t: 'end', reason: 'done' }])
    await expect(requestJson(path, 로그인)).rejects.toBeInstanceOf(NexonSignInRequiredError)

    잡는스트림([fail(0), { t: 'end', reason: 'done' }])
    await expect(requestJson(path, 로그인)).rejects.toBeInstanceOf(NexonNetworkError)
  })

  it('끝 줄이 relogin 이면 재로그인이고, 끝을 못 보면 못 닿은 것이다', async () => {
    const task = { kind: 'character-list' }
    잡는스트림([{ t: 'end', reason: 'relogin' }])
    await expect(requestJson('/maplestory/v1/character/list', 로그인)).rejects.toBeInstanceOf(
      NexonSignInRequiredError,
    )

    잡는스트림([쪽(task, 1, {}), { t: 'end', reason: 'deadline' }])
    await expect(requestJson('/maplestory/v1/character/list', 로그인)).rejects.toBeInstanceOf(
      NexonNetworkError,
    )
  })

  it('서버가 401 로 거절하면 재로그인이고 503 이면 못 닿은 것이다', async () => {
    잡는스트림(async () => {
      throw Object.assign(new Error('rejected'), { status: 401 })
    })
    await expect(requestJson('/maplestory/v1/character/list', 로그인)).rejects.toBeInstanceOf(
      NexonSignInRequiredError,
    )

    잡는스트림(async () => {
      throw Object.assign(new Error('rejected'), { status: 503 })
    })
    const error = await requestJson('/maplestory/v1/character/list', 로그인).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(NexonNetworkError)
    expect(error).not.toBeInstanceOf(NexonAuthError)
  })

  it('배선이 없으면 못 닿은 것으로 던진다', async () => {
    setFriendsStreamForTest(null)
    await expect(requestJson('/maplestory/v1/character/list', 로그인)).rejects.toBeInstanceOf(
      NexonNetworkError,
    )
  })

  it('API 키 자격은 종전대로 넥슨에 키 헤더를 싣는다', async () => {
    const stream = 잡는스트림([])
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => response(200, { ok: true }))
    stubGlobal('fetch', fetcher)

    await requestJson('/maplestory/v1/character/list', { type: 'key', value: '내키', accountId: null })

    expect(stream).not.toHaveBeenCalled()
    const headers = fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['x-nxopen-api-key']).toBe('내키')
    expect(headers.Authorization).toBeUndefined()
  })
})

describe('requestJson: 로그인은 프렌즈 밖 경로를 개발자 키로 부른다', () => {
  // Open ID 가 안 여는 경로다. 로그인 사용자는 자기 키가 없으니 번들에 박은 키로 부른다.
  const 로그인 = { type: 'login', value: '내세션', accountId: null } as const
  const 밖 = '/maplestory/v1/character/basic?ocid=x'

  afterEach(() => {
    __setDeveloperKeysForTest([])
  })

  it('개발자 키 헤더를 싣는다. Bearer 는 안 싣는다', async () => {
    __setDeveloperKeysForTest(['개발키1'])
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => response(200, {}))
    stubGlobal('fetch', fetcher)

    await requestJson(밖, 로그인)

    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://open.api.nexon.com${밖}`)
    const headers = fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['x-nxopen-api-key']).toBe('개발키1')
    expect(headers.Authorization).toBeUndefined()
  })

  it('요청마다 번갈아 쓴다', async () => {
    __setDeveloperKeysForTest(['개발키1', '개발키2'])
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => response(200, {}))
    stubGlobal('fetch', fetcher)

    await requestJson(밖, 로그인)
    await requestJson(밖, 로그인)

    const 쓴키 = fetcher.mock.calls.map(
      (call) => (call[1]?.headers as Record<string, string>)['x-nxopen-api-key'],
    )
    expect(쓴키).toEqual(['개발키1', '개발키2'])
  })

  it('키가 하나도 없으면 던진다. 빈 키로 부르지 않는다', async () => {
    // 빈 키를 실으면 넥슨이 400 을 주고, 그 400 은 사용자에게 키가 잘못됐다 로 보인다.
    __setDeveloperKeysForTest([])
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => response(200, {}))
    stubGlobal('fetch', fetcher)

    await expect(requestJson(밖, 로그인)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('키가 무효면 그 키를 빼고 남은 키로 다시 부른다', async () => {
    __setDeveloperKeysForTest(['죽은키', '산키'])
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async (_url, init) => {
      const key = (init?.headers as Record<string, string>)['x-nxopen-api-key']
      return key === '죽은키'
        ? response(400, { error: { name: 'OPENAPI00005' } })
        : response(200, { ok: true })
    })
    stubGlobal('fetch', fetcher)

    await expect(requestJson(밖, 로그인)).resolves.toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('한도를 넘은 키도 뺀다', async () => {
    __setDeveloperKeysForTest(['탄키', '산키'])
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async (_url, init) => {
      const key = (init?.headers as Record<string, string>)['x-nxopen-api-key']
      return key === '탄키' ? response(429, {}) : response(200, { ok: true })
    })
    stubGlobal('fetch', fetcher)

    await expect(requestJson(밖, 로그인)).resolves.toEqual({ ok: true })
  })

  it('401 을 받은 키도 뺀다', async () => {
    __setDeveloperKeysForTest(['막힌키', '산키'])
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async (_url, init) => {
      const key = (init?.headers as Record<string, string>)['x-nxopen-api-key']
      return key === '막힌키' ? response(401, {}) : response(200, { ok: true })
    })
    stubGlobal('fetch', fetcher)

    await expect(requestJson(밖, 로그인)).resolves.toEqual({ ok: true })
  })

  it('전부 죽으면 그 실패를 그대로 올린다', async () => {
    // 되살릴 키가 없다. 여기서 성공으로 접으면 화면이 빈 응답을 그린다.
    __setDeveloperKeysForTest(['키1', '키2'])
    stubGlobal('fetch', jest.fn(async () => response(429, {})))

    await expect(requestJson(밖, 로그인)).rejects.toBeInstanceOf(NexonRateLimitError)
  })

  it('API 키 자격은 개발자 키를 안 쓴다', async () => {
    // 자기 키가 있는 사용자다. 우리 한도를 태울 이유가 없다.
    __setDeveloperKeysForTest(['개발키1'])
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => response(200, {}))
    stubGlobal('fetch', fetcher)

    await requestJson(밖, { type: 'key', value: '내키', accountId: null })

    const headers = fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['x-nxopen-api-key']).toBe('내키')
  })
})

describe('requestJson: 로그인 만료는 키 무효와 다른 실패다', () => {
  const 로그인 = { type: 'login', value: '내세션', accountId: null } as const
  const 거절 = (status: number) =>
    setFriendsStreamForTest(async () => {
      throw Object.assign(new Error('rejected'), { status })
    })

  afterEach(() => {
    setFriendsStreamForTest(null)
    __setDeveloperKeysForTest([])
  })

  it('서버가 세션을 거절하면 NexonSignInRequiredError', async () => {
    // 갱신 토큰(14일)이 죽으면 서버가 세션 행을 지우고 401 을 준다.
    거절(401)

    await expect(requestJson('/maplestory/v1/character/list', 로그인)).rejects.toBeInstanceOf(
      NexonSignInRequiredError,
    )
  })

  it('그것은 NexonAuthError 가 아니다', async () => {
    // 상속하면 isInvalidApiKeyError 가 참을 돌려줘 무효 키와 다시 한 덩어리가 되고,
    // 확인이 사용자의 API 키를 전부 지운다.
    거절(401)

    const error = await requestJson('/maplestory/v1/character/list', 로그인).catch(
      (caught: unknown) => caught,
    )

    expect(error).not.toBeInstanceOf(NexonAuthError)
    expect(isInvalidApiKeyError(error)).toBe(false)
  })

  it('API 키 자격의 401 은 그대로 NexonAuthError', async () => {
    stubGlobal('fetch', jest.fn(async () => response(401, { error: { name: 'OPENAPI00001' } })))

    await expect(requestJson('/x', 자격('키'))).rejects.toBeInstanceOf(NexonAuthError)
  })

  it('로그인 자격이어도 프렌즈 밖 경로의 429 는 그대로 NexonRateLimitError', async () => {
    // 가르는 것은 세션 거절뿐이다. 개발자 키 회차의 한도 초과는 전송 경로와 무관하다.
    __setDeveloperKeysForTest(['개발키1'])
    stubGlobal('fetch', jest.fn(async () => response(429, {})))

    await expect(requestJson('/maplestory/v1/character/basic?ocid=x', 로그인)).rejects.toBeInstanceOf(
      NexonRateLimitError,
    )
  })
})

describe('requestJson: Open API 점검', () => {
  const 보고 = { maintenance: jest.fn(), succeeded: jest.fn() }

  beforeEach(() => {
    보고.maintenance.mockClear()
    보고.succeeded.mockClear()
    setMaintenanceReporter(보고)
  })

  afterEach(() => {
    setMaintenanceReporter(null)
    setFriendsStreamForTest(null)
    __setDeveloperKeysForTest([])
  })

  it('400 OPENAPI00010 은 메이플스토리 API 점검이고, 503 OPENAPI00011 은 Open API 점검이다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(400, { error: { name: 'OPENAPI00010' } })))
    await expect(requestJson('/maplestory/v1/character/basic?ocid=x', 자격('key'))).rejects.toMatchObject({
      constructor: NexonMaintenanceError,
      scope: 'game',
    })

    stubGlobal('fetch', jest.fn(async () => response(503, { error: { name: 'OPENAPI00011' } })))
    await expect(requestJson('/maplestory/v1/character/basic?ocid=x', 자격('key'))).rejects.toMatchObject({
      constructor: NexonMaintenanceError,
      scope: 'api',
    })
  })

  it('코드 없는 503 은 종전대로 못 닿은 것이다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(503, undefined)))

    await expect(requestJson('/x', 자격('key'))).rejects.toBeInstanceOf(NexonNetworkError)
    expect(보고.maintenance).not.toHaveBeenCalled()
  })

  it('점검과 성공을 물음표 앞 경로로 알린다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(400, { error: { name: 'OPENAPI00010' } })))
    await requestJson('/maplestory/v1/character/basic?ocid=x', 자격('key')).catch(() => undefined)
    expect(보고.maintenance).toHaveBeenCalledWith('game', '/maplestory/v1/character/basic')

    stubGlobal('fetch', jest.fn(async () => response(200, { ok: true })))
    await requestJson('/maplestory/v1/character/basic?ocid=x', 자격('key'))
    expect(보고.succeeded).toHaveBeenCalledWith('/maplestory/v1/character/basic')
  })

  it('점검은 개발자 키 탓이 아니다. 키를 빼고 다시 부르지 않는다', async () => {
    __setDeveloperKeysForTest(['개발키1', '개발키2'])
    const fetcher = jest.fn(async () => response(400, { error: { name: 'OPENAPI00010' } }))
    stubGlobal('fetch', fetcher)

    await expect(
      requestJson('/maplestory/v1/character/basic?ocid=x', { type: 'login', value: '세션', accountId: null }),
    ).rejects.toBeInstanceOf(NexonMaintenanceError)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('프렌즈 스트림의 fail 줄도 같은 점검으로 가르고 알린다', async () => {
    const task = { kind: 'character-list' }
    setFriendsStreamForTest(
      jest.fn(async () => [{ t: 'fail', ...task, status: 503, code: 'OPENAPI00011' }, { t: 'end', reason: 'done' }] as StreamLine[]),
    )

    await expect(
      requestJson('/maplestory/v1/character/list', { type: 'login', value: '세션', accountId: null }),
    ).rejects.toMatchObject({ scope: 'api' })
    expect(보고.maintenance).toHaveBeenCalledWith('api', '/maplestory/v1/character/list')
  })
})
