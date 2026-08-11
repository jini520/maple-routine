import type { MapleAccount } from '@core/types'
import type { TrackingMode } from '@core/storage/tracking-mode'

export type OnboardingStatus =
  | 'awaitingApiKey'
  | 'verifyingApiKey'
  | 'selectingAccount'
  | 'prefetching'
  | 'selectingTrackingMode'
  | 'selectingContentCharacters'
  | 'seedingTracking'
  | 'completed'
  | 'error'

export type OnboardingError =
  | { kind: 'invalidApiKey' } // 401/403
  | { kind: 'rateLimited' } // 429
  | { kind: 'network' } // 네트워크/5xx/JSON 파싱 실패 등
  | { kind: 'storageWriteFailed' } // 로컬 저장 실패

export interface PrefetchProgress {
  completed: number
  total: number
}

/**
 * 저장된 키로는 앞으로 갈 수 없게 된 원인([[ADR-116]] 결정 1).
 *
 * 원인은 둘이지만 **처방이 같다** — 사용자가 새 키를 넣어야 한다. 그래서 알림 사슬(모달 → 확인 →
 * 키 입력 화면 + `apiKey` 삭제)은 하나이고 갈리는 것은 문구뿐이다. 종류마다 다른 알림을 만들면
 * 문구·액션 표가 두 벌이 된다.
 */
export type ApiKeyNoticeKind =
  | 'invalid' // 400 OPENAPI00005 · 401/403 — 키 자체가 무효해졌다(ADR-115 결정 9)
  | 'rateLimited' // 429 — 개발 단계 키의 호출 한도 초과(ADR-116)

export interface OnboardingState {
  status: OnboardingStatus
  accounts: MapleAccount[]
  selectedAccountId: string | null
  error: OnboardingError | null
  prefetchProgress: PrefetchProgress | null
  /**
   * 키를 다시 받아야 한다는 것을 **알렸고 사용자의 확인을 기다리는 중**이며, 그 **원인**이 무엇인지
   * ([[ADR-115]] 결정 10 · [[ADR-116]] 결정 1). 알림이 없으면 `null`.
   *
   * `status` 와 **직교한다** — 이 값이 채워져 있는 동안에도 `status` 는 그대로여서 뒤에 원래 화면이
   * 남아 있고, 그 위에 닫을 수 없는 모달이 덮인다. 사용자가 "확인"을 누르는 순간에야 `RESET` 이
   * 나가 키 입력 화면으로 이동한다(그때 이 값도 함께 `null` 로 돌아간다).
   * 상태를 먼저 뒤집으면 화면이 이미 바뀐 뒤에 이유를 설명하게 된다 — 그것이 결정 1 이 뒤집힌 이유다.
   */
  apiKeyNotice: ApiKeyNoticeKind | null
}

export const initialOnboardingState: OnboardingState = {
  status: 'awaitingApiKey',
  accounts: [],
  selectedAccountId: null,
  error: null,
  prefetchProgress: null,
  apiKeyNotice: null,
}

// ADR-086 결정 1: 끝내지 않은 온보딩은 그 단계부터 재개한다. 재개 지점은 저장된 값(apiKey ·
// selectedAccountId · trackingMode · trackedCharacters)에서 파생하므로 진행 상태 전용 키가 없다.
export type ResumableOnboardingStatus = Extract<
  OnboardingStatus,
  'selectingTrackingMode' | 'selectingContentCharacters'
>

export type OnboardingEvent =
  | { type: 'RESTORE_COMPLETED'; selectedAccountId: string }
  | { type: 'RESTORE_STEP'; status: ResumableOnboardingStatus; selectedAccountId: string }
  | { type: 'SUBMIT_API_KEY' }
  | { type: 'API_KEY_VERIFIED'; accounts: MapleAccount[] }
  | { type: 'API_KEY_REJECTED'; error: OnboardingError }
  | { type: 'SELECT_ACCOUNT'; accountId: string }
  | { type: 'ACCOUNT_SELECTION_FAILED'; error: OnboardingError }
  // ADR-016: 계정 확정 직후 전체 캐릭터 예열(character/basic + access_flag true인 경우 scheduler) 진행 상태
  | { type: 'PREFETCH_PROGRESS'; completed: number; total: number }
  | { type: 'PREFETCH_FINISHED' }
  // ADR-035 결정 13: 예열이 끝나면 자동/수동 트래킹 모드 선택 단계로 넘어간다.
  | { type: 'SELECT_TRACKING_MODE'; mode: TrackingMode }
  // ADR-035 결정 13: 트래킹 모드 선택 후 컨텐츠 추적 캐릭터를 1명 이상 고른다.
  | { type: 'SUBMIT_CONTENT_CHARACTERS' }
  // ADR-035 결정 15: 수동 모드일 때 시드가 끝나면(또는 자동 모드는 곧바로) 온보딩이 완료된다.
  | { type: 'ONBOARDING_FINISHED' }
  // ADR-115 결정 10: 키를 다시 받아야 한다는 것을 **알리기만** 한다 — status는 그대로 두고 모달만
  // 띄운다. 이동은 사용자가 "확인"을 눌러 RESET이 나갈 때 일어난다.
  // ADR-116 결정 1: 원인(무효 키 · 429)을 싣는다 — 사슬은 하나이고 문구만 갈린다.
  | { type: 'API_KEY_NOTICED'; kind: ApiKeyNoticeKind }
  | { type: 'RESET' }

