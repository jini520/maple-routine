import { create } from 'zustand'
import { fetchCharacterList } from '../../nexon/character'
import { isInvalidApiKeyError, NexonRateLimitError } from '../../nexon/errors'
import {
  clearAuthConfig,
  getAuthConfig,
  removeApiKey,
  setApiKey,
  setSelectedAccountId,
} from '../../storage/api-key'
import { setTrackedCharacterOcids } from '../../storage/character-selection'
import { type TrackingMode } from '../../storage/tracking-mode'
import { useToastStore } from '../toast/store'
import { formatOnboardingError } from './format'
import { seedManualTrackedContent } from '../tracking-mode/seed'
import { useTrackingModeStore } from '../tracking-mode/store'
import { prefetchAccountData } from './prefetch'
import { deriveResumeTarget, type ResumeTarget } from './resume'
import { initialOnboardingState, onboardingReducer, type OnboardingError, type OnboardingState } from './state'

export interface OnboardingStore extends OnboardingState {
  restoreFromStorage(): Promise<void>
  submitApiKey(apiKey: string): Promise<void>
  selectAccount(accountId: string): Promise<void>
  selectTrackingMode(mode: TrackingMode): Promise<void>
  submitContentCharacters(ocids: string[]): Promise<void>
  // ADR-086 결정 8: 고른 계정의 후보가 0명일 때의 유일한 탈출구 — 온보딩 중에는 설정 화면이 없다.
  restartAccountSelection(): Promise<void>
  // ADR-115 결정 10: 저장된 키가 무효화됐을 때(400 OPENAPI00005 · 401/403) 부르는 유일한 진입점.
  // 알리기만 하고(모달) 이동·삭제는 하지 않는다 — 그것은 아래 confirmApiKeyInvalid 가 한다.
  noticeApiKeyInvalid(): void
  // 그 모달의 "확인" — 키 입력 화면으로 이동하고 저장된 apiKey 를 지운다.
  confirmApiKeyInvalid(): Promise<void>
  reset(): Promise<void>
}

