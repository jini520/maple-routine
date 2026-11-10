// 메이플 ID 가 같은 키를 서버에서 잇고 거둔다. 키를 지우면 해시를 다시 만들 수 없어서, 잇기 전에 지우면 그 키로 보낸
// 기록이 서버에서 다른 사람으로 계속 남는다. 로그인이 새 계정 id 를 받으면 키 시절 강화 지출이 기기에서 두 번 세어진다.
import { apiKeyHashHex } from '../../../lib/crypto/api-key-hash'
import type { MapleAccount } from '../../../types'
import type { NexonCredential } from '../../../types/auth'

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn(), setNexonLogin: jest.fn() }))
jest.mock('../../../storage/nexon-account-ids', () => ({ moveNexonAccountRows: jest.fn() }))
jest.mock('../../mvp-grade/character-list', () => ({
  fetchAndRecordCharacterList: jest.fn(),
  fetchUnsavedCharacterList: jest.fn(),
}))
jest.mock('../../../server/api-key-link', () => ({ linkApiKeyOnServer: jest.fn() }))
jest.mock('../reentry-account-id', () => ({ reusableNexonAccountId: jest.fn() }))

const { getAuthConfig, setNexonLogin } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const { moveNexonAccountRows } = jest.requireMock('../../../storage/nexon-account-ids') as Record<string, jest.Mock>
const { fetchAndRecordCharacterList, fetchUnsavedCharacterList } = jest.requireMock('../../mvp-grade/character-list') as Record<
  string,
  jest.Mock
>
const { reusableNexonAccountId } = jest.requireMock('../reentry-account-id') as Record<string, jest.Mock>
const { linkApiKeyOnServer } = jest.requireMock('../../../server/api-key-link') as Record<string, jest.Mock>

import { pruneCoveredApiKeys, saveNexonLogin } from '../prune-covered-keys'

function 계정(accountId: string): MapleAccount {
  return { accountId, characters: [] }
}

const 메이플ID = new Map<string, MapleAccount[]>([
  ['세션', [계정('id-1')]],
  ['같은-키', [계정('id-1')]],
  ['다른-키', [계정('id-2')]],
])

function 키(value: string, id: string, loginId: string | null = null) {
  return { type: 'key', id, label: '', value, loginId }
}

const 로그인 = { type: 'login', id: 'login-id', session: '세션' }

beforeEach(() => {
  jest.resetAllMocks()
  fetchAndRecordCharacterList.mockImplementation(async (credential: NexonCredential) => 메이플ID.get(credential.value) ?? [])
  fetchUnsavedCharacterList.mockImplementation(async (credential: NexonCredential) => 메이플ID.get(credential.value) ?? [])
  reusableNexonAccountId.mockResolvedValue(null)
  setNexonLogin.mockResolvedValue(undefined)
  moveNexonAccountRows.mockResolvedValue(undefined)
  linkApiKeyOnServer.mockResolvedValue({ outcome: 'sent' })
  getAuthConfig.mockResolvedValue({ login: null, mainKeyId: 'k1', apiKeys: [키('같은-키', 'k1'), 키('다른-키', 'k2')] })
})

describe('saveNexonLogin: 로그인 직후', () => {
  it('저장하기 전에 메이플 ID 가 같은 키만 서버에서 잇고, 이은 키를 넘겨 로그인을 저장한다', async () => {
    const order: string[] = []
    linkApiKeyOnServer.mockImplementation(async () => {
      order.push('link')
      return { outcome: 'sent' }
    })
    setNexonLogin.mockImplementation(async () => {
      order.push('save')
    })

    await saveNexonLogin('세션')

    expect(linkApiKeyOnServer).toHaveBeenCalledTimes(1)
    expect(linkApiKeyOnServer).toHaveBeenCalledWith('세션', apiKeyHashHex('같은-키'))
    expect(setNexonLogin).toHaveBeenCalledWith({ session: '세션' }, ['같은-키'], undefined, undefined)
    expect(order).toEqual(['link', 'save'])
  })

  // 지우면 다시 이을 수 없다. 남긴 키는 로그인한 채 앱을 켤 때 다시 다룬다.
  it.each([
    ['응답이 없으면', { outcome: 'no-response' }],
    ['서버가 거절하면', { outcome: 'rejected', status: 403 }],
  ])('%s 그 키를 넘기지 않는다', async (_label, result) => {
    linkApiKeyOnServer.mockResolvedValue(result)

    await saveNexonLogin('세션')

    expect(setNexonLogin).toHaveBeenCalledWith({ session: '세션' }, [], undefined, undefined)
  })

  it('잇기가 던져도 로그인은 저장한다', async () => {
    linkApiKeyOnServer.mockRejectedValue(new Error('끊겼다'))

    await saveNexonLogin('세션')

    expect(setNexonLogin).toHaveBeenCalledWith({ session: '세션' }, [], undefined, undefined)
  })
})