export function onboardingReducer(state: OnboardingState, event: OnboardingEvent): OnboardingState {
  switch (event.type) {
    case 'RESTORE_COMPLETED':
      return {
        status: 'completed',
        accounts: [],
        selectedAccountId: event.selectedAccountId,
        error: null,
        prefetchProgress: null,
        apiKeyNotice: null,
      }

    // ADR-086 결정 1: 뒤 두 단계는 네트워크 없이 재개된다 — 모드 선택은 순수 UI이고 캐릭터
    // 선택은 getCharacterPickerRoster가 자체 조회한다. 그래서 accounts는 비운 채 넘어간다.
    case 'RESTORE_STEP':
      return {
        status: event.status,
        accounts: [],
        selectedAccountId: event.selectedAccountId,
        error: null,
        prefetchProgress: null,
        apiKeyNotice: null,
      }

    case 'SUBMIT_API_KEY':
      return {
        ...state,
        status: 'verifyingApiKey',
        error: null,
      }

    case 'API_KEY_VERIFIED':
      // ADR-051: 계정 수와 무관하게 항상 선택 화면을 거친다 — 계정이 1개여도 자동 확정하지 않는다.
      // 계정 확정(과 그에 이어지는 ADR-016 예열)은 사용자가 "계속하기"를 누르는 SELECT_ACCOUNT 하나뿐이다.
      return {
        status: 'selectingAccount',
        accounts: event.accounts,
        selectedAccountId: null,
        error: null,
        prefetchProgress: null,
        apiKeyNotice: null,
      }

    case 'API_KEY_REJECTED':
      return {
        ...state,
        status: 'error',
        error: event.error,
      }

    case 'SELECT_ACCOUNT':
      // ADR-016/ADR-051: 계정 수와 무관하게 모든 계정 확정이 이 경로 하나를 지나 예열을 거친다.
      return {
        ...state,
        status: 'prefetching',
        selectedAccountId: event.accountId,
        prefetchProgress: null,
      }

    case 'ACCOUNT_SELECTION_FAILED':
      return {
        ...state,
        status: 'error',
        error: event.error,
      }

    case 'PREFETCH_PROGRESS':
      return {
        ...state,
        prefetchProgress: { completed: event.completed, total: event.total },
      }

    case 'PREFETCH_FINISHED':
      // ADR-035 결정 13: 예열 완료 후 곧바로 완료하지 않고 트래킹 모드 선택 단계로 넘어간다.
      return {
        ...state,
        status: 'selectingTrackingMode',
        prefetchProgress: null,
      }

    case 'SELECT_TRACKING_MODE':
      // ADR-035 결정 13: 모드 선택 후 컨텐츠 추적 캐릭터 선택 단계로 넘어간다.
      return {
        ...state,
        status: 'selectingContentCharacters',
      }

    case 'SUBMIT_CONTENT_CHARACTERS':
      // ADR-035 결정 15: 수동 모드에서 시드가 끝날 때까지 로딩(스피너)을 유지하는 단계.
      // 자동 모드는 이 상태를 거치지 않고 곧바로 ONBOARDING_FINISHED로 완료된다(store 참고).
      return {
        ...state,
        status: 'seedingTracking',
      }

    case 'ONBOARDING_FINISHED':
      return {
        ...state,
        status: 'completed',
      }

    // ADR-115 결정 10: status를 바꾸지 않는 유일한 이벤트다. 뒤에 원래 화면이 그대로 남아
    // 있어야 사용자가 "무엇을 하다 이렇게 됐는지"를 보면서 이유를 읽는다.
    case 'API_KEY_NOTICED':
      // ADR-116 결정 2: 이미 알림이 떠 있으면 **덮어쓰지 않는다**. 두 원인 모두 처방이 "키를 다시
      // 입력한다"로 같아 갈아끼울 실익이 없고, 읽던 문구가 눈앞에서 바뀌면 사용자가 읽던 것이
      // 사라진다. 같은 객체를 돌려줘 불필요한 렌더도 만들지 않는다.
      if (state.apiKeyNotice !== null) {
        return state
      }
      return {
        ...state,
        apiKeyNotice: event.kind,
      }

    case 'RESET':
      return initialOnboardingState
  }
}
