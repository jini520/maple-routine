// 넥슨을 부르기 직전에 **쓸 수 있는 자격**을 고른다. 로그인이면 값은 서버 세션이다. 앱은 액세스
// 토큰을 안 들고, 세션이 죽었는지는 서버가 401 로 답한다.
import { apiKeyHashHex } from '../../../lib/crypto/api-key-hash'
import { credentialsOfOcids, currentCredential, currentCredentials } from '../current-credential'

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ getNexonAccountIdsOfOcids: jest.fn() }))
jest.mock('../../../storage/server-sub-accounts', () => ({ getServerSubAccounts: jest.fn() }))
jest.mock('../../../storage/server-accounts', () => ({ getServerAccounts: jest.fn() }))

const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const { getNexonAccountIdsOfOcids } = jest.requireMock('../../../storage/character-accounts') as Record<string, jest.Mock>
const { getServerSubAccounts } = jest.requireMock('../../../storage/server-sub-accounts') as Record<string, jest.Mock>
const { getServerAccounts } = jest.requireMock('../../../storage/server-accounts') as Record<string, jest.Mock>

function 설정(login: Record<string, unknown> | null, ...keys: string[]) {
  return {
    login,
    apiKeys: keys.map((value) => ({ type: 'key' as const, id: `account-${value}`, label: '', value, loginId: null })),
    mainKeyId: login === null && keys.length > 0 ? `account-${keys[0]}` : null,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  getServerSubAccounts.mockResolvedValue(null)
  getServerAccounts.mockResolvedValue({ reported: {}, registered: [] })
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

const 로그인과부계정 = {
  login: { type: 'login', id: 'account-login', session: '세션' },
  mainKeyId: null,
  apiKeys: [
    { type: 'key', id: 'account-부', label: '', value: '부-키', loginId: 'account-login' },
    { type: 'key', id: 'account-다른', label: '', value: '다른-키', loginId: 'account-다른-로그인' },
  ],
}

describe('currentCredentials', () => {
  it('로그인과 그 로그인에 등록한 부계정 키다. 저장소를 못 읽으면 빈 목록이다', async () => {
    getAuthConfig.mockResolvedValue(로그인과부계정)
    await expect(currentCredentials()).resolves.toEqual([
      { type: 'login', value: '세션', accountId: 'account-login' },
      { type: 'key', value: '부-키', accountId: 'account-부' },
    ])

    getAuthConfig.mockRejectedValue(new Error('읽기 실패'))
    await expect(currentCredentials()).resolves.toEqual([])
  })
})

// 다른 기기에서 지운 부계정의 키를 이 기기가 계속 부르면, 계정 관리에도 안 보이는 키가 조회를 이어 간다.
describe('서버 목록', () => {
  it('등록했는데 서버 목록에 없는 부계정 키는 부르지 않는다. 목록을 못 읽으면 기기의 키를 모두 부른다', async () => {
    getAuthConfig.mockResolvedValue(로그인과부계정)
    getServerSubAccounts.mockResolvedValue({ loginId: 'account-login', subAccounts: [] })
    getServerAccounts.mockResolvedValue({ reported: {}, registered: [`account-login:${apiKeyHashHex('부-키')}`] })

    await expect(currentCredentials()).resolves.toEqual([{ type: 'login', value: '세션', accountId: 'account-login' }])
    getNexonAccountIdsOfOcids.mockResolvedValue(new Map([['o-부', 'account-부']]))
    expect((await credentialsOfOcids(['o-부'])).get('o-부')).toBeNull()

    getServerSubAccounts.mockRejectedValue(new Error('읽기 실패'))
    await expect(currentCredentials()).resolves.toHaveLength(2)
  })
})

// 캐릭터는 그 캐릭터가 속한 넥슨 계정의 자격으로 부른다. 다른 계정의 자격으로 부르면 조회 불가가 된다.
describe('credentialsOfOcids', () => {
  it('부계정 캐릭터는 부계정 키, 계정을 모르는 캐릭터는 메인 계정, 자격이 없는 계정의 캐릭터는 null 이다', async () => {
    getAuthConfig.mockResolvedValue(로그인과부계정)
    getNexonAccountIdsOfOcids.mockResolvedValue(
      new Map([
        ['o-부', 'account-부'],
        ['o-메인', 'account-login'],
        ['o-다른', 'account-다른'],
      ]),
    )

    const found = await credentialsOfOcids(['o-부', 'o-메인', 'o-모름', 'o-다른'])

    expect(found.get('o-부')).toEqual({ type: 'key', value: '부-키', accountId: 'account-부' })
    expect(found.get('o-메인')).toEqual({ type: 'login', value: '세션', accountId: 'account-login' })
    expect(found.get('o-모름')).toEqual({ type: 'login', value: '세션', accountId: 'account-login' })
    expect(found.get('o-다른')).toBeNull()
  })

  // 소속을 못 읽었다고 모든 캐릭터를 안 부르면 앱 전체가 멈춘다. 계정 칸이 생기기 전처럼 메인 계정으로 부른다.
  it('소속을 못 읽으면 모두 메인 계정의 자격이다', async () => {
    getAuthConfig.mockResolvedValue(로그인과부계정)
    getNexonAccountIdsOfOcids.mockRejectedValue(new Error('읽기 실패'))

    const found = await credentialsOfOcids(['o-부'])

    expect(found.get('o-부')).toEqual({ type: 'login', value: '세션', accountId: 'account-login' })
  })
})
