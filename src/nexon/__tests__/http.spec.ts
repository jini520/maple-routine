import {
  NexonAuthError,
  NexonBadRequestError,
  NexonNetworkError,
  NexonRateLimitError,
} from '../errors'
import { requestJson } from '../http'

// vitest 의 `vi.stubGlobal` 짝. jest 에는 없어서 여기서 최소한으로 만든다. 원래 값을 기억해 두고
// `unstubAllGlobals()` 가 되돌린다.
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
// 들어 있다. OPENAPI00003(영구 조회 불가) · OPENAPI00004(그 날짜 조회 불가) ·
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

    await expect(requestJson('/x', 'key')).rejects.toBeInstanceOf(NexonBadRequestError)
    await expect(requestJson('/x', 'key')).rejects.toMatchObject({ code: 'OPENAPI00003' })
  })

  it.each(['OPENAPI00004', 'OPENAPI00009'])('400 %s 도 그대로 담는다', async (code) => {
    stubGlobal('fetch', jest.fn(async () => response(400, { error: { name: code } })))

    await expect(requestJson('/x', 'key')).rejects.toMatchObject({ code })
  })

  it('400인데 본문을 읽을 수 없으면 code는 null이다. 알 수 없는 실패로 degrade한다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(400, undefined)))

    await expect(requestJson('/x', 'key')).rejects.toMatchObject({ code: null })
  })

  it('본문에 error가 없어도 code는 null이고 던지는 것은 여전히 NexonBadRequestError다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(400, { something: 'else' })))

    const error = await requestJson('/x', 'key').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(NexonBadRequestError)
    expect((error as NexonBadRequestError).code).toBeNull()
  })

  it('사용자에게 보일 수 있는 message에 넥슨 원문을 넣지 않는다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(400, { error: { name: 'OPENAPI00003', message: 'Please input valid id' } })),
    )

    const error = (await requestJson('/x', 'key').catch((caught: unknown) => caught)) as Error
    expect(error.message).not.toContain('Please input valid id')
  })
})

describe('requestJson: 기존 분기 유지', () => {
  it.each([401, 403])('%i 는 NexonAuthError', async (status) => {
    stubGlobal('fetch', jest.fn(async () => response(status, { error: { name: 'OPENAPI00001' } })))
    await expect(requestJson('/x', 'key')).rejects.toBeInstanceOf(NexonAuthError)
  })

  it('429 는 NexonRateLimitError', async () => {
    stubGlobal('fetch', jest.fn(async () => response(429, { error: { name: 'OPENAPI00007' } })))
    await expect(requestJson('/x', 'key')).rejects.toBeInstanceOf(NexonRateLimitError)
  })

  it('5xx 는 NexonNetworkError (BadRequest가 아니다)', async () => {
    stubGlobal('fetch', jest.fn(async () => response(503, { error: { name: 'WHATEVER' } })))
    const error = await requestJson('/x', 'key').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(NexonNetworkError)
    expect(error).not.toBeInstanceOf(NexonBadRequestError)
  })

  it('fetch 자체가 실패하면 NexonNetworkError', async () => {
    stubGlobal('fetch', jest.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(requestJson('/x', 'key')).rejects.toBeInstanceOf(NexonNetworkError)
  })

  it('200 이면 본문을 그대로 반환한다', async () => {
    stubGlobal('fetch', jest.fn(async () => response(200, { ok: 1 })))
    await expect(requestJson<{ ok: number }>('/x', 'key')).resolves.toEqual({ ok: 1 })
  })

  it('200 인데 JSON이 아니면 NexonNetworkError', async () => {
    stubGlobal('fetch', jest.fn(async () => response(200, undefined)))
    await expect(requestJson('/x', 'key')).rejects.toBeInstanceOf(NexonNetworkError)
  })
})