function toOnboardingError(error: unknown): OnboardingError {
  // ADR-115 결정 9: 400 OPENAPI00005 도 무효 키다(판정은 nexon/errors 한 곳). 이 폼에서 키를 잘못
  // 입력하면 전에는 "네트워크 오류가 발생했습니다"가 떴다 — 원인이 키인데 네트워크를 가리켰다.
  if (isInvalidApiKeyError(error)) {
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
  async function runPrefetch(
    apiKey: string,
    accountId: string,
    characters: OnboardingState['accounts'][number]['characters'],
  ) {
    await prefetchAccountData(apiKey, accountId, characters, (progress) => {
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

  // 저장된 키로 계정 목록을 다시 받아 선택 화면으로 보낸다. 부팅 재개(restoreFromStorage)와
  // 후보 0명일 때의 되돌아가기(restartAccountSelection)가 같은 경로를 쓴다.
  async function loadAccountsForSelection(apiKey: string): Promise<void> {
    set((state) => onboardingReducer(state, { type: 'SUBMIT_API_KEY' }))

    let accounts: OnboardingState['accounts']
    try {
      accounts = await fetchCharacterList(apiKey)
    } catch (error) {
      // ADR-065 결정 1: 전에는 이 경로에 토스트가 없어, 아무 설명 없이 API 키 입력 화면으로
      // 되돌아갔다(status가 error인데 accounts가 비면 화면이 폼만 다시 그린다).
      const onboardingError = toOnboardingError(error)
      useToastStore.getState().showError(formatOnboardingError(onboardingError))
      set((state) => onboardingReducer(state, { type: 'API_KEY_REJECTED', error: onboardingError }))
      return
    }

    set((state) => onboardingReducer(state, { type: 'API_KEY_VERIFIED', accounts }))
  }

  // 재개 파생(deriveResumeTarget)이 가리킨 뒤 단계로 곧바로 전이한다. 부팅(restoreFromStorage)과
  // 키 재입력(submitApiKey)이 같은 전이를 쓴다 — 이 자리에 네트워크는 없다(ADR-115 결정 4).
  function commitResumedStep(target: Extract<ResumeTarget, { selectedAccountId: string }>): void {
    if (target.status === 'completed') {
      set((state) =>
        onboardingReducer(state, {
          type: 'RESTORE_COMPLETED',
          selectedAccountId: target.selectedAccountId,
        }),
      )
      return
    }

    set((state) =>
      onboardingReducer(state, {
        type: 'RESTORE_STEP',
        status: target.status,
        selectedAccountId: target.selectedAccountId,
      }),
    )
  }

  return {
    ...initialOnboardingState,

    // ADR-086 결정 1: 저장된 값에서 재개 지점을 파생한다 — 전에는 selectedAccountId 하나만 보고
    // 곧바로 completed로 전이해, 모드·캐릭터를 고르지 않은 채 빈 메인으로 떨어졌다.
    // 진행 상태 전용 키를 두지 않는 이유: 각 단계의 산출물이 이미 영속화돼 있어서, 진행 상태를
    // 따로 쓰면 진실이 둘이 되고 한쪽만 써진 채 앱이 죽는 순간 어긋난다.
    async restoreFromStorage() {
      const target = await deriveResumeTarget()

      if (target.status === 'awaitingApiKey') {
        return
      }

      if (target.status === 'selectingAccount') {
        await loadAccountsForSelection(target.apiKey)
        return
      }

      commitResumedStep(target)
    },

    async submitApiKey(apiKey: string) {
      set((state) => onboardingReducer(state, { type: 'SUBMIT_API_KEY' }))

      let accounts: OnboardingState['accounts']
      try {
        accounts = await fetchCharacterList(apiKey)
      } catch (error) {
        // ADR-065 결정 1: 원인은 이미 계산하면서도 토스트는 하드코딩 문구를 띄우고 있었다.
        const onboardingError = toOnboardingError(error)
        useToastStore.getState().showError(formatOnboardingError(onboardingError))
        set((state) => onboardingReducer(state, { type: 'API_KEY_REJECTED', error: onboardingError }))
        return
      }

      // ADR-065 결정 1: 전에는 try 밖이라 미처리 rejection이었다 — 저장이 실패해도 아무 일도
      // 안 일어난 것처럼 보였다. settings/store.ts 의 changeApiKey 와 같은 처리로 맞춘다.
      try {
        await setApiKey(apiKey)
      } catch {
        const onboardingError = { kind: 'storageWriteFailed' } as const
        useToastStore.getState().showError(formatOnboardingError(onboardingError))
        set((state) => onboardingReducer(state, { type: 'API_KEY_REJECTED', error: onboardingError }))
        return
      }

      useToastStore.getState().showSuccess('API 키를 확인했어요')

      // ADR-115 결정 4: 키 재입력이면 뒤 단계를 저장된 값으로 재개한다 — 계정 선택·모드·캐릭터를
      // 다시 묻지 않는다. 파생은 부팅과 같은 함수 하나가 한다(setApiKey 뒤라야 authConfig가 채워져
      // 있다). 예열(ADR-016)은 여기서 돌지 않는다 — 계정을 확정하는 selectAccount 하나뿐이다(ADR-051).
      const target = await deriveResumeTarget()
      // 결정 5: 새로 넣은 키가 다른 넥슨 계정의 키일 수 있다. 저장된 selectedAccountId가 방금 받은
      // 응답에 없으면 재개하지 않고 기존대로 계정 선택부터 간다 — 안 그러면 남의 계정 키로 이전 계정
      // ocid 추적 목록을 그대로 쓰게 된다. 추가 호출은 없다(이미 손에 있는 응답으로 판정한다).
      // awaitingApiKey는 setApiKey 직후라 정상적으로는 올 수 없다 — 방어적으로 기존 흐름에 떨어뜨린다.
      if (
        target.status !== 'awaitingApiKey' &&
        target.status !== 'selectingAccount' &&
        accounts.some((candidate) => candidate.accountId === target.selectedAccountId)
      ) {
        commitResumedStep(target)
        return
      }

      set((state) => onboardingReducer(state, { type: 'API_KEY_VERIFIED', accounts }))
    },

    async selectAccount(accountId: string) {
      try {
        await setSelectedAccountId(accountId)
      } catch {
        // ADR-083 결정 4: 목록 상단 인라인 문구를 걷어내면서 이 경로가 유일하게 신호가 없는
        // 자리가 됐다 — 그대로 두면 계정을 눌렀는데 아무 일도 안 일어난 것처럼 보인다.
        // 액션은 두지 않는다(다시 계정을 누르면 되는 일이라 중복이다, ADR-065 결정 1과 같은 판단).
        const onboardingError = { kind: 'storageWriteFailed' } as const
        useToastStore.getState().showError(formatOnboardingError(onboardingError))
        set((state) =>
          onboardingReducer(state, { type: 'ACCOUNT_SELECTION_FAILED', error: onboardingError }),
        )
        return
      }

      set((state) => onboardingReducer(state, { type: 'SELECT_ACCOUNT', accountId }))

      // ADR-016/ADR-051: 계정 수와 무관하게 사용자가 확정한 이 경로에서만 예열을 시작한다.
      const account = get().accounts.find((candidate) => candidate.accountId === accountId)
      const authConfig = await getAuthConfig()
      if (account !== undefined && authConfig !== null) {
        await runPrefetch(authConfig.apiKey, accountId, account.characters)
      }
    },

    // ADR-086 결정 8: 고른 계정에 고를 수 있는 캐릭터가 하나도 없을 때 계정 선택으로 되돌아간다.
    // 저장된 selectedAccountId 도 비운다 — 안 비우면 여기서 앱을 종료했을 때 결정 1의 재개가
    // 같은 계정의 캐릭터 단계로 다시 데려와 같은 막다른 길이 반복된다.
    async restartAccountSelection() {
      const authConfig = await getAuthConfig()
      if (authConfig === null) {
        return
      }
      await setSelectedAccountId(null)
      await loadAccountsForSelection(authConfig.apiKey)
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

    // ADR-115 결정 10: 무효 키를 만나면 **알리기만** 한다 — 화면을 빼앗지 않는다.
    // 결정 1 의 "토스트 + 즉시 이동"은 폐기됐다: 이동이 먼저 일어나면 사용자는 이미 바뀐 화면에서
    // 이유를 읽게 되고, 토스트는 스스로 사라져 놓칠 수 있다. 이제 원래 화면 위에 **닫을 수 없는**
    // 모달이 덮이고, 이동은 사용자가 "확인"을 눌러야(confirmApiKeyInvalid) 일어난다.
    noticeApiKeyInvalid() {
      // 결정 6: 멱등 가드. 동기 함수라 이 구간 전체가 원자적이다 — 여러 화면·여러 캐릭터에서
      // 401(400 00005)이 동시에 터져도 모달은 하나다. 키 입력 화면에서 다시 나는 실패는 그때
      // status가 completed가 아니라 여기 걸린다(재이동 루프가 구조적으로 불가능하다 —
      // 그 실패는 ADR-065 결정 1의 폼 토스트로 남는다).
      if (get().status !== 'completed' || get().apiKeyInvalidNotice) {
        return
      }

      // status는 completed 그대로다 — 뒤에 원래 화면이 남아 있어야 사용자가 무엇을 하다 이렇게
      // 됐는지 보면서 이유를 읽는다(결정 10). 저장소도 아직 건드리지 않는다.
      set((state) => onboardingReducer(state, { type: 'API_KEY_INVALID_NOTICED' }))
    },

    // ADR-115 결정 10: 모달의 "확인" — 여기서야 이동과 삭제가 일어난다.
    async confirmApiKeyInvalid() {
      if (!get().apiKeyInvalidNotice) {
        return
      }

      // 결정 2: 이동은 상태를 뒤집는 것으로 일어난다 — App.tsx의 isCompleted 가드가 라우터로
      // /onboarding에 보낸다. 스토어는 라우터를 모르고 window.location도 쓰지 않는다(문서 리로드가
      // 네이티브 SQLite 커넥션을 stale하게 만든다, ADR-050).
      // 새 이벤트를 만들지 않고 RESET을 재사용한다 — 결과(initialOnboardingState)가 정확히 같아서,
      // 같은 결과의 이벤트를 하나 더 두면 리듀서의 진실이 둘이 된다. 무효화와 연결 해제의 차이는
      // 리듀서가 아니라 저장소에서 무엇을 지우는가(removeApiKey vs clearAuthConfig)에 있다.
      set((state) => onboardingReducer(state, { type: 'RESET' }))

      try {
        await removeApiKey()
      } catch {
        // 결정 3의 "알려진 열화": 삭제가 실패하면 재시작 시 옛 무효 키가 되살아나지만, 그때는
        // 다시 이 경로를 탈 뿐이라 막다른 길이 아니다. 화면은 이미 키 입력에 가 있으므로 사용자가
        // 여기서 할 수 있는 일도 없다. rethrow하면 호출부가 전부 void 호출이라 미처리 rejection이
        // 된다(ADR-065 결정 1이 고쳤던 그 결함과 같은 종류다).
      }
    },

    async reset() {
      await clearAuthConfig()
      set((state) => onboardingReducer(state, { type: 'RESET' }))
    },
  }
})
