import type { MapleAccount } from '../../types'
import type { TrackingMode } from '../../storage/tracking-mode'

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

export interface OnboardingState {
  status: OnboardingStatus
  accounts: MapleAccount[]
  selectedAccountId: string | null
  error: OnboardingError | null
  prefetchProgress: PrefetchProgress | null
}

export const initialOnboardingState: OnboardingState = {
  status: 'awaitingApiKey',
  accounts: [],
  selectedAccountId: null,
  error: null,
  prefetchProgress: null,
}

export type OnboardingEvent =
  | { type: 'RESTORE_COMPLETED'; selectedAccountId: string }
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

    case 'RESET':
      return initialOnboardingState
  }
}
