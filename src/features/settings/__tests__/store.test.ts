import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount } from '../../../types'
import { NexonAuthError, NexonNetworkError, NexonRateLimitError } from '../../../nexon/errors'
import { initialSettingsState } from '../state'

const { fetchCharacterListMock } = vi.hoisted(() => ({
  fetchCharacterListMock: vi.fn(),
}))

const { getAuthConfigMock, setApiKeyMock, setSelectedAccountIdMock } = vi.hoisted(() => ({
  getAuthConfigMock: vi.fn(),
  setApiKeyMock: vi.fn(),
  setSelectedAccountIdMock: vi.fn(),
}))

const { prefetchAccountDataMock } = vi.hoisted(() => ({
  prefetchAccountDataMock: vi.fn(),
}))

const { onboardingResetMock } = vi.hoisted(() => ({
  onboardingResetMock: vi.fn(),
}))

vi.mock('../../../nexon/character', () => ({
  fetchCharacterList: fetchCharacterListMock,
}))

vi.mock('../../../storage/api-key', () => ({
  getAuthConfig: getAuthConfigMock,
  setApiKey: setApiKeyMock,
  setSelectedAccountId: setSelectedAccountIdMock,
}))

vi.mock('../../onboarding/prefetch', () => ({
  prefetchAccountData: prefetchAccountDataMock,
}))

vi.mock('../../onboarding/store', () => ({
  useOnboardingStore: {
    getState: () => ({ reset: onboardingResetMock }),
  },
}))

import { useSettingsStore } from '../store'

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
  useSettingsStore.setState(initialSettingsState)
  setApiKeyMock.mockResolvedValue(undefined)
  setSelectedAccountIdMock.mockResolvedValue(undefined)
  prefetchAccountDataMock.mockResolvedValue(undefined)
  onboardingResetMock.mockResolvedValue(undefined)
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: 'acc-old' })
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('useSettingsStore.changeApiKey', () => {
  it('성공하면 setApiKey를 호출하고, 계정이 1개면 자동으로 prefetching까지 진행 후 idle로 돌아간다', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useSettingsStore.getState().changeApiKey('new-key')

    expect(setApiKeyMock).toHaveBeenCalledWith('new-key')
    expect(setSelectedAccountIdMock).toHaveBeenCalledWith('acc-1')
    expect(prefetchAccountDataMock).toHaveBeenCalledWith('new-key', accounts[0].characters, expect.any(Function))
    expect(useSettingsStore.getState().status).toBe('idle')
  })

  it('계정이 2개 이상이면 selectingAccount에서 멈추고 prefetch는 실행되지 않는다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useSettingsStore.getState().changeApiKey('new-key')

    expect(setApiKeyMock).toHaveBeenCalledWith('new-key')
    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    expect(prefetchAccountDataMock).not.toHaveBeenCalled()
    const state = useSettingsStore.getState()
    expect(state.status).toBe('selectingAccount')
    expect(state.accounts).toEqual(accounts)
  })

  it('NexonAuthError(401/403)를 만나면 invalidApiKey error가 되고 setApiKey는 호출되지 않는다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonAuthError('invalid'))

    await useSettingsStore.getState().changeApiKey('new-key')

    const state = useSettingsStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'invalidApiKey' })
    expect(setApiKeyMock).not.toHaveBeenCalled()
  })

  it('NexonRateLimitError(429)를 만나면 rateLimited error가 된다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonRateLimitError('rate limited'))

    await useSettingsStore.getState().changeApiKey('new-key')

    const state = useSettingsStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'rateLimited' })
  })

  it('그 외 에러(네트워크 등)를 만나면 network error가 된다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonNetworkError('network fail'))

    await useSettingsStore.getState().changeApiKey('new-key')

    const state = useSettingsStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'network' })
  })

  it('setApiKey 저장이 실패하면 storageWriteFailed error가 되고 예열은 실행되지 않는다', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)
    setApiKeyMock.mockRejectedValue(new Error('disk full'))

    await useSettingsStore.getState().changeApiKey('new-key')

    const state = useSettingsStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'storageWriteFailed' })
    expect(prefetchAccountDataMock).not.toHaveBeenCalled()
  })
})

