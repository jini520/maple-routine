// 계정 관리의 추가 · 변경 · 삭제. 서버가 거절했는데 기기에 키를 두면 서버 목록에 없는 키가 되어 보이지도 않고 지울 수도 없다.
// 기기에서만 지우면 다음에 받은 서버 목록에 그 계정이 다시 선다.
import { apiKeyHashHex } from '../../../lib/crypto/api-key-hash'
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import { storedApiKeyHashHex } from '../../../lib/sub-account-keys'
import type { NexonAuthConfig } from '../../../types'

jest.mock('../../../storage/api-key', () => ({
  getAuthConfig: jest.fn(),
  addSubApiKey: jest.fn(async () => undefined),
  replaceApiKeyValue: jest.fn(async () => undefined),
  removeApiKey: jest.fn(async () => undefined),
}))
jest.mock('../../../storage/server-sub-accounts', () => ({
  getServerSubAccounts: jest.fn(),
  setServerSubAccounts: jest.fn(async () => undefined),
}))
jest.mock('../../../storage/server-accounts', () => ({
  getServerAccounts: jest.fn(),
  setServerAccounts: jest.fn(async () => undefined),
}))
jest.mock('../../../storage/character-accounts', () => ({
  getMapleIdsByNexonAccount: jest.fn(),
  getCharacterAccountSightings: jest.fn(),
}))
jest.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: jest.fn(),
  setTrackedCharacterOcids: jest.fn(async () => undefined),
}))
jest.mock('../../../server/accounts', () => ({
  listSubAccountsOnServer: jest.fn(),
  registerSubAccountOnServer: jest.fn(),
  unregisterSubAccountOnServer: jest.fn(),
}))
jest.mock('../../mvp-grade/character-list', () => ({
  readCachedCharacterListOfAccount: jest.fn(() => undefined),
  fetchCharacterListsCached: jest.fn(async () => []),
  recordCharacterList: jest.fn(),
}))
jest.mock('../../auth/current-credential', () => ({ currentCredentials: jest.fn(async () => []) }))
jest.mock('../../auth/reentry-account-id', () => ({ reusableNexonAccountId: jest.fn(async () => null) }))
jest.mock('../../../native/uuid', () => ({ randomUuid: () => 'uuid-new' }))
jest.mock('../validate-key', () => ({ checkApiKey: jest.fn() }))
jest.mock('../../character-selection/store', () => ({
  useCharacterSelectionStore: { getState: () => ({ reloadRepresentative: jest.fn(async () => undefined) }) },
}))
jest.mock('../../app-entry/store', () => ({ useAppEntryStore: { getState: () => ({ resolveFromStorage: mockResolveFromStorage }) } }))
const mockResolveFromStorage = jest.fn(async () => undefined)

const mocked = <T extends Record<string, unknown>>(path: string) => jest.requireMock(path) as { [K in keyof T]: jest.Mock }
const apiKeyStore = mocked<Record<string, unknown>>('../../../storage/api-key')
const subList = mocked<Record<string, unknown>>('../../../storage/server-sub-accounts')
const serverState = mocked<Record<string, unknown>>('../../../storage/server-accounts')
const owners = mocked<Record<string, unknown>>('../../../storage/character-accounts')
const selection = mocked<Record<string, unknown>>('../../../storage/character-selection')
const server = mocked<Record<string, unknown>>('../../../server/accounts')
const characterList = mocked<Record<string, unknown>>('../../mvp-grade/character-list')
const validate = mocked<Record<string, unknown>>('../validate-key')

const { useAccountManageStore } = require('../store') as typeof import('../store')
const { useToastStore } = require('../../toast/store') as typeof import('../../toast/store')

const h = nexonIdHashHex
const 로그인 = { type: 'login' as const, id: 'login-1', session: 'S' }
const 부계정키 = { type: 'key' as const, id: 'k-sub', label: '', value: '부-키', loginId: 'login-1' }

function 설정(...apiKeys: (typeof 부계정키)[]): NexonAuthConfig {
  return { login: 로그인, apiKeys, mainKeyId: null }
}

