import { create } from 'zustand'
import { fetchCharacterList } from '../../nexon/character'
import { isInvalidApiKeyError, NexonRateLimitError } from '../../nexon/errors'
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
  // ADR-115 결정 9: 400 OPENAPI00005 도 무효 키다(판정은 nexon/errors 한 곳). 계정 변경 모달은
  // **저장된 키**로 재조회하므로 이 경로의 00005 가 곧 "저장된 키가 폐기됐다"이다.
  if (isInvalidApiKeyError(error)) {
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
        const settingsError = toSettingsError(error)

        // ADR-115 결정 7: 여기 401은 사용자가 방금 입력한 키가 아니라 **저장된 키**가 무효화된 것이다
        // (이 경로는 키 재입력 없이 저장된 키로 재조회한다). 인라인 카드에 머무르면 키를 바꿀 자리가
        // 없어 막다른 길이므로(이슈 #157) 무효화 진입점 하나로 넘긴다 — 토스트 + 키 입력 화면 자동 이동.
        // 멱등 가드는 그 함수 안 한 곳이라(결정 6) 여기서 상태를 다시 확인하지 않는다.
        if (settingsError.kind === 'invalidApiKey') {
          await useOnboardingStore.getState().invalidateApiKey()
          // 화면은 곧 /onboarding 으로 간다(결정 2). error를 남겨 두면 나중에 설정을 다시 열었을 때
          // 지나간 실패가 되살아난다. idle 복귀는 AccountModal 의 닫힘 판정이기도 해 모달이 정리된다.
          set((state) => settingsReducer(state, { type: 'RESET' }))
          return
        }

        // 나머지 원인(429·네트워크·저장 실패)은 그대로 모달 안 인라인 카드다(ADR-063 — 모달 본문
        // 전체를 차지하는 자리라 토스트로 옮기면 빈 상자가 된다).
        set((state) => settingsReducer(state, { type: 'VERIFY_FAILED', error: settingsError }))
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
