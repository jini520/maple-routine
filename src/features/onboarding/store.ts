import { create } from 'zustand'
import { fetchCharacterList } from '../../nexon/character'
import { NexonAuthError, NexonRateLimitError } from '../../nexon/errors'
import { clearAuthConfig, getAuthConfig, setApiKey, setSelectedAccountId } from '../../storage/api-key'
import { useToastStore } from '../toast/store'
import { prefetchAccountData } from './prefetch'
import { initialOnboardingState, onboardingReducer, type OnboardingError, type OnboardingState } from './state'

export interface OnboardingStore extends OnboardingState {
  restoreFromStorage(): Promise<void>
  submitApiKey(apiKey: string): Promise<void>
  selectAccount(accountId: string): Promise<void>
  reset(): Promise<void>
}

function toOnboardingError(error: unknown): OnboardingError {
  if (error instanceof NexonAuthError) {
    return { kind: 'invalidApiKey' }
  }
  if (error instanceof NexonRateLimitError) {
    return { kind: 'rateLimited' }
  }
  return { kind: 'network' }
}

export const useOnboardingStore = create<OnboardingStore>()((set, get) => {
  // ADR-016: 계정이 확정된 직후(단일 계정 자동 확정 또는 다중 계정 중 선택) 전체 캐릭터를
  // 예열한다. 진행률은 PREFETCH_PROGRESS로 스트리밍 반영하고, 끝나면 PREFETCH_FINISHED로
  // 'completed'로 넘어간다.
  async function runPrefetch(apiKey: string, characters: OnboardingState['accounts'][number]['characters']) {
    await prefetchAccountData(apiKey, characters, (progress) => {
      set((state) =>
        onboardingReducer(state, {
          type: 'PREFETCH_PROGRESS',
          completed: progress.completed,
          total: progress.total,
        }),
      )
    })
    set((state) => onboardingReducer(state, { type: 'PREFETCH_FINISHED' }))
  }

  // ADR-008: 계정이 1개라 자동 completed로 전이할 때도 selectedAccountId가 먼저 storage에 저장되어야 한다.
  // restoreFromStorage/submitApiKey 둘 다 fetchCharacterList 성공 이후 이 마무리 단계를 공유해
  // "자동완료" 규칙이 재개 경로에서도 동일하게 적용되도록 한다.
  async function finalizeVerifiedAccounts(
    accounts: OnboardingState['accounts'],
    apiKey: string,
  ): Promise<void> {
    if (accounts.length === 1) {
      try {
        await setSelectedAccountId(accounts[0].accountId)
      } catch {
        set((state) =>
          onboardingReducer(state, {
            type: 'API_KEY_REJECTED',
            error: { kind: 'storageWriteFailed' },
          }),
        )
        return
      }
    }

    set((state) => onboardingReducer(state, { type: 'API_KEY_VERIFIED', accounts }))

    // ADR-016: 계정이 정확히 1개면 reducer가 곧바로 'prefetching'으로 전이한다 — 그 경우에만 예열을 시작한다.
    if (get().status === 'prefetching') {
      await runPrefetch(apiKey, accounts[0].characters)
    }
  }

  return {
    ...initialOnboardingState,

    async restoreFromStorage() {
      const authConfig = await getAuthConfig()
      if (authConfig === null) {
        return
      }

      if (authConfig.selectedAccountId !== null) {
        set((state) =>
          onboardingReducer(state, {
            type: 'RESTORE_COMPLETED',
            selectedAccountId: authConfig.selectedAccountId as string,
          }),
        )
        return
      }

      set((state) => onboardingReducer(state, { type: 'SUBMIT_API_KEY' }))

      let accounts: OnboardingState['accounts']
      try {
        accounts = await fetchCharacterList(authConfig.apiKey)
      } catch (error) {
        set((state) =>
          onboardingReducer(state, { type: 'API_KEY_REJECTED', error: toOnboardingError(error) }),
        )
        return
      }

      await finalizeVerifiedAccounts(accounts, authConfig.apiKey)
    },

    async submitApiKey(apiKey: string) {
      set((state) => onboardingReducer(state, { type: 'SUBMIT_API_KEY' }))

      let accounts: OnboardingState['accounts']
      try {
        accounts = await fetchCharacterList(apiKey)
      } catch (error) {
        useToastStore.getState().showError('API 키를 확인하지 못했어요')
        set((state) =>
          onboardingReducer(state, { type: 'API_KEY_REJECTED', error: toOnboardingError(error) }),
        )
        return
      }

      useToastStore.getState().showSuccess('API 키를 확인했어요')
      await setApiKey(apiKey)
      await finalizeVerifiedAccounts(accounts, apiKey)
    },

    async selectAccount(accountId: string) {
      try {
        await setSelectedAccountId(accountId)
      } catch {
        set((state) =>
          onboardingReducer(state, {
            type: 'ACCOUNT_SELECTION_FAILED',
            error: { kind: 'storageWriteFailed' },
          }),
        )
        return
      }

      set((state) => onboardingReducer(state, { type: 'SELECT_ACCOUNT', accountId }))

      // ADR-016: 다중 계정 중 선택한 경우도 단일 계정과 동일하게 예열을 거친다.
      const account = get().accounts.find((candidate) => candidate.accountId === accountId)
      const authConfig = await getAuthConfig()
      if (account !== undefined && authConfig !== null) {
        await runPrefetch(authConfig.apiKey, account.characters)
      }
    },

    async reset() {
      await clearAuthConfig()
      set((state) => onboardingReducer(state, { type: 'RESET' }))
    },
  }
})
