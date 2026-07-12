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

  // changeApiKey/refreshAccounts가 공유하는 마무리 단계 — 계정 검증 이후의 흐름은 두 트리거가 동일하다.
  async function finalizeAccounts(accounts: MapleAccount[], apiKey: string): Promise<void> {
    set((state) => settingsReducer(state, { type: 'ACCOUNTS_VERIFIED', accounts }))

    if (get().status === 'prefetching') {
      await setSelectedAccountId(accounts[0].accountId)
      await runPrefetch(apiKey, accounts[0].characters)
    }
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

      await finalizeAccounts(accounts, apiKey)
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

      await finalizeAccounts(accounts, authConfig.apiKey)
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
