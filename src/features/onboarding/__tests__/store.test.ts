import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount } from '@core/types'
import {
  NexonAuthError,
  NexonBadRequestError,
  NexonNetworkError,
  NexonRateLimitError,
} from '@core/nexon/errors'
import { initialOnboardingState } from '../state'

const { fetchCharacterListMock } = vi.hoisted(() => ({
  fetchCharacterListMock: vi.fn(),
}))

const {
  getAuthConfigMock,
  setApiKeyMock,
  setSelectedAccountIdMock,
  clearAuthConfigMock,
  removeApiKeyMock,
} = vi.hoisted(() => ({
  getAuthConfigMock: vi.fn(),
  setApiKeyMock: vi.fn(),
  setSelectedAccountIdMock: vi.fn(),
  clearAuthConfigMock: vi.fn(),
  removeApiKeyMock: vi.fn(),
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

vi.mock('@core/nexon/character', () => ({
  fetchCharacterList: fetchCharacterListMock,
}))

vi.mock('@core/storage/api-key', () => ({
  getAuthConfig: getAuthConfigMock,
  setApiKey: setApiKeyMock,
  setSelectedAccountId: setSelectedAccountIdMock,
  clearAuthConfig: clearAuthConfigMock,
  removeApiKey: removeApiKeyMock,
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

vi.mock('@core/storage/character-selection', () => ({
  setTrackedCharacterOcids: setTrackedCharacterOcidsMock,
  getTrackedCharacterOcids: getTrackedCharacterOcidsMock,
}))

vi.mock('@core/storage/tracking-mode', () => ({
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
  removeApiKeyMock.mockResolvedValue(undefined)
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

describe('useOnboardingStore.submitApiKey — 무효 키(400 OPENAPI00005)', () => {
  // ADR-115 결정 9: 넥슨은 무효 키에 401 이 아니라 400 OPENAPI00005 를 준다(실측 2026-08-08).
  // 전에는 이 경로가 "모르는 400"이라 network 로 degrade 돼, 키를 잘못 입력한 사용자에게
  // 화면이 "네트워크 오류가 발생했습니다"라고 말했다 — 원인이 키인데 네트워크를 가리켰다.
  it('400 OPENAPI00005 면 invalidApiKey 로 알린다(network 가 아니다)', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonBadRequestError('x', 'OPENAPI00005'))

    await useOnboardingStore.getState().submitApiKey('bad-key')

    const state = useOnboardingStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'invalidApiKey' })
    expect(showErrorMock).toHaveBeenCalledWith('API 키가 유효하지 않습니다')
    expect(setApiKeyMock).not.toHaveBeenCalled()
  })

  // 회귀 가드: 키와 무관한 400 까지 무효 키로 삼으면 캐릭터·날짜 문제가 키 문제로 둔갑한다.
  it('키와 무관한 400(OPENAPI00003)은 그대로 network 다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonBadRequestError('x', 'OPENAPI00003'))

    await useOnboardingStore.getState().submitApiKey('key-1')

    expect(useOnboardingStore.getState().error).toEqual({ kind: 'network' })
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

  // ADR-115 결정 4·5: 키를 다시 넣으면 뒤 단계는 저장된 값으로 재개한다 — 계정 선택·트래킹 모드·
  // 추적 캐릭터를 다시 묻지 않는다. 전에는 성공이 무조건 selectingAccount로 가고 selectedAccountId를
  // 리셋해, 키 하나 때문에 계정 선택부터 캐릭터 선택까지 전부를 다시 시켰다.
  describe('키 재입력 후 재개 (ADR-115 결정 4·5)', () => {
    it('저장된 값이 그대로면 selectingAccount를 거치지 않고 곧바로 completed로 간다', async () => {
      getAuthConfigMock.mockResolvedValue({ apiKey: 'key-2', selectedAccountId: 'acc-1' })
      fetchCharacterListMock.mockResolvedValue([account('acc-1'), account('acc-2')])
      const seen: string[] = []
      const unsubscribe = useOnboardingStore.subscribe((state) => {
        seen.push(state.status)
      })

      await useOnboardingStore.getState().submitApiKey('key-2')
      unsubscribe()

      const state = useOnboardingStore.getState()
      expect(state.status).toBe('completed')
      expect(state.selectedAccountId).toBe('acc-1')
      expect(seen).not.toContain('selectingAccount')
      // 예열(ADR-016)을 다시 돌리지 않는다 — 캐시가 이미 따뜻하다.
      expect(prefetchAccountDataMock).not.toHaveBeenCalled()
      // 성공 토스트는 두 갈래 모두에서 그대로 뜬다.
      expect(showSuccessMock).toHaveBeenCalledWith('API 키를 확인했어요')
    })

    // 결정 5: 가드가 없으면 남의 계정 키로 이전 계정 ocid 추적 목록을 그대로 쓰게 된다.
    it('저장된 selectedAccountId가 응답 계정 목록에 없으면 재개하지 않고 계정 선택부터 간다', async () => {
      getAuthConfigMock.mockResolvedValue({ apiKey: 'key-2', selectedAccountId: 'acc-1' })
      const accounts = [account('acc-9')]
      fetchCharacterListMock.mockResolvedValue(accounts)

      await useOnboardingStore.getState().submitApiKey('key-2')

      const state = useOnboardingStore.getState()
      expect(state.status).toBe('selectingAccount')
      expect(state.accounts).toEqual(accounts)
      expect(state.selectedAccountId).toBeNull()
    })

    it('트래킹 모드를 고르지 않았으면 그 단계로 재개한다', async () => {
      getAuthConfigMock.mockResolvedValue({ apiKey: 'key-2', selectedAccountId: 'acc-1' })
      getTrackingModeMock.mockResolvedValue(null)
      getTrackedCharacterOcidsMock.mockResolvedValue(null)
      fetchCharacterListMock.mockResolvedValue([account('acc-1')])

      await useOnboardingStore.getState().submitApiKey('key-2')

      const state = useOnboardingStore.getState()
      expect(state.status).toBe('selectingTrackingMode')
      expect(state.selectedAccountId).toBe('acc-1')
      expect(prefetchAccountDataMock).not.toHaveBeenCalled()
    })

    it('추적 캐릭터가 비어 있으면 캐릭터 선택 단계로 재개한다', async () => {
      getAuthConfigMock.mockResolvedValue({ apiKey: 'key-2', selectedAccountId: 'acc-1' })
      getTrackedCharacterOcidsMock.mockResolvedValue([])
      fetchCharacterListMock.mockResolvedValue([account('acc-1')])

      await useOnboardingStore.getState().submitApiKey('key-2')

      const state = useOnboardingStore.getState()
      expect(state.status).toBe('selectingContentCharacters')
      expect(state.selectedAccountId).toBe('acc-1')
    })

    // 신규 사용자 회귀: 저장소가 비어 있으면 재개할 것이 없어 기존 경로 그대로다.
    it('저장된 계정이 없으면(신규 사용자) 지금과 똑같이 selectingAccount다', async () => {
      getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })
      const accounts = [account('acc-1')]
      fetchCharacterListMock.mockResolvedValue(accounts)

      await useOnboardingStore.getState().submitApiKey('key-1')

      const state = useOnboardingStore.getState()
      expect(state.status).toBe('selectingAccount')
      expect(state.accounts).toEqual(accounts)
      expect(state.selectedAccountId).toBeNull()
    })

    // 이슈 #157 의 요구사항 그 자체 — 무효화되면 키만 다시 받고 원래 자리로 돌아온다.
    it('무효화 → 키 재입력 왕복이면 다시 completed이고 저장된 계정이 그대로다', async () => {
      useOnboardingStore.setState({
        status: 'completed',
        accounts: [],
        selectedAccountId: 'acc-1',
        error: null,
        prefetchProgress: null,
        apiKeyNotice: null,
      })
      getAuthConfigMock.mockResolvedValue({ apiKey: 'key-2', selectedAccountId: 'acc-1' })
      fetchCharacterListMock.mockResolvedValue([account('acc-1')])

      // ADR-115 결정 10: 알림 → 확인 두 단계를 거쳐야 키 입력 화면으로 간다.
      useOnboardingStore.getState().noticeApiKeyIssue('invalid')
      expect(useOnboardingStore.getState().status).toBe('completed')
      await useOnboardingStore.getState().confirmApiKeyNotice()
      expect(useOnboardingStore.getState().status).toBe('awaitingApiKey')

      await useOnboardingStore.getState().submitApiKey('key-2')

      const state = useOnboardingStore.getState()
      expect(state.status).toBe('completed')
      expect(state.selectedAccountId).toBe('acc-1')
      expect(prefetchAccountDataMock).not.toHaveBeenCalled()
    })
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

// ADR-115 결정 10 · ADR-116 결정 1: 저장된 키로 앞으로 갈 수 없게 됐을 때 부르는 유일한 진입점.
// 원인은 둘(무효 키 400 OPENAPI00005·401/403 · 429)이고 사슬은 하나다 — 처방이 같아 화면도 같다.
// **알리기만 하고** 이동·삭제는 사용자가 "확인"을 눌러야(confirmApiKeyNotice) 일어난다 —
// 결정 1의 "토스트 + 즉시 이동"은 폐기됐다(이유를 읽기 전에 화면이 바뀌면 원인과 결과가 안 이어진다).
describe('useOnboardingStore.noticeApiKeyIssue', () => {
  function primeCompleted(): void {
    useOnboardingStore.setState({
      status: 'completed',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: { completed: 1, total: 1 },
      apiKeyNotice: null,
    })
  }

  // 결정 10의 핵심 — 뒤에 원래 화면이 남아 있어야 사용자가 무엇을 하다 이렇게 됐는지 보면서 읽는다.
  it.each(['invalid', 'rateLimited'] as const)(
    '원인(%s)만 담고 status는 그대로다 — 화면을 빼앗지 않는다',
    (kind) => {
      primeCompleted()

      useOnboardingStore.getState().noticeApiKeyIssue(kind)

      const state = useOnboardingStore.getState()
      expect(state.apiKeyNotice).toBe(kind)
      expect(state.status).toBe('completed')
      expect(state.selectedAccountId).toBe('acc-1')
    },
  )

  // 알리는 시점에는 아무것도 지우지 않는다 — 확인 전에 지우면 사용자가 취소할 수 없는 일이 이미 끝난다.
  it.each(['invalid', 'rateLimited'] as const)(
    '%s — 저장소를 건드리지 않고 토스트도 띄우지 않는다(문구는 모달이 말한다)',
    (kind) => {
      primeCompleted()

      useOnboardingStore.getState().noticeApiKeyIssue(kind)

      expect(removeApiKeyMock).not.toHaveBeenCalled()
      expect(clearAuthConfigMock).not.toHaveBeenCalled()
      expect(showErrorMock).not.toHaveBeenCalled()
    },
  )

  // ADR-115 결정 6: 동기 함수라 이 구간이 원자적이다 — 동시 실패가 모달 하나로 접힌다.
  // ADR-116 결정 2: 원인이 겹치면 **먼저 뜬 것**을 유지한다 — 읽던 문구가 눈앞에서 바뀌면 안 된다.
  it('연달아 불러도 알림은 한 번뿐이고 먼저 뜬 원인이 유지된다', () => {
    primeCompleted()

    useOnboardingStore.getState().noticeApiKeyIssue('rateLimited')
    const afterFirst = useOnboardingStore.getState()
    useOnboardingStore.getState().noticeApiKeyIssue('invalid')

    expect(useOnboardingStore.getState()).toBe(afterFirst)
    expect(useOnboardingStore.getState().apiKeyNotice).toBe('rateLimited')
  })

  // ADR-116 결정 2: 가드는 "키 입력 화면인가"만 본다. 그 두 상태가 곧 "이미 키 입력 화면"이라
  // 보낼 곳이 없고, 그래서 재이동 루프도 여전히 불가능하다 — 폼 실패는 폼 토스트가 맡는다.
  it.each(['awaitingApiKey', 'verifyingApiKey'] as const)(
    '키 입력 화면(%s)에서는 알리지 않는다',
    (status) => {
      useOnboardingStore.setState({
        status,
        accounts: [account('acc-1')],
        selectedAccountId: 'acc-1',
        error: null,
        prefetchProgress: null,
        apiKeyNotice: null,
      })

      useOnboardingStore.getState().noticeApiKeyIssue('rateLimited')

      const state = useOnboardingStore.getState()
      expect(state.apiKeyNotice).toBeNull()
      expect(state.status).toBe(status)
      expect(removeApiKeyMock).not.toHaveBeenCalled()
    },
  )

  // ADR-116 결정 2가 여는 자리 — 옛 가드(`status !== 'completed'`)에서는 전부 no-op이었다.
  // 이슈 #176의 하드 잠금은 selectingContentCharacters에서 나므로, 여기서 알리지 못하면
  // 이 phase가 만들려는 출구가 정작 잠긴 사람에게 안 열린다.
  it.each([
    'selectingAccount',
    'selectingContentCharacters',
    'prefetching',
    'error',
  ] as const)('온보딩 중간 단계(%s)에서도 알린다 — #176의 잠금이 여기서 일어난다', (status) => {
    useOnboardingStore.setState({
      status,
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: null,
      apiKeyNotice: null,
    })

    useOnboardingStore.getState().noticeApiKeyIssue('rateLimited')

    const state = useOnboardingStore.getState()
    expect(state.apiKeyNotice).toBe('rateLimited')
    // 알리기만 한다 — status를 뒤집는 것은 확인(confirmApiKeyNotice)의 몫이다.
    expect(state.status).toBe(status)
    expect(removeApiKeyMock).not.toHaveBeenCalled()
  })
})

describe('useOnboardingStore.confirmApiKeyNotice', () => {
  function primeNoticed(kind: 'invalid' | 'rateLimited' = 'invalid'): void {
    useOnboardingStore.setState({
      status: 'completed',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: { completed: 1, total: 1 },
      apiKeyNotice: kind,
    })
  }

  // 결정 2: 상태를 뒤집는 것이 곧 이동이다 — App.tsx의 isCompleted 가드가 라우터로 보낸다.
  it.each(['invalid', 'rateLimited'] as const)(
    '%s — completed를 awaitingApiKey로 되돌린다(알림도 함께 꺼진다)',
    async (kind) => {
      primeNoticed(kind)

      await useOnboardingStore.getState().confirmApiKeyNotice()

      expect(useOnboardingStore.getState()).toMatchObject(initialOnboardingState)
    },
  )

  // ADR-115 결정 3: clearAuthConfig는 selectedAccountId까지 지워 결정 4의 재개를 불가능하게 만든다.
  // ADR-116 결정 1: 429도 키를 지운다 — 원인별로 갈라 처리하지 않는다.
  it.each(['invalid', 'rateLimited'] as const)(
    '%s — 저장소에서 apiKey만 지운다(연결 해제 경로 clearAuthConfig를 타지 않는다)',
    async (kind) => {
      primeNoticed(kind)

      await useOnboardingStore.getState().confirmApiKeyNotice()

      expect(removeApiKeyMock).toHaveBeenCalledTimes(1)
      expect(clearAuthConfigMock).not.toHaveBeenCalled()
      expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    },
  )

  // 알림이 없는데 확인이 불릴 일은 없지만, 불려도 저장된 키를 지우지 않아야 한다.
  it('알림이 켜져 있지 않으면 아무 일도 하지 않는다', async () => {
    useOnboardingStore.setState({ ...initialOnboardingState, status: 'completed' })

    await useOnboardingStore.getState().confirmApiKeyNotice()

    expect(useOnboardingStore.getState().status).toBe('completed')
    expect(removeApiKeyMock).not.toHaveBeenCalled()
  })

  // 결정 3의 "알려진 열화": 삭제가 실패해도 같은 길을 한 번 더 돌 뿐이라 막다른 길이 아니다.
  // rethrow하면 호출부가 void 호출이라 미처리 rejection이 된다(ADR-065 결정 1의 그 결함).
  it('저장소 삭제가 실패해도 reject하지 않고 화면 이동은 그대로다', async () => {
    primeNoticed()
    removeApiKeyMock.mockRejectedValue(new Error('disk full'))

    await expect(useOnboardingStore.getState().confirmApiKeyNotice()).resolves.toBeUndefined()

    expect(useOnboardingStore.getState().status).toBe('awaitingApiKey')
  })

  // 회귀 가드: 연결 해제와 무효화는 저장소에 하는 일이 다르다 — 섞이면 재개가 조용히 깨진다.
  it('reset()은 여전히 clearAuthConfig로 selectedAccountId까지 지운다', async () => {
    primeNoticed()

    await useOnboardingStore.getState().reset()

    expect(clearAuthConfigMock).toHaveBeenCalledTimes(1)
    expect(removeApiKeyMock).not.toHaveBeenCalled()
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
