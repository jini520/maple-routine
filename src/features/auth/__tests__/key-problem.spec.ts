// 부계정 키가 무효가 되면 키를 지우지 않고 무효로 표시하고, 그 키의 넥슨 계정에 속한 추적 캐릭터를 뺀다. 메인 키는 지금처럼
// 지우고 로그인 화면으로 간다. 모달 본문과 확인 뒤 가는 곳이 같은 판정에서 나와야 사용자가 읽은 대로 간다.
import { destinationOf, planInvalidSubKey, retireInvalidSubKey } from '../key-problem'

jest.mock('../../../storage/api-key', () => ({
  getAuthConfig: jest.fn(),
  markApiKeyInvalid: jest.fn(async () => undefined),
}))
jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ getNexonAccountIdsOfOcids: jest.fn() }))
jest.mock('../../character-selection/untrack', () => ({ untrackCharacters: jest.fn(async () => undefined) }))

const apiKeyStore = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const selection = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>
const owners = jest.requireMock('../../../storage/character-accounts') as Record<string, jest.Mock>
const untrack = jest.requireMock('../../character-selection/untrack') as Record<string, jest.Mock>

const 로그인 = { type: 'login' as const, id: 'login-1', session: 'S' }
const 부계정키 = { type: 'key' as const, id: 'k-sub', label: '', value: '부-키', loginId: 'login-1' }

beforeEach(() => {
  jest.clearAllMocks()
  apiKeyStore.getAuthConfig.mockResolvedValue({ login: 로그인, apiKeys: [부계정키], mainKeyId: null })
  selection.getTrackedCharacterOcids.mockResolvedValue(['o-main', 'o-sub', 'o-unknown'])
  owners.getNexonAccountIdsOfOcids.mockResolvedValue(new Map([['o-main', 'login-1'], ['o-sub', 'k-sub']]))
})

describe('planInvalidSubKey', () => {
  // 계정을 모르는 캐릭터는 메인 계정의 것으로 부른다. 부계정 키의 문제로 빼지 않는다.
  it('지금 로그인의 부계정 키면 그 키의 계정에 속한 추적 캐릭터만 빼고 나머지를 남긴다', async () => {
    const plan = await planInvalidSubKey('부-키')

    expect(plan).toEqual({ apiKey: '부-키', untrack: ['o-sub'], remaining: ['o-main', 'o-unknown'] })
    expect(destinationOf(plan)).toBe('accounts')
  })

  it('남는 추적 캐릭터가 없으면 캐릭터 설정으로 간다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(['o-sub'])

    expect(destinationOf(await planInvalidSubKey('부-키'))).toBe('characterSetup')
  })

  // 로그인 없이 쓰는 메인 키는 남는 수단이 없다. 어느 키인지 모르면 가릴 수 없다.
  it('메인 키 · 모르는 키 · 키가 실리지 않은 알림은 부계정 키로 다루지 않고 로그인 화면으로 간다', async () => {
    apiKeyStore.getAuthConfig.mockResolvedValue({
      login: null,
      apiKeys: [{ ...부계정키, id: 'k-main', value: '메인-키', loginId: null }],
      mainKeyId: 'k-main',
    })

    for (const apiKey of ['메인-키', '모르는-키', null]) {
      const plan = await planInvalidSubKey(apiKey)
      expect(plan).toBeNull()
      expect(destinationOf(plan)).toBe('signIn')
    }
  })
})

describe('retireInvalidSubKey', () => {
  // 키를 바꿀 때 되돌릴 캐릭터를 키에 먼저 적는다. 빼고 나서 적다가 실패하면 되돌릴 목록을 잃는다.
  it('키에 무효 표시와 뺄 캐릭터를 적은 뒤 그 캐릭터를 추적에서 뺀다', async () => {
    await retireInvalidSubKey({ apiKey: '부-키', untrack: ['o-sub'], remaining: ['o-main'] })

    expect(apiKeyStore.markApiKeyInvalid).toHaveBeenCalledWith('부-키', ['o-sub'])
    expect(untrack.untrackCharacters).toHaveBeenCalledWith(new Set(['o-sub']))
    expect(apiKeyStore.markApiKeyInvalid.mock.invocationCallOrder[0]).toBeLessThan(untrack.untrackCharacters.mock.invocationCallOrder[0]!)
  })
})
