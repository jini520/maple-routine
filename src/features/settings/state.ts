import type { MapleAccount } from '../../types'

// ADR-086 결정 6: 계정 변경은 캐릭터를 다시 고를 때까지 커밋하지 않는다 — 예열이 끝나면
// 곧바로 닫지 않고 'selectingCharacters' 에 머문다.
export type SettingsStatus =
  | 'idle'
  | 'verifying'
  | 'selectingAccount'
  | 'prefetching'
  | 'selectingCharacters'
  | 'error'

export type SettingsError =
  | { kind: 'invalidApiKey' } // 401/403
  | { kind: 'rateLimited' } // 429
  | { kind: 'network' } // 네트워크/5xx/JSON 파싱 실패 등
  | { kind: 'storageWriteFailed' } // 로컬 저장 실패

export interface PrefetchProgress {
  completed: number
  total: number
}

export interface SettingsState {
  status: SettingsStatus
  accounts: MapleAccount[]
  error: SettingsError | null
  prefetchProgress: PrefetchProgress | null
  // ADR-086 결정 6: 사용자가 고른 계정. **아직 저장되지 않았다** — 캐릭터 선택을 저장하는
  // 시점에 selectedAccountId·trackedCharacters 두 쓰기가 함께 커밋된다.
  pendingAccountId: string | null
}

export const initialSettingsState: SettingsState = {
  status: 'idle',
  accounts: [],
  error: null,
  prefetchProgress: null,
  pendingAccountId: null,
}

export type SettingsEvent =
  | { type: 'VERIFY_START' }
  | { type: 'ACCOUNTS_VERIFIED'; accounts: MapleAccount[] }
  | { type: 'VERIFY_FAILED'; error: SettingsError }
  | { type: 'SELECT_ACCOUNT'; accountId: string }
  | { type: 'ACCOUNT_SELECTION_FAILED'; error: SettingsError }
  | { type: 'PREFETCH_PROGRESS'; completed: number; total: number }
  | { type: 'PREFETCH_FINISHED' }
  | { type: 'RESET' }

export function settingsReducer(state: SettingsState, event: SettingsEvent): SettingsState {
  switch (event.type) {
    case 'VERIFY_START':
      return {
        ...state,
        status: 'verifying',
        error: null,
      }

    case 'ACCOUNTS_VERIFIED':
      // ADR-051: 계정 수와 무관하게 항상 선택 화면을 거친다 — 계정이 1개여도 자동 확정하지 않는다.
      // 계정 확정(과 그에 이어지는 ADR-016 예열)은 사용자가 "계속하기"를 누르는 SELECT_ACCOUNT 하나뿐이다.
      return {
        ...state,
        status: 'selectingAccount',
        accounts: event.accounts,
        error: null,
      }

    case 'VERIFY_FAILED':
      return {
        ...state,
        status: 'error',
        error: event.error,
      }

    case 'SELECT_ACCOUNT':
      return {
        ...state,
        status: 'prefetching',
        prefetchProgress: null,
        pendingAccountId: event.accountId,
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

    // ADR-086 결정 6: 예열이 끝나도 닫지 않는다 — 새 계정에서 캐릭터를 다시 골라야 커밋된다.
    case 'PREFETCH_FINISHED':
      return {
        ...state,
        status: 'selectingCharacters',
        error: null,
        prefetchProgress: null,
      }

    case 'RESET':
      return initialSettingsState
  }
}
