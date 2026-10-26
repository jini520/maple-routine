// 넥슨을 부르기 직전에 **쓸 수 있는 자격**을 고른다. 로그인이면 값은 서버 세션이다. 앱은 액세스
// 토큰을 안 들고, 세션이 죽었는지는 서버가 401 로 답한다.
import { currentCredential } from '../current-credential'

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))

const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>

function 설정(login: Record<string, unknown> | null, ...keys: string[]) {
  return {
    login,
    apiKeys: keys.map((value) => ({ type: 'key' as const, id: `account-${value}`, label: '', value })),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('로그인이 있으면 세션이다', () => {
  it('값은 서버 세션이고 넥슨 토큰이 아니다', async () => {
    getAuthConfig.mockResolvedValue(설정({ type: 'login', id: 'account-login', session: '세션' }))

    await expect(currentCredential()).resolves.toEqual({ type: 'login', value: '세션', accountId: 'account-login' })
  })

  it('키가 함께 있어도 로그인이 이긴다', async () => {
    getAuthConfig.mockResolvedValue(설정({ type: 'login', id: 'account-login', session: '세션' }, '키'))

    await expect(currentCredential()).resolves.toEqual({ type: 'login', value: '세션', accountId: 'account-login' })
  })
})

describe('로그인이 없으면 키다', () => {
  it('키만 있으면 첫 키다', async () => {
    getAuthConfig.mockResolvedValue(설정(null, '키1', '키2'))

    await expect(currentCredential()).resolves.toEqual({ type: 'key', value: '키1', accountId: 'account-키1' })
  })

  it('수단이 없으면 null 이다', async () => {
    getAuthConfig.mockResolvedValue(null)

    await expect(currentCredential()).resolves.toBeNull()
  })

  it('저장소를 못 읽어도 던지지 않는다', async () => {
    getAuthConfig.mockRejectedValue(new Error('디스크'))

    await expect(currentCredential()).resolves.toBeNull()
  })
})
