import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount } from '../../../types'
import {
  NexonAuthError,
  NexonBadRequestError,
  NexonNetworkError,
  NexonRateLimitError,
} from '../../../nexon/errors'
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

const { onboardingResetMock, noticeApiKeyInvalidMock } = vi.hoisted(() => ({
  onboardingResetMock: vi.fn(),
  noticeApiKeyInvalidMock: vi.fn(),
}))

const { setTrackedCharacterOcidsMock, seedManualTrackedContentMock, trackingModeRef } = vi.hoisted(
  () => ({
    setTrackedCharacterOcidsMock: vi.fn(),
    seedManualTrackedContentMock: vi.fn(),
    trackingModeRef: { current: 'auto' as 'auto' | 'manual' },
  }),
)

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
    getState: () => ({ reset: onboardingResetMock, noticeApiKeyInvalid: noticeApiKeyInvalidMock }),
  },
}))

vi.mock('../../../storage/character-selection', () => ({
  setTrackedCharacterOcids: setTrackedCharacterOcidsMock,
}))

vi.mock('../../tracking-mode/seed', () => ({
  seedManualTrackedContent: seedManualTrackedContentMock,
}))

vi.mock('../../tracking-mode/store', () => ({
  useTrackingModeStore: {
    getState: () => ({ mode: trackingModeRef.current }),
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
  noticeApiKeyInvalidMock.mockResolvedValue(undefined)
  setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
  seedManualTrackedContentMock.mockResolvedValue(undefined)
  trackingModeRef.current = 'auto'
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: 'acc-old' })
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('useSettingsStore.changeApiKey', () => {
  it('성공하면 setApiKey를 호출하고, 계정이 1개여도 selectingAccount에서 멈춘다(ADR-051)', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useSettingsStore.getState().changeApiKey('new-key')

    expect(setApiKeyMock).toHaveBeenCalledWith('new-key')
    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    expect(prefetchAccountDataMock).not.toHaveBeenCalled()
    const state = useSettingsStore.getState()
    expect(state.status).toBe('selectingAccount')
    expect(state.accounts).toEqual(accounts)
  })

  it('계정이 1개여도 사용자가 selectAccount로 확정해야 저장·예열을 거쳐 idle로 돌아간다(ADR-051)', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)
    // setApiKey 이후 저장소에는 방금 넣은 키가 남는다 — selectAccount는 그 키로 예열한다.
    getAuthConfigMock.mockResolvedValue({ apiKey: 'new-key', selectedAccountId: null })

    await useSettingsStore.getState().changeApiKey('new-key')
    await useSettingsStore.getState().selectAccount('acc-1')

    // ADR-086 결정 6: 이 시점엔 아직 아무것도 저장하지 않는다.
    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    expect(prefetchAccountDataMock).toHaveBeenCalledWith(
      'new-key',
      'acc-1',
      accounts[0].characters,
      expect.any(Function),
    )
    expect(useSettingsStore.getState().status).toBe('selectingCharacters')
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

  // ADR-115 결정 8: 이 경로의 401은 "사용자가 방금 나쁜 키를 입력한 것"이라 저장된 키의 무효화와
  // 성질이 다르다 — 같은 401이라는 이유로 무효화 진입점에 배선하면 안 된다.
  it('401을 만나도 무효화 진입점을 부르지 않는다(ADR-115 결정 8)', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonAuthError('invalid'))

    await useSettingsStore.getState().changeApiKey('new-key')

    expect(noticeApiKeyInvalidMock).not.toHaveBeenCalled()
    expect(useSettingsStore.getState().status).toBe('error')
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
  it('setApiKey를 호출하지 않고, 저장된 키로 재조회해 계정이 1개여도 selectingAccount에서 멈춘다(ADR-051)', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useSettingsStore.getState().refreshAccounts()

    expect(fetchCharacterListMock).toHaveBeenCalledWith('key-1')
    expect(setApiKeyMock).not.toHaveBeenCalled()
    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    expect(prefetchAccountDataMock).not.toHaveBeenCalled()
    const state = useSettingsStore.getState()
    expect(state.status).toBe('selectingAccount')
    expect(state.accounts).toEqual(accounts)
  })

  it('계정이 1개여도 사용자가 selectAccount로 확정해야 저장·예열을 거쳐 idle로 돌아간다(ADR-051)', async () => {
    const accounts = [account('acc-1')]
    fetchCharacterListMock.mockResolvedValue(accounts)

    await useSettingsStore.getState().refreshAccounts()
    await useSettingsStore.getState().selectAccount('acc-1')

    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    expect(prefetchAccountDataMock).toHaveBeenCalledWith(
      'key-1',
      'acc-1',
      accounts[0].characters,
      expect.any(Function),
    )
    expect(useSettingsStore.getState().status).toBe('selectingCharacters')
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

  // ADR-115 결정 7: 여기 401은 사용자가 방금 입력한 키가 아니라 **저장된 키**가 무효화된 것이다.
  // 인라인 카드에 머무르면 키를 바꿀 자리가 없어 막다른 길이라(이슈 #157) 무효화 진입점으로 넘긴다.
  it('NexonAuthError를 만나면 무효화 진입점으로 넘기고 idle로 돌아간다(인라인 error를 남기지 않는다)', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonAuthError('invalid'))

    await useSettingsStore.getState().refreshAccounts()

    expect(noticeApiKeyInvalidMock).toHaveBeenCalledTimes(1)
    const state = useSettingsStore.getState()
    // 화면은 곧 /onboarding 으로 간다(결정 2). 지나간 실패를 남겨 두면 설정을 다시 열었을 때
    // 되살아나고, idle 복귀는 AccountModal 의 닫힘 판정이기도 하다.
    expect(state.status).toBe('idle')
    expect(state.error).toBeNull()
  })

  // ADR-115 결정 9: 저장된 키가 폐기됐을 때 넥슨이 실제로 주는 응답이 이것이다(401 이 아니다).
  // 사용자가 정상 키로 온보딩을 마친 뒤 그 키를 삭제해 재현한 경로가 곧 이 케이스다.
  it('400 OPENAPI00005 도 같은 무효화 경로로 넘긴다 — 폐기된 키의 실제 응답이다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonBadRequestError('x', 'OPENAPI00005'))

    await useSettingsStore.getState().refreshAccounts()

    expect(noticeApiKeyInvalidMock).toHaveBeenCalledTimes(1)
    expect(useSettingsStore.getState().status).toBe('idle')
  })

  // 회귀 가드: 나머지 원인은 그대로 인라인 카드(ADR-063 — 모달 본문 전체를 차지하는 자리라
  // 토스트로 옮기면 빈 상자가 된다)에 남는다.
  it('NexonRateLimitError를 만나면 rateLimited error가 되고 무효화 경로를 타지 않는다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonRateLimitError('rate limited'))

    await useSettingsStore.getState().refreshAccounts()

    expect(noticeApiKeyInvalidMock).not.toHaveBeenCalled()
    const state = useSettingsStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'rateLimited' })
  })

  it('그 외 에러(네트워크 등)를 만나면 network error가 되고 무효화 경로를 타지 않는다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonNetworkError('network fail'))

    await useSettingsStore.getState().refreshAccounts()

    expect(noticeApiKeyInvalidMock).not.toHaveBeenCalled()
    const state = useSettingsStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'network' })
  })
})

