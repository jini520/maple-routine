import { create } from 'zustand'
import { fetchCharacterList } from '../../nexon/character'
import { NexonAuthError, NexonRateLimitError } from '../../nexon/errors'
import { getAuthConfig, setApiKey, setSelectedAccountId } from '../../storage/api-key'
import { setTrackedCharacterOcids } from '../../storage/character-selection'
import type { MapleAccount } from '../../types'
import { useOnboardingStore } from '../onboarding/store'
import { prefetchAccountData } from '../onboarding/prefetch'
import { seedManualTrackedContent } from '../tracking-mode/seed'
import { useTrackingModeStore } from '../tracking-mode/store'
import { initialSettingsState, settingsReducer, type SettingsError, type SettingsState } from './state'

export interface SettingsStore extends SettingsState {
  changeApiKey(apiKey: string): Promise<void>
  refreshAccounts(): Promise<void>
  selectAccount(accountId: string): Promise<void>
  // ADR-086 결정 6: 계정 전환의 유일한 커밋 지점 — selectedAccountId 와 trackedCharacters 를 함께 쓴다.
  commitAccountChange(ocids: string[]): Promise<void>
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
  async function runPrefetch(
    apiKey: string,
    accountId: string,
    characters: MapleAccount['characters'],
  ) {
    await prefetchAccountData(apiKey, accountId, characters, (progress) => {
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

    // ADR-086 결정 6: 여기서는 아무것도 저장하지 않는다 — 예열만 돌리고 캐릭터 선택 단계로 넘어간다.
    // 취소하거나 도중에 앱이 죽으면 이전 계정이 온전히 그대로다.
    async selectAccount(accountId: string) {
      const authConfig = await getAuthConfig()

      // 같은 계정을 다시 골랐다면 바꿀 것이 없다 — 추적 목록을 건드리지 않고 닫는다.
      if (authConfig !== null && authConfig.selectedAccountId === accountId) {
        set((state) => settingsReducer(state, { type: 'RESET' }))
        return
      }

      set((state) => settingsReducer(state, { type: 'SELECT_ACCOUNT', accountId }))

      // ADR-016/ADR-051: 계정 수와 무관하게 사용자가 확정한 이 경로에서만 예열을 시작한다.
      // 예열이 쓰는 캐시는 **후보 계정의** 인덱스로 들어가므로(ADR-086 결정 9) 이전 계정 화면을
      // 오염시키지 않는다.
      const account = get().accounts.find((candidate) => candidate.accountId === accountId)
      if (account !== undefined && authConfig !== null) {
        await runPrefetch(authConfig.apiKey, accountId, account.characters)
      }
    },

    // ADR-086 결정 6: 계정 전환의 유일한 커밋 지점. 두 쓰기를 한 자리에 모아 "계정만 바뀌고
    // 추적 목록은 옛것"인 중간 상태가 아예 존재하지 않게 한다.
    async commitAccountChange(ocids: string[]) {
      const accountId = get().pendingAccountId
      if (accountId === null) {
        return
      }

      try {
        await setSelectedAccountId(accountId)
        await setTrackedCharacterOcids(ocids)
      } catch {
        set((state) =>
          settingsReducer(state, {
            type: 'ACCOUNT_SELECTION_FAILED',
            error: { kind: 'storageWriteFailed' },
          }),
        )
        return
      }

      // ADR-035 결정 14(b): 수동 모드면 새로 추적하게 된 캐릭터를 시드한다(온보딩의
      // submitContentCharacters 와 같은 처리 — 계정 전환도 "처음 고르는" 순간이다).
      if (useTrackingModeStore.getState().mode === 'manual') {
        await Promise.all(ocids.map((ocid) => seedManualTrackedContent(ocid)))
      }

      set((state) => settingsReducer(state, { type: 'RESET' }))
    },

    async disconnect() {
      await useOnboardingStore.getState().reset()
    },

    reset() {
      set(initialSettingsState)
    },
  }
})
