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

const { setTrackedCharacterOcidsMock, getTrackedCharacterOcidsMock } = vi.hoisted(() => ({
  setTrackedCharacterOcidsMock: vi.fn(),
  getTrackedCharacterOcidsMock: vi.fn(),
}))

const { getTrackingModeMock, setTrackingModeMock } = vi.hoisted(() => ({
  getTrackingModeMock: vi.fn(),
  setTrackingModeMock: vi.fn(),
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
  getTrackedCharacterOcids: getTrackedCharacterOcidsMock,
}))

vi.mock('../../../storage/tracking-mode', () => ({
  getTrackingMode: getTrackingModeMock,
  setTrackingMode: setTrackingModeMock,
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
  // ADR-086 결정 1: 재개 판정의 기본값 = 온보딩을 끝까지 마친 상태
  getTrackingModeMock.mockResolvedValue('auto')
  getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-acc-1'])
  setTrackingModeMock.mockResolvedValue(undefined)
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

  it('네 단계를 모두 마쳤으면 completed 상태가 된다', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: 'acc-1' })

    await useOnboardingStore.getState().restoreFromStorage()

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('completed')
    expect(state.selectedAccountId).toBe('acc-1')
    expect(fetchCharacterListMock).not.toHaveBeenCalled()
  })

  // ADR-086 결정 1·2: 끝내지 않은 단계는 그 지점부터 이어간다. 전에는 selectedAccountId 하나만
  // 보고 곧바로 completed로 전이해, 모드·캐릭터를 고르지 않은 채 빈 메인으로 떨어졌다.
  describe('끝내지 않은 온보딩 재개 (ADR-086 결정 1)', () => {
    beforeEach(() => {
      getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: 'acc-1' })
    })

    it('스케줄 관리 방법을 고르지 않았으면 그 단계부터 재개한다 — 자동으로 확정하지 않는다', async () => {
      getTrackingModeMock.mockResolvedValue(null)
      getTrackedCharacterOcidsMock.mockResolvedValue(null)

      await useOnboardingStore.getState().restoreFromStorage()

      const state = useOnboardingStore.getState()
      expect(state.status).toBe('selectingTrackingMode')
      expect(state.selectedAccountId).toBe('acc-1')
      expect(setTrackingModeMock).not.toHaveBeenCalled()
      // 뒤 단계는 네트워크 없이 재개된다 — 예열을 다시 돌리지 않는다.
      expect(fetchCharacterListMock).not.toHaveBeenCalled()
      expect(prefetchAccountDataMock).not.toHaveBeenCalled()
    })

    it('추적 캐릭터를 고르지 않았으면(null) 캐릭터 선택 단계부터 재개한다', async () => {
      getTrackingModeMock.mockResolvedValue('auto')
      getTrackedCharacterOcidsMock.mockResolvedValue(null)

      await useOnboardingStore.getState().restoreFromStorage()

      expect(useOnboardingStore.getState().status).toBe('selectingContentCharacters')
    })

    it('추적 캐릭터가 빈 배열이어도 미완료로 본다 — 0명은 사용자 의도가 아니다', async () => {
      getTrackingModeMock.mockResolvedValue('manual')
      getTrackedCharacterOcidsMock.mockResolvedValue([])

      await useOnboardingStore.getState().restoreFromStorage()

      expect(useOnboardingStore.getState().status).toBe('selectingContentCharacters')
    })

    it('ADR-035 이전 완주자(trackingMode 키 없음 + 추적 목록 있음)는 auto로 1회 이관하고 완료로 본다', async () => {
      getTrackingModeMock.mockResolvedValue(null)
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])

      await useOnboardingStore.getState().restoreFromStorage()

      expect(setTrackingModeMock).toHaveBeenCalledWith('auto')
      expect(useOnboardingStore.getState().status).toBe('completed')
    })
  })

  it('apiKey만 있으면 fetchCharacterList를 다시 호출해 재개하고, 계정이 1개여도 selectingAccount에서 멈춘다(ADR-051)', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useOnboardingStore.getState().restoreFromStorage()

    expect(fetchCharacterListMock).toHaveBeenCalledWith('key-1')
    const state = useOnboardingStore.getState()
    expect(state.status).toBe('selectingAccount')
    expect(state.accounts).toEqual(accounts)
    expect(state.selectedAccountId).toBeNull()
    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    expect(prefetchAccountDataMock).not.toHaveBeenCalled()
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

  // ADR-065 결정 1: 전에는 이 경로에 토스트가 아예 없어, 아무 설명 없이 API 키 입력 화면으로
  // 되돌아갔다(status가 error인데 accounts가 비면 화면이 폼만 다시 그린다).
  it('apiKey만 있는 상태에서 재조회가 실패하면 error 상태 + 원인별 토스트로 알린다', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })
    fetchCharacterListMock.mockRejectedValue(new NexonAuthError('invalid'))

    await useOnboardingStore.getState().restoreFromStorage()

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'invalidApiKey' })
    expect(showErrorMock).toHaveBeenCalledWith('API 키가 유효하지 않습니다')
  })
})

