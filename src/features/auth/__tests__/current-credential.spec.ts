// 넥슨을 부르기 직전에 **쓸 수 있는 자격**을 고른다. 여기서 막는 사고는 두 가지다.
//
// ① 토큰이 없는 로그인을 자격이라고 내주는 것. `Bearer undefined` 가 나가고 넥슨은 그것을
//    400 OPENAPI00004 로 답한다. 화면에는 `이 기간은 조회할 수 없습니다` 가 뜬다(실측
//    2026-09-27). 날짜 문제가 아닌데 날짜 문제로 보인다.
// ② 30분이 지나 죽은 토큰을 그대로 쓰는 것. 401 재시도가 있지만, 애초에 안 내주는 편이 싸다.
import { currentCredential } from '../current-credential'

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../renew-access-token', () => ({ renewNexonAccessToken: jest.fn() }))

const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const { renewNexonAccessToken } = jest.requireMock('../renew-access-token') as Record<string, jest.Mock>

const 지금 = new Date('2026-09-27T12:00:00.000Z')
const 살아있음 = '2026-09-27T12:30:00.000Z'
const 곧죽음 = '2026-09-27T12:00:30.000Z'

function 설정(login: Record<string, unknown> | null, ...keys: string[]) {
  return {
    login,
    apiKeys: keys.map((value) => ({ kind: 'apiKey' as const, label: '', value })),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  renewNexonAccessToken.mockResolvedValue('새토큰')
})

describe('토큰이 살아 있으면 그대로 쓴다', () => {
  it('받아 오지 않는다', async () => {
    getAuthConfig.mockResolvedValue(
      설정({ kind: 'login', session: '세션', accessToken: '산토큰', accessExpiresAt: 살아있음 }),
    )

    expect(await currentCredential(지금)).toEqual({ kind: 'login', value: '산토큰' })
    expect(renewNexonAccessToken).not.toHaveBeenCalled()
  })
})

describe('토큰이 없거나 죽었으면 받아 온다', () => {
  it('옛 형식(토큰 칸이 아예 없다)이면 받아 온다', async () => {
    // 저장 형식을 바꾸기 전에 로그인한 기기다. 이것을 안 챙기면 `Bearer undefined` 가 나간다.
    getAuthConfig.mockResolvedValue(설정({ kind: 'login', session: '세션' }))

    expect(await currentCredential(지금)).toEqual({ kind: 'login', value: '새토큰' })
    expect(renewNexonAccessToken).toHaveBeenCalledTimes(1)
  })

  it('만료가 가까우면 미리 받아 온다', async () => {
    // 부르러 가는 사이에 죽으면 401 이 오고, 그 401 은 재로그인으로 보인다.
    getAuthConfig.mockResolvedValue(
      설정({ kind: 'login', session: '세션', accessToken: '옛토큰', accessExpiresAt: 곧죽음 }),
    )

    expect(await currentCredential(지금)).toEqual({ kind: 'login', value: '새토큰' })
  })

  it('만료 시각이 망가졌으면 받아 온다', async () => {
    getAuthConfig.mockResolvedValue(
      설정({ kind: 'login', session: '세션', accessToken: '옛토큰', accessExpiresAt: '망가진값' }),
    )

    expect(await currentCredential(지금)).toEqual({ kind: 'login', value: '새토큰' })
  })
})

describe('못 받아 오면 남은 수단으로 간다', () => {
  it('세션까지 죽었고 키가 있으면 키다', async () => {
    renewNexonAccessToken.mockResolvedValue(null)
    getAuthConfig.mockResolvedValue(설정({ kind: 'login', session: '세션' }, '키-가'))

    expect(await currentCredential(지금)).toEqual({ kind: 'apiKey', value: '키-가' })
  })

  it('세션까지 죽었고 키도 없으면 null 이다', async () => {
    // 여기서 토큰 없는 로그인을 내주면 `Bearer undefined` 가 나간다.
    renewNexonAccessToken.mockResolvedValue(null)
    getAuthConfig.mockResolvedValue(설정({ kind: 'login', session: '세션' }))

    expect(await currentCredential(지금)).toBeNull()
  })
})

describe('로그인이 없으면 종전대로다', () => {
  it('키만 있으면 키다. 받아 오지도 않는다', async () => {
    getAuthConfig.mockResolvedValue(설정(null, '키-가'))

    expect(await currentCredential(지금)).toEqual({ kind: 'apiKey', value: '키-가' })
    expect(renewNexonAccessToken).not.toHaveBeenCalled()
  })

  it('수단이 없으면 null 이다', async () => {
    getAuthConfig.mockResolvedValue(null)

    expect(await currentCredential(지금)).toBeNull()
  })

  it('저장소를 못 읽어도 던지지 않는다', async () => {
    getAuthConfig.mockRejectedValue(new Error('disk'))

    expect(await currentCredential(지금)).toBeNull()
  })
})