// 같은 넥슨 ID 로 다시 로그인하면서 새 계정 id 를 받으면, 강화 수집기가 이미 받은 날짜를 새 id 로 다시 받아 같은 강화를 한 줄
// 더 적는다. 로그아웃 뒤든 로그인 만료 뒤든 같다.
describe('saveNexonLogin: 거둔 키가 없을 때의 계정 id', () => {
  beforeEach(() => {
    getAuthConfig.mockResolvedValue(null)
  })

  it('로그인의 메이플 ID 가 속했던 옛 계정 id 를 이어 저장한다', async () => {
    reusableNexonAccountId.mockResolvedValue('옛-로그인-id')

    await saveNexonLogin('세션')

    expect(reusableNexonAccountId).toHaveBeenCalledWith([계정('id-1')])
    expect(setNexonLogin).toHaveBeenCalledWith({ session: '세션' }, [], '옛-로그인-id', undefined)
  })

  it('새 로그인인지를 로그인 저장에 그대로 넘긴다', async () => {
    reusableNexonAccountId.mockResolvedValue('옛-로그인-id')

    await saveNexonLogin('세션', { fresh: true })

    expect(setNexonLogin).toHaveBeenCalledWith({ session: '세션' }, [], '옛-로그인-id', { fresh: true })
  })

  // 먼저 적으면 소속 기록의 계정 칸이 덮여 옛 id 를 찾을 수 없다.
  it('로그인의 목록은 계정 id 를 정하기 전이라 소속을 적지 않고 받는다', async () => {
    await saveNexonLogin('세션')

    expect(fetchUnsavedCharacterList).toHaveBeenCalledWith({ type: 'login', value: '세션', accountId: null })
    expect(fetchAndRecordCharacterList).not.toHaveBeenCalled()
  })

  it('키를 거두면 옛 계정 id 가 아니라 거둔 키의 계정 id 를 잇는다', async () => {
    getAuthConfig.mockResolvedValue({ login: null, mainKeyId: 'k1', apiKeys: [키('같은-키', 'k1')] })
    reusableNexonAccountId.mockResolvedValue('옛-로그인-id')

    await saveNexonLogin('세션')

    expect(setNexonLogin).toHaveBeenCalledWith({ session: '세션' }, ['같은-키'], undefined, undefined)
  })
})

describe('pruneCoveredApiKeys: 로그인한 채 앱을 켤 때', () => {
  // 로그인이 자기 id 로 이미 쓴 기록을 이어받을 id 로 옮겨야, 같은 날의 강화 합계가 두 id 에 남지 않는다.
  it('로그인의 옛 id 기록을 이은 키의 id 로 옮긴 뒤 이은 키를 넘겨 저장한다', async () => {
    getAuthConfig.mockResolvedValue({ login: 로그인, mainKeyId: null, apiKeys: [키('같은-키', 'k1', 'login-id'), 키('다른-키', 'k2', 'login-id')] })
    const order: string[] = []
    moveNexonAccountRows.mockImplementation(async () => {
      order.push('move')
    })
    setNexonLogin.mockImplementation(async () => {
      order.push('save')
    })

    await pruneCoveredApiKeys()

    expect(moveNexonAccountRows).toHaveBeenCalledWith(['login-id'], 'k1')
    expect(setNexonLogin).toHaveBeenCalledWith({ session: '세션' }, ['같은-키'], undefined, undefined)
    expect(order).toEqual(['move', 'save'])
  })

  // 옮기지 못한 채 키를 거두면 기록이 주인 없는 id 에 남는다. 키를 남겨 다음에 다시 한다.
  it('기록을 옮기지 못하면 키를 거두지 않는다', async () => {
    getAuthConfig.mockResolvedValue({ login: 로그인, mainKeyId: null, apiKeys: [키('같은-키', 'k1', 'login-id')] })
    moveNexonAccountRows.mockRejectedValue(new Error('디스크'))

    await pruneCoveredApiKeys()

    expect(setNexonLogin).not.toHaveBeenCalledWith(expect.anything(), ['같은-키'], undefined, undefined)
  })

  it('서버가 받지 못한 키는 거두지 않는다', async () => {
    getAuthConfig.mockResolvedValue({ login: 로그인, mainKeyId: null, apiKeys: [키('같은-키', 'k1', 'login-id')] })
    linkApiKeyOnServer.mockResolvedValue({ outcome: 'no-response' })

    await pruneCoveredApiKeys()

    expect(moveNexonAccountRows).not.toHaveBeenCalled()
    expect(setNexonLogin).not.toHaveBeenCalled()
  })

  it.each([
    ['로그인이 없으면', { login: null, mainKeyId: 'k1', apiKeys: [키('같은-키', 'k1')] }],
    ['키가 없으면', { login: 로그인, mainKeyId: null, apiKeys: [] }],
    // 다른 로그인에 귀속된 키는 이 로그인이 부르지 않는 키다.
    ['이 로그인의 부계정 키가 없으면', { login: 로그인, mainKeyId: null, apiKeys: [키('같은-키', 'k1', '다른-로그인-id')] }],
  ])('%s 아무것도 부르지 않는다', async (_label, config) => {
    getAuthConfig.mockResolvedValue(config)

    await pruneCoveredApiKeys()

    expect(fetchAndRecordCharacterList).not.toHaveBeenCalled()
    expect(linkApiKeyOnServer).not.toHaveBeenCalled()
  })
})
