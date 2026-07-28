import { create } from 'zustand'
import { fetchCharacterList } from '../../nexon/character'
import { NexonAuthError, NexonRateLimitError } from '../../nexon/errors'
import { clearAuthConfig, getAuthConfig, setApiKey, setSelectedAccountId } from '../../storage/api-key'
import { setTrackedCharacterOcids } from '../../storage/character-selection'
import type { TrackingMode } from '../../storage/tracking-mode'
import { useToastStore } from '../toast/store'
import { seedManualTrackedContent } from '../tracking-mode/seed'
import { useTrackingModeStore } from '../tracking-mode/store'
import { prefetchAccountData } from './prefetch'
import { initialOnboardingState, onboardingReducer, type OnboardingError, type OnboardingState } from './state'

export interface OnboardingStore extends OnboardingState {
  restoreFromStorage(): Promise<void>
  submitApiKey(apiKey: string): Promise<void>
  selectAccount(accountId: string): Promise<void>
  selectTrackingMode(mode: TrackingMode): Promise<void>
  submitContentCharacters(ocids: string[]): Promise<void>
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
  // ADR-016: 계정이 확정된 직후(ADR-051 이후로는 사용자가 "계속하기"를 누른 selectAccount 한 곳뿐)
  // 전체 캐릭터를 예열한다. 진행률은 PREFETCH_PROGRESS로 스트리밍 반영하고, 끝나면 PREFETCH_FINISHED로
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
    useToastStore.getState().showSuccess('캐릭터 정보를 모두 불러왔어요')
    set((state) => onboardingReducer(state, { type: 'PREFETCH_FINISHED' }))
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

      set((state) => onboardingReducer(state, { type: 'API_KEY_VERIFIED', accounts }))
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
      set((state) => onboardingReducer(state, { type: 'API_KEY_VERIFIED', accounts }))
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

      // ADR-016/ADR-051: 계정 수와 무관하게 사용자가 확정한 이 경로에서만 예열을 시작한다.
      const account = get().accounts.find((candidate) => candidate.accountId === accountId)
      const authConfig = await getAuthConfig()
      if (account !== undefined && authConfig !== null) {
        await runPrefetch(authConfig.apiKey, account.characters)
      }
    },

    // ADR-035 결정 13/14: 온보딩에서 자동/수동 트래킹 모드를 고른 뒤 다음 단계로 넘어간다.
    // setMode는 결정 14(a)의 시드까지 마친 뒤 resolve되므로 그걸 await한다 — 온보딩 이 시점엔
    // 추적 목록(trackedCharacters:content/:boss)이 아직 비어 있어 시드 대상이 없지만, 나중에
    // 새 캐릭터를 추가할 때(트리거 b)와 동일한 경로를 타도록 비동기로 유지한다.
    async selectTrackingMode(mode: TrackingMode) {
      await useTrackingModeStore.getState().setMode(mode)
      set((state) => onboardingReducer(state, { type: 'SELECT_TRACKING_MODE', mode }))
    },

    // ADR-035 결정 13/14(b)/15: 컨텐츠 추적 캐릭터를 저장하고 온보딩을 마무리한다.
    // 수동 모드면 저장한 캐릭터 전원을 시드(트리거 b)하는 동안 'seedingTracking'에 머물며
    // 로딩(스피너)을 유지하고, 시드가 전부 끝난 뒤에만 완료된다. 자동 모드는 시드 없이 곧바로 완료.
    async submitContentCharacters(ocids: string[]) {
      await setTrackedCharacterOcids(ocids)

      if (useTrackingModeStore.getState().mode === 'manual') {
        set((state) => onboardingReducer(state, { type: 'SUBMIT_CONTENT_CHARACTERS' }))
        await Promise.all(ocids.map((ocid) => seedManualTrackedContent(ocid)))
      }

      set((state) => onboardingReducer(state, { type: 'ONBOARDING_FINISHED' }))
    },

    async reset() {
      await clearAuthConfig()
      set((state) => onboardingReducer(state, { type: 'RESET' }))
    },
  }
})
