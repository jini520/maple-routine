import {
  NexonAuthError,
  NexonBadRequestError,
  NexonNetworkError,
  NexonRateLimitError,
} from '../errors'
import { __setDeveloperKeysForTest } from '../developer-keys'
import { requestJson } from '../http'
import type { NexonCredential } from '../../types/auth'

/** 넥슨에 넘기는 자격. 지금은 API 키 한 종류뿐이다. */
const 자격 = (value: string): NexonCredential => ({ kind: 'apiKey', value })

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

  it('200 이면 본문을 그대로 반환한다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(200, { ok: 1 })))
    await expect(requestJson<{ ok: number }>('/x', 자격('key'))).resolves.toEqual({ ok: 1 })
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

    await requestJson('/x', { kind: 'apiKey', value: '내키' })

    const headers = fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['x-nxopen-api-key']).toBe('내키')
  })

  it('키 말고 다른 것은 헤더에 안 실린다', async () => {
    // 자격 객체가 커져도 넥슨에 나가는 것은 키뿐이어야 한다.
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => response(200, { ok: true }))
    stubGlobal('fetch', fetcher)

    await requestJson('/x', { kind: 'apiKey', value: '내키' })

    const headers = fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(Object.keys(headers)).toEqual(['x-nxopen-api-key'])
  })
})

// 전송 경로가 둘이다(#540). 자격이 넥슨 로그인이면 프렌즈 API 여섯만 우리 서버를 거치고,
// API 키면 지금처럼 앱이 넥슨을 직접 부른다. 가르는 판정이 이 파일 밖으로 새면 안 된다.
describe('requestJson: 로그인 자격은 넥슨을 직접 부른다', () => {
  // 앱이 직접 부른다. 강화 내역 한 회차가 수백 건이라 우리 서버가 중계하면 사용자 한 명의
  // 조작이 서버에 수백 요청이 된다. 실리는 것은 세션이 아니라 액세스 토큰이다.
  const 로그인 = { kind: 'login', value: '액세스토큰' } as const

  function 잡는fetch() {
    const fetcher = jest.fn<Promise<Response>, [string, RequestInit?]>(async () =>
      response(200, { ok: true }),
    )
    stubGlobal('fetch', fetcher)
    return fetcher
  }

  it('프렌즈 경로도 넥슨으로 간다. 우리 서버를 안 거친다', async () => {
    const fetcher = 잡는fetch()

    await requestJson('/maplestory/v1/character/list', 로그인)

    expect(fetcher.mock.calls[0]?.[0]).toBe('https://open.api.nexon.com/maplestory/v1/character/list')
    expect(fetcher.mock.calls[0]?.[0]).not.toContain('mapleroutine.store')
  })

  it('액세스 토큰을 Bearer 로 싣는다. 세션 헤더는 없다', async () => {
    const fetcher = 잡는fetch()

    await requestJson('/maplestory/v1/character/list', 로그인)

    const headers = fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer 액세스토큰')
    expect(headers['x-nexon-session']).toBeUndefined()
    expect(headers['x-nxopen-api-key']).toBeUndefined()
  })

  it('물음표 뒤 값을 그대로 넘긴다', async () => {
    const fetcher = 잡는fetch()

    await requestJson('/maplestory/v1/history/cube?count=1000&date=2026-09-25', 로그인)

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://open.api.nexon.com/maplestory/v1/history/cube?count=1000&date=2026-09-25',
    )
  })

  it.each([
    '/maplestory/v1/character/list',
    '/maplestory/v1/history/cube',
    '/maplestory/v1/history/starforce',
    '/maplestory/v1/history/potential',
    '/maplestory/v1/history/soul-potential',
    '/maplestory/v1/scheduler/character-state',
  ])('%s 는 Bearer 로 간다', async (path) => {
    // Open ID 가 여는 것이 이 여섯뿐이다. 늘리려면 넥슨 등록에서 그 항목을 먼저 켠다.
    const fetcher = 잡는fetch()

    await requestJson(path, 로그인)

    const headers = fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer 액세스토큰')
  })

  it('프렌즈 밖 경로를 로그인으로 부르면 던진다', async () => {
    // Open ID 로 안 열린다. 이 경로는 개발자 키가 받는다(아직 미배선).
    const fetcher = 잡는fetch()

    await expect(requestJson('/maplestory/v1/character/basic?ocid=x', 로그인)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('API 키 자격은 종전대로 키 헤더를 싣는다', async () => {
    const fetcher = 잡는fetch()

    await requestJson('/maplestory/v1/character/list', { kind: 'apiKey', value: '내키' })

    const headers = fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['x-nxopen-api-key']).toBe('내키')
    expect(headers.Authorization).toBeUndefined()
  })
})

describe('requestJson: 로그인은 프렌즈 밖 경로를 개발자 키로 부른다', () => {
  // Open ID 가 안 여는 경로다. 로그인 사용자는 자기 키가 없으니 번들에 박은 키로 부른다.
  const 로그인 = { kind: 'login', value: '액세스토큰' } as const
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

    await requestJson(밖, { kind: 'apiKey', value: '내키' })

    const headers = fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['x-nxopen-api-key']).toBe('내키')
  })
})
