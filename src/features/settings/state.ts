import type { MapleAccount } from '../../types'

export type SettingsStatus = 'idle' | 'verifying' | 'selectingAccount' | 'prefetching' | 'error'

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
}

export const initialSettingsState: SettingsState = {
  status: 'idle',
  accounts: [],
  error: null,
  prefetchProgress: null,
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
      // ADR-016과 동일한 자동 확정 규칙: 계정이 정확히 1개면 선택 화면 없이 바로 prefetching으로 넘어간다.
      if (event.accounts.length === 1) {
        return {
          ...state,
          status: 'prefetching',
          accounts: event.accounts,
          error: null,
        }
      }
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
      return {
        status: 'idle',
        accounts: [],
        error: null,
        prefetchProgress: null,
      }

    case 'RESET':
      return initialSettingsState
  }
}
