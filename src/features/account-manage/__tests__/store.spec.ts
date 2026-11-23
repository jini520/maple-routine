// 계정 관리의 추가 · 변경 · 삭제. 부계정은 기기마다 따로 관리하고, 서버는 어느 넥슨 계정이 그 로그인의 부계정인지만 적는다.
// 부계정은 넥슨 ID 하나에만 등록되어, 지우기는 서버의 등록을 먼저 해제해야 다른 넥슨 ID 가 그 계정을 등록할 수 있다.
import { apiKeyHashHex } from '../../../lib/crypto/api-key-hash'
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import type { NexonAuthConfig } from '../../../types'

jest.mock('../../../storage/api-key', () => ({
  getAuthConfig: jest.fn(),
  addSubApiKey: jest.fn(async () => undefined),
  replaceApiKeyValue: jest.fn(async () => undefined),
  removeApiKey: jest.fn(async () => undefined),
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
jest.mock('../../../server/accounts', () => ({ registerSubAccountOnServer: jest.fn(), unregisterSubAccountOnServer: jest.fn() }))
jest.mock('../../schedule-sync/save-tracked', () => ({ saveTrackedCharacters: jest.fn(async () => undefined) }))
jest.mock('../../mvp-grade/character-list', () => ({
  readCachedCharacterListOfAccount: jest.fn(() => undefined),
  fetchCharacterListsCached: jest.fn(async () => []),
  fetchUnsavedCharacterList: jest.fn(async () => []),
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
const serverState = mocked<Record<string, unknown>>('../../../storage/server-accounts')
const owners = mocked<Record<string, unknown>>('../../../storage/character-accounts')
const selection = mocked<Record<string, unknown>>('../../../storage/character-selection')
const server = mocked<Record<string, unknown>>('../../../server/accounts')
const characterList = mocked<Record<string, unknown>>('../../mvp-grade/character-list')
const validate = mocked<Record<string, unknown>>('../validate-key')
const tracked = mocked<Record<string, unknown>>('../../schedule-sync/save-tracked')

const { useAccountManageStore } = require('../store') as typeof import('../store')
const { useToastStore } = require('../../toast/store') as typeof import('../../toast/store')

const h = nexonIdHashHex
const 로그인 = { type: 'login' as const, id: 'login-1', session: 'S' }
const 부계정키 = { type: 'key' as const, id: 'k-sub', label: '', value: '부-키', loginId: 'login-1' }

function 설정(...apiKeys: NexonAuthConfig['apiKeys']): NexonAuthConfig {
  return { login: 로그인, apiKeys, mainKeyId: null }
}

const 통과 = { outcome: 'ok', accounts: [{ accountId: 'm-new', characters: [] }], mapleIdHashes: [h('m-new')] }

beforeEach(async () => {
  jest.clearAllMocks()
  apiKeyStore.getAuthConfig.mockResolvedValue(설정(부계정키))
  serverState.getServerAccounts.mockResolvedValue({ reported: {}, registered: [`login-1:${apiKeyHashHex('부-키')}`] })
  owners.getMapleIdsByNexonAccount.mockResolvedValue(new Map([['login-1', ['m-main']], ['k-sub', ['m-sub']]]))
  owners.getCharacterAccountSightings.mockResolvedValue([])
  server.registerSubAccountOnServer.mockResolvedValue('registered')
  server.unregisterSubAccountOnServer.mockResolvedValue({ outcome: 'sent' })
  selection.getTrackedCharacterOcids.mockResolvedValue([])
  useToastStore.setState({ toasts: [] } as never)
  await useAccountManageStore.getState().load()
})

describe('추가', () => {
  it('검증을 거쳐 메이플 ID 해시로 서버에 등록한 뒤 그 로그인의 부계정 키로 저장한다', async () => {
    validate.checkApiKey.mockResolvedValue(통과)

    await expect(useAccountManageStore.getState().addKey('새-키')).resolves.toEqual({ outcome: 'saved' })

    // 막는 겹침은 로그인의 메이플 ID 다. 부계정과 겹치면 막지 않고 그 계정의 키를 바꿀지 묻는다.
    expect(validate.checkApiKey).toHaveBeenCalledWith('새-키', { taken: [h('m-main')], target: null })
    // 1.0.15 서버는 부계정을 메이플 ID 로 찾고 키 해시를 받지 않는다.
    expect(server.registerSubAccountOnServer).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, [h('m-new')])
    expect(server.registerSubAccountOnServer.mock.invocationCallOrder[0]).toBeLessThan(apiKeyStore.addSubApiKey.mock.invocationCallOrder[0]!)
    expect(apiKeyStore.addSubApiKey).toHaveBeenCalledWith('새-키', 'login-1', 'uuid-new')
    expect(characterList.recordCharacterList).toHaveBeenCalledWith(통과.accounts, 'uuid-new')
  })

  // 기기가 로그인의 메이플 ID 를 다 알지 못하면 검증을 지나도 서버가 같은 넥슨 ID 를 알아본다.
  it('서버가 같은 넥슨 ID 라고 거절하면 저장하지 않고 이미 등록된 계정으로 알린다', async () => {
    validate.checkApiKey.mockResolvedValue(통과)
    server.registerSubAccountOnServer.mockResolvedValue('same_account')

    await expect(useAccountManageStore.getState().addKey('새-키')).resolves.toEqual({ outcome: 'rejected', reason: 'alreadyRegistered' })
    expect(apiKeyStore.addSubApiKey).not.toHaveBeenCalled()
  })

  // 다른 넥슨 ID 가 그 계정을 먼저 등록했거나 두 로그인이 서로를 부계정으로 두게 되는 등록은 다시 보내도 같은 답이다.
  it.each([
    ['registered_elsewhere', 'registeredElsewhere'],
    ['has_sub_accounts', 'hasSubAccounts'],
    ['login_is_sub_account', 'loginIsSubAccount'],
  ])('서버가 %s 로 거절하면 저장하지 않고 그 이유를 돌려준다', async (code, reason) => {
    validate.checkApiKey.mockResolvedValue(통과)
    server.registerSubAccountOnServer.mockResolvedValue(code)

    await expect(useAccountManageStore.getState().addKey('새-키')).resolves.toEqual({ outcome: 'rejected', reason })
    expect(apiKeyStore.addSubApiKey).not.toHaveBeenCalled()
    expect(characterList.recordCharacterList).not.toHaveBeenCalled()
  })

  // 등록은 다음 서버 전송 회차가 다시 한다. 그 사이에는 기기의 키로 그 계정을 부른다.
  it('서버가 받지 못하면 기기에 저장한다', async () => {
    validate.checkApiKey.mockResolvedValue(통과)
    server.registerSubAccountOnServer.mockResolvedValue('failed')

    await expect(useAccountManageStore.getState().addKey('새-키')).resolves.toEqual({ outcome: 'saved' })
    expect(apiKeyStore.addSubApiKey).toHaveBeenCalled()
  })

  // 같은 넥슨 계정의 키를 새로 받은 사용자가 그 계정의 상세를 찾아가지 않아도 되게 한다.
  it('등록된 부계정과 겹치면 저장하지 않고 그 계정을 돌려주고, 바꾸기를 고르면 검증을 다시 하지 않고 그 계정의 키를 바꾼다', async () => {
    validate.checkApiKey.mockResolvedValue({ ...통과, mapleIdHashes: [h('m-sub')] })

    await expect(useAccountManageStore.getState().addKey('같은-계정-키')).resolves.toEqual({
      outcome: 'existing',
      accountKey: 'k-sub',
      label: 'API 키 1 계정',
    })
    expect(server.registerSubAccountOnServer).not.toHaveBeenCalled()
    expect(apiKeyStore.addSubApiKey).not.toHaveBeenCalled()

    await expect(useAccountManageStore.getState().replaceWithKey('k-sub', '같은-계정-키')).resolves.toEqual({ outcome: 'saved' })

    expect(validate.checkApiKey).toHaveBeenCalledTimes(1)
    expect(apiKeyStore.replaceApiKeyValue).toHaveBeenCalledWith('k-sub', '같은-계정-키')
    expect(server.registerSubAccountOnServer).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, [h('m-sub')])
  })

  it('검증에 걸리면 서버에도 기기에도 적지 않는다', async () => {
    validate.checkApiKey.mockResolvedValue({ outcome: 'rejected', reason: 'alreadyRegistered' })

    await expect(useAccountManageStore.getState().addKey('새-키')).resolves.toEqual({ outcome: 'rejected', reason: 'alreadyRegistered' })
    expect(server.registerSubAccountOnServer).not.toHaveBeenCalled()
    expect(apiKeyStore.addSubApiKey).not.toHaveBeenCalled()
  })
})

describe('변경', () => {
  it('변경은 그 계정을 빼고 겹침을 보고, 메이플 ID 해시로 다시 등록한 뒤 같은 계정 id 의 키 값만 바꾼다', async () => {
    validate.checkApiKey.mockResolvedValue({ ...통과, mapleIdHashes: [h('m-sub')] })

    await expect(useAccountManageStore.getState().changeKey('k-sub', '새-부-키')).resolves.toEqual({ outcome: 'saved' })

    expect(validate.checkApiKey).toHaveBeenCalledWith('새-부-키', { taken: [h('m-main')], target: [h('m-sub')] })
    expect(server.registerSubAccountOnServer).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, [h('m-sub')])
    expect(server.registerSubAccountOnServer.mock.invocationCallOrder[0]).toBeLessThan(apiKeyStore.replaceApiKeyValue.mock.invocationCallOrder[0]!)
    expect(apiKeyStore.replaceApiKeyValue).toHaveBeenCalledWith('k-sub', '새-부-키')
    expect(apiKeyStore.addSubApiKey).not.toHaveBeenCalled()
  })

  it('서버가 등록을 거절하면 키를 바꾸지 않고 그 이유를 돌려준다', async () => {
    validate.checkApiKey.mockResolvedValue({ ...통과, mapleIdHashes: [h('m-sub')] })
    server.registerSubAccountOnServer.mockResolvedValue('registered_elsewhere')

    await expect(useAccountManageStore.getState().changeKey('k-sub', '새-부-키')).resolves.toEqual({
      outcome: 'rejected',
      reason: 'registeredElsewhere',
    })
    expect(apiKeyStore.replaceApiKeyValue).not.toHaveBeenCalled()
  })

  it('서버가 받지 못하면 키를 바꾸고 다음 회차가 다시 등록한다', async () => {
    validate.checkApiKey.mockResolvedValue({ ...통과, mapleIdHashes: [h('m-sub')] })
    server.registerSubAccountOnServer.mockResolvedValue('failed')

    await expect(useAccountManageStore.getState().changeKey('k-sub', '새-부-키')).resolves.toEqual({ outcome: 'saved' })
    expect(apiKeyStore.replaceApiKeyValue).toHaveBeenCalledWith('k-sub', '새-부-키')
  })
})

// 키가 무효가 되면 그 계정의 추적 캐릭터를 빼 두었다. 같은 계정의 새 키로 바꾸면 그대로 이어지게 되돌린다.
it('무효 표시가 붙은 키를 바꾸면 뺐던 캐릭터를 추적 목록 끝에 겹치지 않게 다시 넣는다', async () => {
  apiKeyStore.getAuthConfig.mockResolvedValue(설정({ ...부계정키, invalid: { untrackedOcids: ['o-sub', 'o-main'] } }))
  selection.getTrackedCharacterOcids.mockResolvedValue(['o-main'])
  await useAccountManageStore.getState().load()
  validate.checkApiKey.mockResolvedValue({ ...통과, mapleIdHashes: [h('m-sub')] })

  await expect(useAccountManageStore.getState().changeKey('k-sub', '새-부-키')).resolves.toEqual({ outcome: 'saved' })

  expect(apiKeyStore.replaceApiKeyValue).toHaveBeenCalledWith('k-sub', '새-부-키')
  expect(tracked.saveTrackedCharacters).toHaveBeenCalledWith(['o-main', 'o-sub'])
})

describe('삭제', () => {
  // 기기에서만 지우면 서버에 등록이 남아 다른 넥슨 ID 가 그 계정을 등록하지 못한다.
  it('서버의 등록을 먼저 해제하고, 받으면 이 기기의 키와 그 계정의 메이플 ID 에 속한 추적 캐릭터를 뺀다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(['o-main', 'o-sub'])
    owners.getCharacterAccountSightings.mockResolvedValue([
      { ocid: 'o-main', name: '본캐', accountId: 'm-main', firstSeenOn: '2026-11-01', lastSeenOn: '2026-11-11' },
      { ocid: 'o-sub', name: '부캐', accountId: 'm-sub', firstSeenOn: '2026-11-01', lastSeenOn: '2026-11-11' },
    ])

    await expect(useAccountManageStore.getState().removeAccount('k-sub')).resolves.toBe('removed')

    expect(server.unregisterSubAccountOnServer).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, [h('m-sub')])
    expect(server.unregisterSubAccountOnServer.mock.invocationCallOrder[0]).toBeLessThan(apiKeyStore.removeApiKey.mock.invocationCallOrder[0]!)
    expect(apiKeyStore.removeApiKey).toHaveBeenCalledWith('부-키')
    expect(selection.setTrackedCharacterOcids).toHaveBeenCalledWith(['o-main'])
    expect(mockResolveFromStorage).not.toHaveBeenCalled()
  })

  // 같은 키를 다시 넣었을 때 등록이 응답 없이 끝나면, 남은 적은 값 때문에 회차가 다시 등록하지 않는다.
  it('해제하면 서버에 등록했다고 적은 그 키의 값을 뺀다', async () => {
    await useAccountManageStore.getState().removeAccount('k-sub')

    expect(serverState.setServerAccounts).toHaveBeenCalledWith({ reported: {}, registered: [] })
  })

  it.each([
    ['응답이 없으면', { outcome: 'no-response' }],
    ['서버가 거절하면', { outcome: 'rejected', status: 401 }],
  ])('%s 아무것도 지우지 않고 실패를 알린다', async (_label, result) => {
    server.unregisterSubAccountOnServer.mockResolvedValue(result)

    await expect(useAccountManageStore.getState().removeAccount('k-sub')).resolves.toBe('failed')

    expect(apiKeyStore.removeApiKey).not.toHaveBeenCalled()
    expect(selection.setTrackedCharacterOcids).not.toHaveBeenCalled()
    expect(serverState.setServerAccounts).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ variant: 'error', message: 'API 키를 삭제하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }),
    ])
  })

  // 캐릭터가 없는 메이플 ID 는 기기의 소속 표에 남지 않는다. 등록은 넥슨 목록의 메이플 ID 로 했으므로 같은 목록으로 해제한다.
  it('기기가 그 계정의 메이플 ID 를 모르면 그 키로 넥슨 목록을 받아 거기 있는 메이플 ID 로 해제한다', async () => {
    owners.getMapleIdsByNexonAccount.mockResolvedValue(new Map([['login-1', ['m-main']]]))
    await useAccountManageStore.getState().load()
    characterList.fetchUnsavedCharacterList.mockResolvedValue([{ accountId: 'm-sub', characters: [] }])

    await expect(useAccountManageStore.getState().removeAccount('k-sub')).resolves.toBe('removed')

    expect(characterList.fetchUnsavedCharacterList).toHaveBeenCalledWith({ type: 'key', value: '부-키', accountId: 'k-sub' })
    expect(server.unregisterSubAccountOnServer).toHaveBeenCalledWith({ Authorization: 'Bearer S' }, [h('m-sub')])
    expect(apiKeyStore.removeApiKey).toHaveBeenCalledWith('부-키')
  })

  it('목록으로도 메이플 ID 를 얻지 못하면 아무것도 지우지 않고 실패를 알린다', async () => {
    owners.getMapleIdsByNexonAccount.mockResolvedValue(new Map([['login-1', ['m-main']]]))
    await useAccountManageStore.getState().load()
    characterList.fetchUnsavedCharacterList.mockRejectedValue(new Error('무효 키'))

    await expect(useAccountManageStore.getState().removeAccount('k-sub')).resolves.toBe('failed')

    expect(server.unregisterSubAccountOnServer).not.toHaveBeenCalled()
    expect(apiKeyStore.removeApiKey).not.toHaveBeenCalled()
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

// 해제는 서버가 기준이다. 남기면 동기화가 그 키를 다시 등록해 다른 기기의 해제를 되돌린다.
describe('다른 기기가 해제한 부계정', () => {
  const { forgetReleasedSubAccounts } = require('../store') as typeof import('../store')

  it('빠진 메이플 ID 를 든 부계정 키를 지우고 그 계정의 추적 캐릭터를 빼며, 서버 해제는 부르지 않는다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(['o-main', 'o-sub'])
    owners.getCharacterAccountSightings.mockResolvedValue([
      { ocid: 'o-main', name: '본캐', accountId: 'm-main', firstSeenOn: '2026-11-01', lastSeenOn: '2026-11-11' },
      { ocid: 'o-sub', name: '부캐', accountId: 'm-sub', firstSeenOn: '2026-11-01', lastSeenOn: '2026-11-11' },
    ])

    await forgetReleasedSubAccounts(new Set([h('m-sub')]))

    expect(server.unregisterSubAccountOnServer).not.toHaveBeenCalled()
    expect(apiKeyStore.removeApiKey).toHaveBeenCalledWith('부-키')
    expect(serverState.setServerAccounts).toHaveBeenCalledWith({ reported: {}, registered: [] })
    expect(selection.setTrackedCharacterOcids).toHaveBeenCalledWith(['o-main'])
  })

  it('빠진 메이플 ID 를 든 키가 없거나 다른 로그인의 키면 아무것도 지우지 않는다', async () => {
    apiKeyStore.getAuthConfig.mockResolvedValue(설정({ ...부계정키, loginId: 'login-2' }))

    await forgetReleasedSubAccounts(new Set([h('m-sub'), h('m-other')]))

    expect(apiKeyStore.removeApiKey).not.toHaveBeenCalled()
    expect(selection.setTrackedCharacterOcids).not.toHaveBeenCalled()
  })
})