const 통과 = { outcome: 'ok', accounts: [{ accountId: 'm-new', characters: [] }], mapleIdHashes: [h('m-new')] }

beforeEach(async () => {
  jest.clearAllMocks()
  apiKeyStore.getAuthConfig.mockResolvedValue(설정(부계정키))
  subList.getServerSubAccounts.mockResolvedValue({
    loginId: 'login-1',
    subAccounts: [{ apiKeyHashes: [storedApiKeyHashHex('부-키')], mapleIds: [h('m-sub')] }],
  })
  serverState.getServerAccounts.mockResolvedValue({ reported: {}, registered: [`login-1:${apiKeyHashHex('부-키')}`] })
  owners.getMapleIdsByNexonAccount.mockResolvedValue(new Map([['login-1', ['m-main']], ['k-sub', ['m-sub']]]))
  owners.getCharacterAccountSightings.mockResolvedValue([])
  server.listSubAccountsOnServer.mockResolvedValue({ outcome: 'failed' })
  server.registerSubAccountOnServer.mockResolvedValue('registered')
  server.unregisterSubAccountOnServer.mockResolvedValue('removed')
  selection.getTrackedCharacterOcids.mockResolvedValue([])
  useToastStore.setState({ toasts: [] } as never)
  await useAccountManageStore.getState().load()
})

describe('추가', () => {
  it('검증을 거쳐 서버에 등록한 뒤 그 로그인의 부계정 키로 저장한다', async () => {
    validate.checkApiKey.mockResolvedValue(통과)

    await expect(useAccountManageStore.getState().addKey('새-키')).resolves.toEqual({ outcome: 'saved' })

    // 겹침은 지금 계정들의 메이플 ID 로 본다.
    expect(validate.checkApiKey).toHaveBeenCalledWith('새-키', { taken: [h('m-main'), h('m-sub')], target: null })
    expect(server.registerSubAccountOnServer).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, apiKeyHashHex('새-키'), [h('m-new')])
    expect(server.registerSubAccountOnServer.mock.invocationCallOrder[0]).toBeLessThan(apiKeyStore.addSubApiKey.mock.invocationCallOrder[0]!)
    expect(apiKeyStore.addSubApiKey).toHaveBeenCalledWith('새-키', 'login-1', 'uuid-new')
    expect(characterList.recordCharacterList).toHaveBeenCalledWith(통과.accounts, 'uuid-new')
  })

  it('서버가 다섯째라고 거절하면 저장하지 않는다', async () => {
    validate.checkApiKey.mockResolvedValue(통과)
    server.registerSubAccountOnServer.mockResolvedValue('limit')

    await expect(useAccountManageStore.getState().addKey('새-키')).resolves.toEqual({ outcome: 'limit' })
    expect(apiKeyStore.addSubApiKey).not.toHaveBeenCalled()
  })

  // 등록은 다음 서버 전송 회차가 다시 한다. 그 사이에는 기기의 키로 그 계정을 부른다.
  it('서버 응답이 없으면 기기에 저장한다', async () => {
    validate.checkApiKey.mockResolvedValue(통과)
    server.registerSubAccountOnServer.mockResolvedValue('failed')

    await expect(useAccountManageStore.getState().addKey('새-키')).resolves.toEqual({ outcome: 'saved' })
    expect(apiKeyStore.addSubApiKey).toHaveBeenCalled()
  })

  it('검증에 걸리면 서버에도 기기에도 적지 않는다', async () => {
    validate.checkApiKey.mockResolvedValue({ outcome: 'rejected', reason: 'alreadyRegistered' })

    await expect(useAccountManageStore.getState().addKey('새-키')).resolves.toEqual({ outcome: 'rejected', reason: 'alreadyRegistered' })
    expect(server.registerSubAccountOnServer).not.toHaveBeenCalled()
    expect(apiKeyStore.addSubApiKey).not.toHaveBeenCalled()
  })
})