describe('useOnboardingStore.submitApiKey', () => {
  it('계정이 1개여도 자동 확정하지 않고 selectingAccount에서 멈춘다(ADR-051)', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useOnboardingStore.getState().submitApiKey('key-1')

    expect(setApiKeyMock).toHaveBeenCalledWith('key-1')
    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    expect(prefetchAccountDataMock).not.toHaveBeenCalled()
    const state = useOnboardingStore.getState()
    expect(state.status).toBe('selectingAccount')
    expect(state.accounts).toEqual(accounts)
    expect(state.selectedAccountId).toBeNull()
  })

  it('계정이 1개여도 사용자가 selectAccount로 확정해야 저장·예열을 거쳐 트래킹 모드 선택으로 넘어간다(ADR-051)', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useOnboardingStore.getState().submitApiKey('key-1')
    await useOnboardingStore.getState().selectAccount('acc-1')

    expect(setSelectedAccountIdMock).toHaveBeenCalledWith('acc-1')
    expect(prefetchAccountDataMock).toHaveBeenCalledWith(
      'key-1',
      'acc-1',
      accounts[0].characters,
      expect.any(Function),
    )
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

  // ADR-065 결정 1: 전에는 원인과 무관하게 한 문구였다 — 바로 아래에서 원인을 계산해 state에
  // 넣으면서도 토스트는 그 값을 쓰지 않았다.
  it.each([
    [new NexonAuthError('invalid'), 'API 키가 유효하지 않습니다'],
    // ADR-114 결정 4: 토스트는 원인만 — 처방은 인라인 자리가 준다.
    [new NexonRateLimitError('rate limited'), '호출 한도를 초과했습니다'],
    [new NexonNetworkError('network fail'), '네트워크 오류가 발생했습니다'],
  ])('목록 조회 실패를 원인별 문구로 알린다 (%o)', async (error, expected) => {
    fetchCharacterListMock.mockRejectedValue(error)

    await useOnboardingStore.getState().submitApiKey('key-1')

    expect(showErrorMock).toHaveBeenCalledWith(expected)
    expect(showSuccessMock).not.toHaveBeenCalled()
  })

  // ADR-065 결정 1: 전에는 setApiKey가 try 밖이라 미처리 rejection이었다 — 아무 일도 안 일어난
  // 것처럼 보였다. storageWriteFailed 문구가 이 경로로 처음 도달 가능해진다.
  it('키 저장에 실패하면 storageWriteFailed 상태 + 토스트로 알린다', async () => {
    fetchCharacterListMock.mockResolvedValue([{ accountId: 'acc-1', characters: [] }])
    setApiKeyMock.mockRejectedValue(new Error('write failed'))

    await useOnboardingStore.getState().submitApiKey('key-1')

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'storageWriteFailed' })
    expect(showErrorMock).toHaveBeenCalledWith('기기에 저장하지 못했습니다. 다시 시도해주세요')
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

})