describe('useSettingsStore.selectAccount', () => {
  // ADR-086 결정 6: 계정 변경은 캐릭터를 다시 고를 때까지 커밋하지 않는다.
  it('아무것도 저장하지 않고 후보 계정으로 예열한 뒤 캐릭터 선택 단계로 간다', async () => {
    const accounts = [account('acc-1'), account('acc-2')]
    useSettingsStore.setState({ ...initialSettingsState, status: 'selectingAccount', accounts })

    await useSettingsStore.getState().selectAccount('acc-2')

    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    expect(setTrackedCharacterOcidsMock).not.toHaveBeenCalled()
    expect(prefetchAccountDataMock).toHaveBeenCalledWith(
      'key-1',
      'acc-2',
      accounts[1].characters,
      expect.any(Function),
    )
    const state = useSettingsStore.getState()
    expect(state.status).toBe('selectingCharacters')
    expect(state.pendingAccountId).toBe('acc-2')
  })

  it('같은 계정을 다시 고르면 아무 쓰기 없이 닫는다 — 추적 목록을 건드리지 않는다', async () => {
    const accounts = [account('acc-old'), account('acc-2')]
    useSettingsStore.setState({ ...initialSettingsState, status: 'selectingAccount', accounts })

    await useSettingsStore.getState().selectAccount('acc-old')

    expect(setSelectedAccountIdMock).not.toHaveBeenCalled()
    expect(setTrackedCharacterOcidsMock).not.toHaveBeenCalled()
    expect(prefetchAccountDataMock).not.toHaveBeenCalled()
    expect(useSettingsStore.getState().status).toBe('idle')
  })
})

describe('useSettingsStore.commitAccountChange (ADR-086 결정 6)', () => {
  function primePending(): void {
    useSettingsStore.setState({
      ...initialSettingsState,
      status: 'selectingCharacters',
      pendingAccountId: 'acc-2',
    })
  }

  it('계정과 추적 목록을 함께 커밋하고 닫는다 — 중간 상태가 존재하지 않는다', async () => {
    primePending()

    await useSettingsStore.getState().commitAccountChange(['ocid-a', 'ocid-b'])

    expect(setSelectedAccountIdMock).toHaveBeenCalledWith('acc-2')
    expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith(['ocid-a', 'ocid-b'])
    expect(useSettingsStore.getState().status).toBe('idle')
  })

  it('수동 모드면 고른 캐릭터를 시드한다(ADR-035 결정 14(b))', async () => {
    trackingModeRef.current = 'manual'
    primePending()

    await useSettingsStore.getState().commitAccountChange(['ocid-a', 'ocid-b'])

    expect(seedManualTrackedContentMock).toHaveBeenCalledWith('ocid-a')
    expect(seedManualTrackedContentMock).toHaveBeenCalledWith('ocid-b')
  })

  it('자동 모드에서는 시드하지 않는다', async () => {
    primePending()

    await useSettingsStore.getState().commitAccountChange(['ocid-a'])

    expect(seedManualTrackedContentMock).not.toHaveBeenCalled()
  })

  it('저장이 실패하면 storageWriteFailed error가 된다', async () => {
    primePending()
    setSelectedAccountIdMock.mockRejectedValue(new Error('disk full'))

    await useSettingsStore.getState().commitAccountChange(['ocid-a'])

    const state = useSettingsStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'storageWriteFailed' })
    expect(setTrackedCharacterOcidsMock).not.toHaveBeenCalled()
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
