import { create } from 'zustand'
import { fetchCharacterList } from '../../nexon/character'
import { NexonAuthError, NexonRateLimitError } from '../../nexon/errors'
import { clearAuthConfig, getAuthConfig, setApiKey, setSelectedAccountId } from '../../storage/api-key'
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

export const useOnboardingStore = create<OnboardingStore>()((set) => {
  // ADR-008: 계정이 1개라 자동 completed로 전이할 때도 selectedAccountId가 먼저 storage에 저장되어야 한다.
  // restoreFromStorage/submitApiKey 둘 다 fetchCharacterList 성공 이후 이 마무리 단계를 공유해
  // "자동완료" 규칙이 재개 경로에서도 동일하게 적용되도록 한다.
  async function finalizeVerifiedAccounts(accounts: OnboardingState['accounts']): Promise<void> {
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

      await finalizeVerifiedAccounts(accounts)
    },

    async submitApiKey(apiKey: string) {
      set((state) => onboardingReducer(state, { type: 'SUBMIT_API_KEY' }))

      let accounts: OnboardingState['accounts']
      try {
        accounts = await fetchCharacterList(apiKey)
      } catch (error) {
        set((state) =>
          onboardingReducer(state, { type: 'API_KEY_REJECTED', error: toOnboardingError(error) }),
        )
        return
      }

      await setApiKey(apiKey)
      await finalizeVerifiedAccounts(accounts)
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
    },

    async reset() {
      await clearAuthConfig()
      set((state) => onboardingReducer(state, { type: 'RESET' }))
    },
  }
})