// ADR-086 결정 8: 고른 계정에 고를 수 있는 캐릭터가 하나도 없을 때의 유일한 탈출구.
describe('useOnboardingStore.restartAccountSelection', () => {
  it('저장된 selectedAccountId를 비우고 계정 선택 화면으로 되돌아간다', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: 'acc-1' })
    const accounts = [account('acc-1'), account('acc-2')]
    fetchCharacterListMock.mockResolvedValue(accounts)
    useOnboardingStore.setState({
      status: 'selectingContentCharacters',
      accounts: [],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: null,
    })

    await useOnboardingStore.getState().restartAccountSelection()

    // 안 비우면 여기서 앱을 종료했을 때 재개가 같은 막다른 길로 다시 데려온다.
    expect(setSelectedAccountIdMock).toHaveBeenCalledWith(null)
    const state = useOnboardingStore.getState()
    expect(state.status).toBe('selectingAccount')
    expect(state.accounts).toEqual(accounts)
    expect(state.selectedAccountId).toBeNull()
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
      'acc-2',
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

  it('예열이 끝나기 전까지는 prefetching 상태이고 진행률이 반영되며, 끝나면 트래킹 모드 선택으로 넘어간다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    useOnboardingStore.setState({
      status: 'selectingAccount',
      accounts,
      selectedAccountId: null,
      error: null,
      prefetchProgress: null,
    })
    const progressCallbacks: Array<(progress: { completed: number; total: number }) => void> = []
    const resolvers: Array<() => void> = []
    prefetchAccountDataMock.mockImplementation(
      (
        _apiKey: string,
        _accountId: string,
        _characters: unknown,
        onProgress: (p: { completed: number; total: number }) => void,
      ) => {
        progressCallbacks.push(onProgress)
        return new Promise<void>((resolve) => {
          resolvers.push(resolve)
        })
      },
    )

    const promise = useOnboardingStore.getState().selectAccount('acc-2')

    await vi.waitFor(() => expect(useOnboardingStore.getState().status).toBe('prefetching'))
    progressCallbacks[0]({ completed: 1, total: 2 })
    expect(useOnboardingStore.getState().prefetchProgress).toEqual({ completed: 1, total: 2 })

    resolvers[0]()
    await promise

    expect(useOnboardingStore.getState().status).toBe('selectingTrackingMode')
    expect(useOnboardingStore.getState().prefetchProgress).toBeNull()
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

  // ADR-083 결정 4: 인라인 문구를 걷어내면서 이 경로가 유일하게 토스트가 없는 자리가 됐다 —
  // 그대로 두면 계정을 눌렀는데 아무 일도 안 일어난 것처럼 보인다.
  it('저장이 실패하면 토스트로 알린다 — 액션은 두지 않는다(다시 누르면 되는 일)', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    useOnboardingStore.setState({
      status: 'selectingAccount',
      accounts,
      selectedAccountId: null,
      error: null,
    })
    setSelectedAccountIdMock.mockRejectedValue(new Error('disk full'))

    await useOnboardingStore.getState().selectAccount('acc-2')

    expect(showErrorMock).toHaveBeenCalledWith('기기에 저장하지 못했습니다. 다시 시도해주세요')
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

    expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith(['ocid-a', 'ocid-b'])
    expect(seedManualTrackedContentMock).not.toHaveBeenCalled()
    expect(useOnboardingStore.getState().status).toBe('completed')
  })

  it('manual 모드면 각 ocid에 대해 seedManualTrackedContent를 호출한 뒤 completed로 전이한다', async () => {
    trackingModeRef.current = 'manual'
    primeSelectingContentCharacters()

    await useOnboardingStore.getState().submitContentCharacters(['ocid-a', 'ocid-b'])

    expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith(['ocid-a', 'ocid-b'])
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
