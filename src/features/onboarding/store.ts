import { create } from 'zustand'
import { fetchCharacterList } from '../../nexon/character'
import { isInvalidApiKeyError, NexonRateLimitError } from '../../nexon/errors'
import { clearAuthConfig, removeApiKey, setApiKey } from '../../storage/api-key'
import {
  getTrackedCharacterOcids,
  setTrackedCharacterOcids,
} from '../../storage/character-selection'
import { type TrackingMode } from '../../storage/tracking-mode'
import { useToastStore } from '../toast/store'
import { formatOnboardingError } from './format'
import { seedManualTrackedContent } from '../tracking-mode/seed'
import { useTrackingModeStore } from '../tracking-mode/store'
import { deriveResumeTarget, type ResumeTarget } from './resume'
import {
  initialOnboardingState,
  onboardingReducer,
  type ApiKeyNoticeKind,
  type OnboardingError,
  type OnboardingState,
} from './state'

export interface OnboardingStore extends OnboardingState {
  restoreFromStorage(): Promise<void>
  submitApiKey(apiKey: string): Promise<void>
  selectTrackingMode(mode: TrackingMode): Promise<void>
  submitContentCharacters(ocids: string[]): Promise<void>
  // 결정 10 결정 1: 저장된 키로 앞으로 갈 수 없게 됐을 때는 여기로만 들어온다.
  // 원인은 무효 키(400 OPENAPI00005 · 401/403)와 429 둘이고, 사슬은 하나이며 문구만 갈린다.
  // 알리기만 하고(모달) 이동·삭제는 하지 않는다. 그것은 아래 confirmApiKeyNotice 가 한다.
  noticeApiKeyIssue(kind: ApiKeyNoticeKind): void
  // 그 모달의 "확인" — 키 입력 화면으로 이동하고 저장된 apiKey 를 지운다(원인과 무관하게 같다).
  confirmApiKeyNotice(): Promise<void>
  reset(): Promise<void>
}

function toOnboardingError(error: unknown): OnboardingError {
  // 400 OPENAPI00005 도 무효 키다(판정은 nexon/errors 한 곳). 이 폼에서 키를 잘못
  // 입력하면 전에는 "네트워크 오류가 발생했습니다"가 떴다. 원인이 키인데 네트워크를 가리켰다.
  if (isInvalidApiKeyError(error)) {
    return { kind: 'invalidApiKey' }
  }
  if (error instanceof NexonRateLimitError) {
    return { kind: 'rateLimited' }
  }
  return { kind: 'network' }
}

