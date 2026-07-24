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

const { prefetchAccountDataMock } = vi.hoisted(() => ({
  prefetchAccountDataMock: vi.fn(),
}))

const { showSuccessMock, showErrorMock } = vi.hoisted(() => ({
  showSuccessMock: vi.fn(),
  showErrorMock: vi.fn(),
}))

const { setModeMock, trackingModeRef } = vi.hoisted(() => ({
  setModeMock: vi.fn(),
  trackingModeRef: { current: 'auto' as 'auto' | 'manual' },
}))

const { setTrackedCharacterOcidsMock } = vi.hoisted(() => ({
  setTrackedCharacterOcidsMock: vi.fn(),
}))

const { seedManualTrackedContentMock } = vi.hoisted(() => ({
  seedManualTrackedContentMock: vi.fn(),
}))

vi.mock('../../../nexon/character', () => ({
  fetchCharacterList: fetchCharacterListMock,
}))

vi.mock('../../../storage/api-key', () => ({
  getAuthConfig: getAuthConfigMock,
  setApiKey: setApiKeyMock,
  setSelectedAccountId: setSelectedAccountIdMock,
  clearAuthConfig: clearAuthConfigMock,
}))

vi.mock('../prefetch', () => ({
  prefetchAccountData: prefetchAccountDataMock,
}))

vi.mock('../../toast/store', () => ({
  useToastStore: {
    getState: () => ({ showSuccess: showSuccessMock, showError: showErrorMock }),
  },
}))

vi.mock('../../tracking-mode/store', () => ({
  useTrackingModeStore: {
    getState: () => ({ setMode: setModeMock, mode: trackingModeRef.current }),
  },
}))

vi.mock('../../../storage/character-selection', () => ({
  setTrackedCharacterOcids: setTrackedCharacterOcidsMock,
}))

vi.mock('../../tracking-mode/seed', () => ({
  seedManualTrackedContent: seedManualTrackedContentMock,
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
  prefetchAccountDataMock.mockResolvedValue(undefined)
  setModeMock.mockResolvedValue(undefined)
  setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
  seedManualTrackedContentMock.mockResolvedValue(undefined)
  trackingModeRef.current = 'auto'
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })
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

  it('apiKey만 있으면 fetchCharacterList를 다시 호출해 재개한다 (계정 1개면 예열 후 트래킹 모드 선택)', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useOnboardingStore.getState().restoreFromStorage()

    expect(fetchCharacterListMock).toHaveBeenCalledWith('key-1')
    const state = useOnboardingStore.getState()
    expect(state.status).toBe('selectingTrackingMode')
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
  it('계정이 1개면 setSelectedAccountId까지 자동 호출되고 예열 후 트래킹 모드 선택으로 넘어간다', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useOnboardingStore.getState().submitApiKey('key-1')

    expect(setApiKeyMock).toHaveBeenCalledWith('key-1')
    expect(setSelectedAccountIdMock).toHaveBeenCalledWith('acc-1')
    const state = useOnboardingStore.getState()
    expect(state.status).toBe('selectingTrackingMode')
    expect(state.selectedAccountId).toBe('acc-1')
  })

  it('목록 조회에 성공하면 성공 토스트를 띄운다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])

    await useOnboardingStore.getState().submitApiKey('key-1')

    expect(showSuccessMock).toHaveBeenCalledWith('API 키를 확인했어요')
    expect(showErrorMock).not.toHaveBeenCalled()
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

  it('목록 조회에 실패하면(종류 무관) 실패 토스트를 띄운다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonAuthError('invalid'))

    await useOnboardingStore.getState().submitApiKey('key-1')

    expect(showErrorMock).toHaveBeenCalledWith('API 키를 확인하지 못했어요')
    expect(showSuccessMock).not.toHaveBeenCalled()
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

  it('계정이 1개면 예열(prefetchAccountData)이 호출되고 완료 후 트래킹 모드 선택으로 넘어간다', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useOnboardingStore.getState().submitApiKey('key-1')

    expect(prefetchAccountDataMock).toHaveBeenCalledWith(
      'key-1',
      accounts[0].characters,
      expect.any(Function),
    )
    expect(useOnboardingStore.getState().status).toBe('selectingTrackingMode')
  })

  it('예열이 끝나면 완료 토스트를 띄운다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1')])

    await useOnboardingStore.getState().submitApiKey('key-1')

    expect(showSuccessMock).toHaveBeenCalledWith('캐릭터 정보를 모두 불러왔어요')
  })

  it('예열이 끝나기 전까지는 prefetching 상태이고 진행률이 반영되며, 끝나면 트래킹 모드 선택으로 넘어간다', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)
    const progressCallbacks: Array<(progress: { completed: number; total: number }) => void> = []
    const resolvers: Array<() => void> = []
    prefetchAccountDataMock.mockImplementation(
      (_apiKey: string, _characters: unknown, onProgress: (p: { completed: number; total: number }) => void) => {
        progressCallbacks.push(onProgress)
        return new Promise<void>((resolve) => {
          resolvers.push(resolve)
        })
      },
    )

    const promise = useOnboardingStore.getState().submitApiKey('key-1')

    await vi.waitFor(() => expect(useOnboardingStore.getState().status).toBe('prefetching'))
    progressCallbacks[0]({ completed: 1, total: 2 })
    expect(useOnboardingStore.getState().prefetchProgress).toEqual({ completed: 1, total: 2 })

    resolvers[0]()
    await promise

    expect(useOnboardingStore.getState().status).toBe('selectingTrackingMode')
    expect(useOnboardingStore.getState().prefetchProgress).toBeNull()
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
  it('저장에 성공하면 예열을 거쳐 트래킹 모드 선택 단계가 된다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    useOnboardingStore.setState({
      status: 'selectingAccount',
      accounts,
      selectedAccountId: null,
      error: null,
      prefetchProgress: null,
    })

    await useOnboardingStore.getState().selectAccount('acc-2')

    expect(setSelectedAccountIdMock).toHaveBeenCalledWith('acc-2')
    expect(prefetchAccountDataMock).toHaveBeenCalledWith(
      'key-1',
      accounts[1].characters,
      expect.any(Function),
    )
    const state = useOnboardingStore.getState()
    expect(state.status).toBe('selectingTrackingMode')
    expect(state.selectedAccountId).toBe('acc-2')
  })

  it('메이플 ID 선택 후 예열이 끝나면 완료 토스트를 띄운다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    useOnboardingStore.setState({
      status: 'selectingAccount',
      accounts,
      selectedAccountId: null,
      error: null,
      prefetchProgress: null,
    })

    await useOnboardingStore.getState().selectAccount('acc-2')

    expect(showSuccessMock).toHaveBeenCalledWith('캐릭터 정보를 모두 불러왔어요')
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