describe('useSettingsStore.refreshAccounts', () => {
  it('setApiKey를 호출하지 않고, 저장된 키로 재조회해 계정이 1개면 prefetching까지 진행한다', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useSettingsStore.getState().refreshAccounts()

    expect(fetchCharacterListMock).toHaveBeenCalledWith('key-1')
    expect(setApiKeyMock).not.toHaveBeenCalled()
    expect(setSelectedAccountIdMock).toHaveBeenCalledWith('acc-1')
    expect(prefetchAccountDataMock).toHaveBeenCalledWith('key-1', accounts[0].characters, expect.any(Function))
    expect(useSettingsStore.getState().status).toBe('idle')
  })

  it('계정이 2개 이상이면 selectingAccount에서 멈춘다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useSettingsStore.getState().refreshAccounts()

    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    const state = useSettingsStore.getState()
    expect(state.status).toBe('selectingAccount')
    expect(state.accounts).toEqual(accounts)
  })

  it('저장된 키가 없으면(이론상 발생하지 않아야 함) network error가 되고 fetchCharacterList는 호출되지 않는다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await useSettingsStore.getState().refreshAccounts()

    expect(fetchCharacterListMock).not.toHaveBeenCalled()
    const state = useSettingsStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'network' })
  })

  it('NexonAuthError를 만나면 invalidApiKey error가 된다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonAuthError('invalid'))

    await useSettingsStore.getState().refreshAccounts()

    const state = useSettingsStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'invalidApiKey' })
  })

  it('NexonRateLimitError를 만나면 rateLimited error가 된다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonRateLimitError('rate limited'))

    await useSettingsStore.getState().refreshAccounts()

    const state = useSettingsStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'rateLimited' })
  })
})

describe('useSettingsStore.selectAccount', () => {
  it('setSelectedAccountId 호출 후 예열이 진행되고 idle로 돌아간다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    useSettingsStore.setState({
      status: 'selectingAccount',
      accounts,
      error: null,
      prefetchProgress: null,
    })

    await useSettingsStore.getState().selectAccount('acc-2')

    expect(setSelectedAccountIdMock).toHaveBeenCalledWith('acc-2')
    expect(prefetchAccountDataMock).toHaveBeenCalledWith('key-1', accounts[1].characters, expect.any(Function))
    expect(useSettingsStore.getState().status).toBe('idle')
  })

  it('저장이 실패하면 storageWriteFailed error가 되고 예열은 실행되지 않는다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    useSettingsStore.setState({
      status: 'selectingAccount',
      accounts,
      error: null,
      prefetchProgress: null,
    })
    setSelectedAccountIdMock.mockRejectedValue(new Error('disk full'))

    await useSettingsStore.getState().selectAccount('acc-2')

    const state = useSettingsStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'storageWriteFailed' })
    expect(prefetchAccountDataMock).not.toHaveBeenCalled()
  })
})

describe('useSettingsStore.disconnect', () => {
  it('useOnboardingStore.getState().reset을 정확히 1번 호출한다', async () => {
    await useSettingsStore.getState().disconnect()

    expect(onboardingResetMock).toHaveBeenCalledTimes(1)
  })
})

describe('useSettingsStore.reset', () => {
  it('동기적으로 initialSettingsState로 되돌린다', () => {
    useSettingsStore.setState({
      status: 'error',
      accounts: [account('acc-1')],
      error: { kind: 'network' },
      prefetchProgress: null,
    })

    useSettingsStore.getState().reset()

    expect(useSettingsStore.getState()).toMatchObject(initialSettingsState)
  })
})