export const useOnboardingStore = create<OnboardingStore>()((set, get) => {
  // 재개 파생(deriveResumeTarget)이 가리킨 뒤 단계로 곧바로 전이한다. 부팅(restoreFromStorage)과
  // 키 재입력(submitApiKey)이 같은 전이를 쓴다. 이 자리에 네트워크는 없다.
  function commitResumedStep(target: Exclude<ResumeTarget, { status: 'awaitingApiKey' }>): void {
    if (target.status === 'completed') {
      set((state) => onboardingReducer(state, { type: 'RESTORE_COMPLETED' }))
      return
    }

    set((state) => onboardingReducer(state, { type: 'RESTORE_STEP', status: target.status }))
  }

  return {
    ...initialOnboardingState,

    // 저장된 값에서 재개 지점을 파생한다.
    // 진행 상태 전용 키를 두지 않는 이유: 각 단계의 산출물이 이미 영속화돼 있어서, 진행 상태를
    // 따로 쓰면 진실이 둘이 되고 한쪽만 써진 채 앱이 죽는 순간 어긋난다.
    async restoreFromStorage() {
      const target = await deriveResumeTarget()

      if (target.status === 'awaitingApiKey') {
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
        // 원인은 이미 계산하면서도 토스트는 하드코딩 문구를 띄우고 있었다.
        const onboardingError = toOnboardingError(error)
        useToastStore.getState().showError(formatOnboardingError(onboardingError))
        set((state) => onboardingReducer(state, { type: 'API_KEY_REJECTED', error: onboardingError }))
        return
      }

      // 전에는 try 밖이라 미처리 rejection이었다. 저장이 실패해도 아무 일도
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

      // 키 재입력이면 뒤 단계를 저장된 값으로 재개한다. 모드·캐릭터를 다시 묻지
      // 않는다. 파생은 부팅과 같은 함수 하나가 한다(setApiKey 뒤라야 authConfig가 채워져 있다).
      const target = await deriveResumeTarget()
      // awaitingApiKey는 setApiKey 직후라 정상적으로는 올 수 없다. 방어적으로 첫 단계에 떨어뜨린다.
      if (target.status === 'awaitingApiKey') {
        set((state) => onboardingReducer(state, { type: 'API_KEY_VERIFIED', accounts }))
        return
      }

      // 계정을 고르지 않으므로 대조할 **저장된 계정** 이 없다. 가드의 목적은 그대로다
      // (남의 계정 키로 이전 목록을 쓰게 두지 않는다). 같은 응답으로 추적 ocid를 대조한다.
      //
      // 지킬 목록이 없으면 판정 대상 자체가 없다. 여기서 "하나도 없다"로 읽으면 처음 키를 넣는
      // 신규 사용자가 목록이 비었다는 이유로 스케줄 관리 방법 단계를 건너뛴다.
      const trackedOcids = (await getTrackedCharacterOcids()) ?? []
      if (trackedOcids.length === 0) {
        commitResumedStep(target)
        return
      }

      // 계정을 넘어 고르는 것이 이 개편의 본론이라, 겹치는 ocid가 어느 계정에 있는지는 묻지 않는다.
      const ocidsInResponse = new Set(
        accounts.flatMap((candidate) => candidate.characters.map((character) => character.ocid)),
      )
      if (trackedOcids.some((ocid) => ocidsInResponse.has(ocid))) {
        commitResumedStep(target)
        return
      }

      // 하나도 없다. 이 키는 다른 넥슨 계정의 것이다. 캐릭터부터 다시 고르게 한다.
      set((state) =>
        onboardingReducer(state, { type: 'RESTORE_STEP', status: 'selectingContentCharacters' }),
      )
    },

    // 결정 13/14: 온보딩에서 자동/수동 트래킹 모드를 고른 뒤 다음 단계로 넘어간다.
    // setMode는 결정 14(a)의 시드까지 마친 뒤 resolve되므로 그걸 await한다. 온보딩 이 시점엔
    // 추적 목록(trackedCharacters:content/:boss)이 아직 비어 있어 시드 대상이 없지만, 나중에
    // 새 캐릭터를 추가할 때(트리거 b)와 동일한 경로를 타도록 비동기로 유지한다.
    async selectTrackingMode(mode: TrackingMode) {
      await useTrackingModeStore.getState().setMode(mode)
      set((state) => onboardingReducer(state, { type: 'SELECT_TRACKING_MODE', mode }))
    },

    // 결정 13/14(b)/15: 컨텐츠 추적 캐릭터를 저장하고 온보딩을 마무리한다.
    // 수동 모드면 저장한 캐릭터 전원을 시드(트리거 b)하는 동안 'seedingTracking'에 머물며
    // 로딩(스피너)을 유지하고, 시드가 전부 끝난 뒤에만 완료된다. 자동 모드는 시드 없이 곧바로 완료.
    async submitContentCharacters(ocids: string[]) {
      await setTrackedCharacterOcids(ocids)

      if (useTrackingModeStore.getState().mode === 'manual') {
        set((state) => onboardingReducer(state, { type: 'SUBMIT_CONTENT_CHARACTERS' }))
        await seedManualTrackedContent(ocids)
      }

      set((state) => onboardingReducer(state, { type: 'ONBOARDING_FINISHED' }))
    },

    // 저장된 키로 앞으로 갈 수 없게 되면 **알리기만** 한다. 화면을 빼앗지 않는다.
    // 결정 1 의 "토스트 + 즉시 이동"은 폐기됐다: 이동이 먼저 일어나면 사용자는 이미 바뀐 화면에서
    // 이유를 읽게 되고, 토스트는 스스로 사라져 놓칠 수 있다. 이제 원래 화면 위에 **닫을 수 없는**
    // 모달이 덮이고, 이동은 사용자가 "확인"을 눌러야(confirmApiKeyNotice) 일어난다.
    // 429도 이 사슬을 그대로 탄다. 처방이 같아 화면도 같다. 갈리는 것은 문구뿐이다.
    noticeApiKeyIssue(kind: ApiKeyNoticeKind) {
      // 멱등 가드. 동기 함수라 이 구간 전체가 원자적이다. 여러 화면·여러 캐릭터에서
      // 동시에 터져도 모달은 하나이고, 원인이 겹치면 **먼저 뜬 것**이 유지된다(리듀서도 같은 규칙).
      if (get().apiKeyNotice !== null) {
        return
      }

      // 가드 조건이 `status !== 'completed'` 에서 여기로 바뀌었다. 옛 조건으로는
      // **온보딩 안에서 잠긴 사용자를 구할 수 없다**. 429 로 로스터가 비는 이슈 #176 의 잠금은
      // selectingContentCharacters 에서 일어나는데, 그 상태가 completed 가 아니라 통째로 막혔다.
      // 막는 대상은 그대로다: 이 두 상태가 곧 "이미 키 입력 화면"이라 보낼 곳이 없고, 그래서
      // 재이동 루프도 여전히 불가능하다. 폼에서 다시 나는 실패는 폼 자체의 토스트가 맡는다
      // .
      const { status } = get()
      if (status === 'awaitingApiKey' || status === 'verifyingApiKey') {
        return
      }

      // status는 그대로다. 뒤에 원래 화면이 남아 있어야 사용자가 무엇을 하다 이렇게 됐는지
      // 보면서 이유를 읽는다(결정 10). 저장소도 아직 건드리지 않는다.
      set((state) => onboardingReducer(state, { type: 'API_KEY_NOTICED', kind }))
    },

    // 모달의 "확인" — 여기서야 이동과 삭제가 일어난다.
    // 원인별로 갈라 처리하지 않는다. 429도 키를 지운다(사용자 결정 2026-08-08).
    // 안 지우면 재시작 때 같은 키로 completed 에 복귀해 또 막히고, 사용자에게는 "재시작하면 되는
    // 것처럼 보이다가 안 되는" 상태가 된다. 같은 키를 다시 붙여넣는 것은 막지 않는다.
    async confirmApiKeyNotice() {
      if (get().apiKeyNotice === null) {
        return
      }

      // 결정 2: 이동은 상태를 뒤집는 것으로 일어난다. App.tsx의 isCompleted 가드가 라우터로
      // /onboarding에 보낸다. 스토어는 라우터를 모르고 브라우저 주소를 직접 갈아끼우지도 않는다(문서 리로드가
      // 네이티브 SQLite 커넥션을 stale하게 만든다).
      // 새 이벤트를 만들지 않고 RESET을 재사용한다. 결과(initialOnboardingState)가 정확히 같아서,
      // 같은 결과의 이벤트를 하나 더 두면 리듀서의 진실이 둘이 된다. 무효화와 연결 해제의 차이는
      // 리듀서가 아니라 저장소에서 무엇을 지우는가(removeApiKey vs clearAuthConfig)에 있다.
      set((state) => onboardingReducer(state, { type: 'RESET' }))

      try {
        await removeApiKey()
      } catch {
        // 결정 3의 "알려진 열화": 삭제가 실패하면 재시작 시 옛 무효 키가 되살아나지만, 그때는
        // 다시 이 경로를 탈 뿐이라 막다른 길이 아니다. 화면은 이미 키 입력에 가 있으므로 사용자가
        // 여기서 할 수 있는 일도 없다. rethrow하면 호출부가 전부 void 호출이라 미처리 rejection이
        // 된다(이 고쳤던 그 결함과 같은 종류다).
      }
    },

    async reset() {
      await clearAuthConfig()
      set((state) => onboardingReducer(state, { type: 'RESET' }))
    },
  }
})
