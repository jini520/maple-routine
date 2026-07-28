import { create } from 'zustand'
import { fetchCharacterList } from '../../nexon/character'
import { NexonAuthError, NexonRateLimitError } from '../../nexon/errors'
import { getAuthConfig, setApiKey, setSelectedAccountId } from '../../storage/api-key'
import type { MapleAccount } from '../../types'
import { useOnboardingStore } from '../onboarding/store'
import { prefetchAccountData } from '../onboarding/prefetch'
import { initialSettingsState, settingsReducer, type SettingsError, type SettingsState } from './state'

export interface SettingsStore extends SettingsState {
  changeApiKey(apiKey: string): Promise<void>
  refreshAccounts(): Promise<void>
  selectAccount(accountId: string): Promise<void>
  disconnect(): Promise<void>
  reset(): void
}

function toSettingsError(error: unknown): SettingsError {
  if (error instanceof NexonAuthError) {
    return { kind: 'invalidApiKey' }
  }
  if (error instanceof NexonRateLimitError) {
    return { kind: 'rateLimited' }
  }
  return { kind: 'network' }
}

export const useSettingsStore = create<SettingsStore>()((set, get) => {
  // ADR-016과 동일한 예열 패턴 — onboarding/prefetch.ts의 prefetchAccountData를 그대로 재사용한다.
  async function runPrefetch(apiKey: string, characters: MapleAccount['characters']) {
    await prefetchAccountData(apiKey, characters, (progress) => {
      set((state) =>
        settingsReducer(state, {
          type: 'PREFETCH_PROGRESS',
          completed: progress.completed,
          total: progress.total,
        }),
      )
    })
    set((state) => settingsReducer(state, { type: 'PREFETCH_FINISHED' }))
  }

  return {
    ...initialSettingsState,

    async changeApiKey(apiKey: string) {
      set((state) => settingsReducer(state, { type: 'VERIFY_START' }))

      let accounts: MapleAccount[]
      try {
        accounts = await fetchCharacterList(apiKey)
      } catch (error) {
        set((state) => settingsReducer(state, { type: 'VERIFY_FAILED', error: toSettingsError(error) }))
        return
      }

      try {
        await setApiKey(apiKey)
      } catch {
        set((state) =>
          settingsReducer(state, { type: 'VERIFY_FAILED', error: { kind: 'storageWriteFailed' } }),
        )
        return
      }

      set((state) => settingsReducer(state, { type: 'ACCOUNTS_VERIFIED', accounts }))
    },

    async refreshAccounts() {
      const authConfig = await getAuthConfig()
      if (authConfig === null) {
        set((state) => settingsReducer(state, { type: 'VERIFY_FAILED', error: { kind: 'network' } }))
        return
      }

      set((state) => settingsReducer(state, { type: 'VERIFY_START' }))

      let accounts: MapleAccount[]
      try {
        accounts = await fetchCharacterList(authConfig.apiKey)
      } catch (error) {
        set((state) => settingsReducer(state, { type: 'VERIFY_FAILED', error: toSettingsError(error) }))
        return
      }

      set((state) => settingsReducer(state, { type: 'ACCOUNTS_VERIFIED', accounts }))
    },

    async selectAccount(accountId: string) {
      try {
        await setSelectedAccountId(accountId)
      } catch {
        set((state) =>
          settingsReducer(state, { type: 'ACCOUNT_SELECTION_FAILED', error: { kind: 'storageWriteFailed' } }),
        )
        return
      }

      set((state) => settingsReducer(state, { type: 'SELECT_ACCOUNT', accountId }))

      // ADR-016/ADR-051: 계정 수와 무관하게 사용자가 확정한 이 경로에서만 예열을 시작한다.
      const account = get().accounts.find((candidate) => candidate.accountId === accountId)
      const authConfig = await getAuthConfig()
      if (account !== undefined && authConfig !== null) {
        await runPrefetch(authConfig.apiKey, account.characters)
      }
    },

    async disconnect() {
      await useOnboardingStore.getState().reset()
    },

    reset() {
      set(initialSettingsState)
    },
  }
})
