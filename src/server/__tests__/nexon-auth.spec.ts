// 우리 서버의 로그인 창구. 계약은 서버 저장소와 나눠 갖는다.
import { redeemNexonSession, revokeNexonSession, startNexonLogin } from '../nexon-auth'

const 원래fetch = globalThis.fetch

function 응답(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

afterEach(() => {
  globalThis.fetch = 원래fetch
})

describe('startNexonLogin', () => {
  it('플랫폼을 보내고 authorizeUrl 과 redeemKey 를 받는다', async () => {
    const fetcher = jest.fn(async () => 응답(201, { authorizeUrl: 'https://n/x', redeemKey: 'RK' }))
    globalThis.fetch = fetcher as unknown as typeof fetch

    await expect(startNexonLogin('android')).resolves.toEqual({ authorizeUrl: 'https://n/x', redeemKey: 'RK' })

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://mapleroutine.store/v1/auth/nexon/login')
    expect(JSON.parse(init.body as string)).toEqual({ platform: 'android' })
  })

  it('계약과 다른 응답이면 던진다', async () => {
    globalThis.fetch = jest.fn(async () => 응답(201, { authorizeUrl: 'x' })) as unknown as typeof fetch

    await expect(startNexonLogin('ios')).rejects.toThrow()
  })
})

describe('redeemNexonSession', () => {
  it('ok 면 세션, pending 은 그대로, 404 와 cancelled 는 gone 이다', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(응답(201, { status: 'ok', session: 'S' }))
      .mockResolvedValueOnce(응답(201, { status: 'pending' }))
      .mockResolvedValueOnce(응답(404, { status: 'gone' }))
      .mockResolvedValueOnce(응답(201, { status: 'cancelled' }))
    globalThis.fetch = fetcher as unknown as typeof fetch
    const 열쇠 = { redeemKey: 'RK', receipt: 'R' }

    await expect(redeemNexonSession(열쇠)).resolves.toEqual({ status: 'ok', session: 'S' })
    await expect(redeemNexonSession(열쇠)).resolves.toEqual({ status: 'pending' })
    await expect(redeemNexonSession(열쇠)).resolves.toEqual({ status: 'gone' })
    await expect(redeemNexonSession(열쇠)).resolves.toEqual({ status: 'gone' })

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://mapleroutine.store/v1/auth/nexon/session')
    expect(JSON.parse(init.body as string)).toEqual(열쇠)
  })

  it('5xx 는 던진다. 되묻는 쪽이 실패로 접는다', async () => {
    globalThis.fetch = jest.fn(async () => 응답(503)) as unknown as typeof fetch

    await expect(redeemNexonSession({ redeemKey: 'RK', receipt: 'R' })).rejects.toThrow()
  })
})

describe('revokeNexonSession', () => {
  it('세션을 Bearer 로 싣고 DELETE 한다. 실패해도 던지지 않는다', async () => {
    const fetcher = jest.fn(async () => 응답(204))
    globalThis.fetch = fetcher as unknown as typeof fetch

    await revokeNexonSession('S')

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://mapleroutine.store/v1/auth/nexon/session')
    expect(init.method).toBe('DELETE')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer S')

    globalThis.fetch = jest.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    await expect(revokeNexonSession('S')).resolves.toBeUndefined()
  })
})