describe('변경 · 입력', () => {
  it('변경은 그 계정을 빼고 겹침을 보고, 같은 계정 id 의 키 값만 바꾼 뒤 새 키로 다시 등록한다', async () => {
    validate.checkApiKey.mockResolvedValue({ ...통과, mapleIdHashes: [h('m-sub')] })

    await expect(useAccountManageStore.getState().changeKey('k-sub', '새-부-키')).resolves.toEqual({ outcome: 'saved' })

    expect(validate.checkApiKey).toHaveBeenCalledWith('새-부-키', { taken: [h('m-main')], target: [h('m-sub')] })
    expect(apiKeyStore.replaceApiKeyValue).toHaveBeenCalledWith('k-sub', '새-부-키')
    expect(apiKeyStore.addSubApiKey).not.toHaveBeenCalled()
    expect(server.registerSubAccountOnServer).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, apiKeyHashHex('새-부-키'), [h('m-sub')])
  })

  it('이 기기에 키가 없는 계정은 서버 줄의 메이플 ID 로 겹침을 보고 새 키를 더한다', async () => {
    apiKeyStore.getAuthConfig.mockResolvedValue(설정())
    serverState.getServerAccounts.mockResolvedValue({ reported: {}, registered: [] })
    subList.getServerSubAccounts.mockResolvedValue({ loginId: 'login-1', subAccounts: [{ apiKeyHashes: ['남의-기기'], mapleIds: [h('m-far')] }] })
    await useAccountManageStore.getState().load()
    validate.checkApiKey.mockResolvedValue({ ...통과, mapleIdHashes: [h('m-far')] })

    await expect(useAccountManageStore.getState().changeKey(`server:${h('m-far')}`, '넣은-키')).resolves.toEqual({ outcome: 'saved' })

    expect(validate.checkApiKey).toHaveBeenCalledWith('넣은-키', { taken: [h('m-main')], target: [h('m-far')] })
    expect(apiKeyStore.addSubApiKey).toHaveBeenCalledWith('넣은-키', 'login-1', 'uuid-new')
  })
})

describe('삭제', () => {
  it('서버에서 등록을 지운 뒤 키와 그 계정의 메이플 ID 에 속한 추적 캐릭터를 뺀다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(['o-main', 'o-sub'])
    owners.getCharacterAccountSightings.mockResolvedValue([
      { ocid: 'o-main', name: '본캐', accountId: 'm-main', firstSeenOn: '2026-11-01', lastSeenOn: '2026-11-11' },
      { ocid: 'o-sub', name: '부캐', accountId: 'm-sub', firstSeenOn: '2026-11-01', lastSeenOn: '2026-11-11' },
    ])

    await expect(useAccountManageStore.getState().removeAccount('k-sub')).resolves.toBe('removed')

    expect(server.unregisterSubAccountOnServer).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, h('m-sub'))
    expect(apiKeyStore.removeApiKey).toHaveBeenCalledWith('부-키')
    expect(selection.setTrackedCharacterOcids).toHaveBeenCalledWith(['o-main'])
    expect(subList.setServerSubAccounts).toHaveBeenCalledWith({ loginId: 'login-1', subAccounts: [] })
    expect(mockResolveFromStorage).not.toHaveBeenCalled()
  })

  it('서버에서 지우지 못하면 아무것도 지우지 않고 실패를 알린다', async () => {
    server.unregisterSubAccountOnServer.mockResolvedValue('failed')

    await expect(useAccountManageStore.getState().removeAccount('k-sub')).resolves.toBe('failed')

    expect(apiKeyStore.removeApiKey).not.toHaveBeenCalled()
    expect(selection.setTrackedCharacterOcids).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe('API 키를 삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
  })

  it('추적 캐릭터가 하나도 남지 않으면 진입 단계를 다시 판정해 캐릭터 설정으로 보낸다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(['o-sub'])
    owners.getCharacterAccountSightings.mockResolvedValue([
      { ocid: 'o-sub', name: '부캐', accountId: 'm-sub', firstSeenOn: '2026-11-01', lastSeenOn: '2026-11-11' },
    ])

    await useAccountManageStore.getState().removeAccount('k-sub')

    expect(selection.setTrackedCharacterOcids).toHaveBeenCalledWith([])
    expect(mockResolveFromStorage).toHaveBeenCalled()
  })
})