describe('useOnboardingStore.selectTrackingMode', () => {
  function primeSelectingTrackingMode(): void {
    useOnboardingStore.setState({
      status: 'selectingTrackingMode',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: null,
    })
  }

  it('선택한 모드로 setMode를 호출하고 selectingContentCharacters로 전이한다', async () => {
    primeSelectingTrackingMode()

    await useOnboardingStore.getState().selectTrackingMode('manual')

    expect(setModeMock).toHaveBeenCalledWith('manual')
    expect(useOnboardingStore.getState().status).toBe('selectingContentCharacters')
  })

  it('setMode가 끝난 뒤에만 selectingContentCharacters로 전이한다', async () => {
    primeSelectingTrackingMode()
    let resolveSetMode: () => void = () => {}
    setModeMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSetMode = resolve
        }),
    )

    const promise = useOnboardingStore.getState().selectTrackingMode('auto')
    expect(useOnboardingStore.getState().status).toBe('selectingTrackingMode')

    resolveSetMode()
    await promise

    expect(setModeMock).toHaveBeenCalledWith('auto')
    expect(useOnboardingStore.getState().status).toBe('selectingContentCharacters')
  })
})

describe('useOnboardingStore.submitContentCharacters', () => {
  function primeSelectingContentCharacters(): void {
    useOnboardingStore.setState({
      status: 'selectingContentCharacters',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: null,
    })
  }

  it('추적 캐릭터를 저장하고, auto 모드면 시드 없이 바로 completed로 전이한다', async () => {
    trackingModeRef.current = 'auto'
    primeSelectingContentCharacters()

    await useOnboardingStore.getState().submitContentCharacters(['ocid-a', 'ocid-b'])

    expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith('content', ['ocid-a', 'ocid-b'])
    expect(seedManualTrackedContentMock).not.toHaveBeenCalled()
    expect(useOnboardingStore.getState().status).toBe('completed')
  })

  it('manual 모드면 각 ocid에 대해 seedManualTrackedContent를 호출한 뒤 completed로 전이한다', async () => {
    trackingModeRef.current = 'manual'
    primeSelectingContentCharacters()

    await useOnboardingStore.getState().submitContentCharacters(['ocid-a', 'ocid-b'])

    expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith('content', ['ocid-a', 'ocid-b'])
    expect(seedManualTrackedContentMock).toHaveBeenCalledWith('ocid-a')
    expect(seedManualTrackedContentMock).toHaveBeenCalledWith('ocid-b')
    expect(useOnboardingStore.getState().status).toBe('completed')
  })

  it('manual 모드에서 시드가 끝나기 전까지는 seedingTracking 상태에 머문다', async () => {
    trackingModeRef.current = 'manual'
    primeSelectingContentCharacters()
    let resolveSeed: () => void = () => {}
    seedManualTrackedContentMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSeed = resolve
        }),
    )

    const promise = useOnboardingStore.getState().submitContentCharacters(['ocid-a'])
    await vi.waitFor(() => expect(useOnboardingStore.getState().status).toBe('seedingTracking'))

    resolveSeed()
    await promise

    expect(useOnboardingStore.getState().status).toBe('completed')
  })

  it('manual 모드에서도 시드는 추적 저장 이후에 실행된다', async () => {
    trackingModeRef.current = 'manual'
    primeSelectingContentCharacters()
    const callOrder: string[] = []
    setTrackedCharacterOcidsMock.mockImplementation(async () => {
      callOrder.push('setTracked')
    })
    seedManualTrackedContentMock.mockImplementation(async () => {
      callOrder.push('seed')
    })

    await useOnboardingStore.getState().submitContentCharacters(['ocid-a'])

    expect(callOrder).toEqual(['setTracked', 'seed'])
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
