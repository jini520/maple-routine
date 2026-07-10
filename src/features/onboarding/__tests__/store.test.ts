import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount } from '../../../types'
import { NexonAuthError, NexonNetworkError, NexonRateLimitError } from '../../../nexon/errors'
import { initialOnboardingState } from '../state'

const { fetchCharacterListMock } = vi.hoisted(() => ({
  fetchCharacterListMock: vi.fn(),
}))

const {
  getAuthConfigMock,
  setApiKeyMock,
  setSelectedAccountIdMock,
  clearAuthConfigMock,
} = vi.hoisted(() => ({
  getAuthConfigMock: vi.fn(),
  setApiKeyMock: vi.fn(),
  setSelectedAccountIdMock: vi.fn(),
  clearAuthConfigMock: vi.fn(),
}))

vi.mock('../../../nexon/client', () => ({
  fetchCharacterList: fetchCharacterListMock,
}))

vi.mock('../../../storage/api-key', () => ({
  getAuthConfig: getAuthConfigMock,
  setApiKey: setApiKeyMock,
  setSelectedAccountId: setSelectedAccountIdMock,
  clearAuthConfig: clearAuthConfigMock,
}))

import { useOnboardingStore } from '../store'

function account(accountId: string): MapleAccount {
  return {
    accountId,
    characters: [
      {
        ocid: `ocid-${accountId}`,
        name: `캐릭터-${accountId}`,
        world: '베라',
        jobClass: '렌',
        level: 200,
      },
    ],
  }
}

beforeEach(() => {
  useOnboardingStore.setState(initialOnboardingState)
  setApiKeyMock.mockResolvedValue(undefined)
  setSelectedAccountIdMock.mockResolvedValue(undefined)
  clearAuthConfigMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('useOnboardingStore.restoreFromStorage', () => {
  it('저장된 게 없으면 상태 변화가 없다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await useOnboardingStore.getState().restoreFromStorage()

    expect(useOnboardingStore.getState()).toMatchObject(initialOnboardingState)
    expect(fetchCharacterListMock).not.toHaveBeenCalled()
  })

  it('selectedAccountId까지 저장돼 있으면 즉시 completed 상태가 된다', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: 'acc-1' })

    await useOnboardingStore.getState().restoreFromStorage()

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('completed')
    expect(state.selectedAccountId).toBe('acc-1')
    expect(fetchCharacterListMock).not.toHaveBeenCalled()
  })

  it('apiKey만 있으면 fetchCharacterList를 다시 호출해 재개한다 (계정 1개면 자동 completed)', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useOnboardingStore.getState().restoreFromStorage()

    expect(fetchCharacterListMock).toHaveBeenCalledWith('key-1')
    const state = useOnboardingStore.getState()
    expect(state.status).toBe('completed')
    expect(state.selectedAccountId).toBe('acc-1')
    expect(setSelectedAccountIdMock).toHaveBeenCalledWith('acc-1')
  })

  it('apiKey만 있고 계정이 2개 이상이면 selectingAccount로 재개한다', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })
    const accounts = [account('acc-1'), account('acc-2')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useOnboardingStore.getState().restoreFromStorage()

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('selectingAccount')
    expect(state.accounts).toEqual(accounts)
    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
  })

  it('apiKey만 있는 상태에서 재조회가 실패하면 error 상태가 된다', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })
    fetchCharacterListMock.mockRejectedValue(new NexonAuthError('invalid'))

    await useOnboardingStore.getState().restoreFromStorage()

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'invalidApiKey' })
  })
})

describe('useOnboardingStore.submitApiKey', () => {
  it('계정이 1개면 setSelectedAccountId까지 자동 호출되고 completed가 된다', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useOnboardingStore.getState().submitApiKey('key-1')

    expect(setApiKeyMock).toHaveBeenCalledWith('key-1')
    expect(setSelectedAccountIdMock).toHaveBeenCalledWith('acc-1')
    const state = useOnboardingStore.getState()
    expect(state.status).toBe('completed')
    expect(state.selectedAccountId).toBe('acc-1')
  })

  it('계정이 2개 이상이면 selectingAccount가 되고 setSelectedAccountId는 호출되지 않는다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useOnboardingStore.getState().submitApiKey('key-1')

    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    const state = useOnboardingStore.getState()
    expect(state.status).toBe('selectingAccount')
    expect(state.accounts).toEqual(accounts)
  })

  it('NexonAuthError를 만나면 invalidApiKey error 상태가 된다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonAuthError('invalid'))

    await useOnboardingStore.getState().submitApiKey('key-1')

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'invalidApiKey' })
    expect(setApiKeyMock).not.toHaveBeenCalled()
  })

  it('NexonRateLimitError를 만나면 rateLimited error 상태가 된다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonRateLimitError('rate limited'))

    await useOnboardingStore.getState().submitApiKey('key-1')

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'rateLimited' })
  })

  it('그 외 에러(NexonNetworkError 포함)를 만나면 network error 상태가 된다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonNetworkError('network fail'))

    await useOnboardingStore.getState().submitApiKey('key-1')

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'network' })
  })

  it('계정 1개 자동완료 시 setSelectedAccountId가 실패하면 completed가 되지 않고 storageWriteFailed error가 된다', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)
    setSelectedAccountIdMock.mockRejectedValue(new Error('disk full'))

    await useOnboardingStore.getState().submitApiKey('key-1')

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'storageWriteFailed' })
  })
})

describe('useOnboardingStore.selectAccount', () => {
  it('저장에 성공하면 completed 상태가 된다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    useOnboardingStore.setState({
      status: 'selectingAccount',
      accounts,
      selectedAccountId: null,
      error: null,
    })

    await useOnboardingStore.getState().selectAccount('acc-2')

    expect(setSelectedAccountIdMock).toHaveBeenCalledWith('acc-2')
    const state = useOnboardingStore.getState()
    expect(state.status).toBe('completed')
    expect(state.selectedAccountId).toBe('acc-2')
  })

  it('저장이 실패하면 completed로 넘어가지 않고 storageWriteFailed error가 된다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    useOnboardingStore.setState({
      status: 'selectingAccount',
      accounts,
      selectedAccountId: null,
      error: null,
    })
    setSelectedAccountIdMock.mockRejectedValue(new Error('disk full'))

    await useOnboardingStore.getState().selectAccount('acc-2')

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'storageWriteFailed' })
  })
})

describe('useOnboardingStore.reset', () => {
  it('clearAuthConfig를 호출하고 상태를 initialOnboardingState로 되돌린다', async () => {
    useOnboardingStore.setState({
      status: 'completed',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
    })

    await useOnboardingStore.getState().reset()

    expect(clearAuthConfigMock).toHaveBeenCalled()
    const state = useOnboardingStore.getState()
    expect(state.status).toBe('awaitingApiKey')
    expect(state.accounts).toEqual([])
    expect(state.selectedAccountId).toBeNull()
    expect(state.error).toBeNull()
  })
})
