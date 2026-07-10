import type { MapleAccount } from '../../types'

export type OnboardingStatus =
  | 'awaitingApiKey'
  | 'verifyingApiKey'
  | 'selectingAccount'
  | 'completed'
  | 'error'

export type OnboardingError =
  | { kind: 'invalidApiKey' } // 401/403
  | { kind: 'rateLimited' } // 429
  | { kind: 'network' } // 네트워크/5xx/JSON 파싱 실패 등
  | { kind: 'storageWriteFailed' } // 로컬 저장 실패

export interface OnboardingState {
  status: OnboardingStatus
  accounts: MapleAccount[]
  selectedAccountId: string | null
  error: OnboardingError | null
}

export const initialOnboardingState: OnboardingState = {
  status: 'awaitingApiKey',
  accounts: [],
  selectedAccountId: null,
  error: null,
}

export type OnboardingEvent =
  | { type: 'RESTORE_COMPLETED'; selectedAccountId: string }
  | { type: 'SUBMIT_API_KEY' }
  | { type: 'API_KEY_VERIFIED'; accounts: MapleAccount[] }
  | { type: 'API_KEY_REJECTED'; error: OnboardingError }
  | { type: 'SELECT_ACCOUNT'; accountId: string }
  | { type: 'ACCOUNT_SELECTION_FAILED'; error: OnboardingError }
  | { type: 'RESET' }

export function onboardingReducer(state: OnboardingState, event: OnboardingEvent): OnboardingState {
  switch (event.type) {
    case 'RESTORE_COMPLETED':
      return {
        status: 'completed',
        accounts: [],
        selectedAccountId: event.selectedAccountId,
        error: null,
      }

    case 'SUBMIT_API_KEY':
      return {
        ...state,
        status: 'verifyingApiKey',
        error: null,
      }

    case 'API_KEY_VERIFIED':
      if (event.accounts.length === 1) {
        return {
          status: 'completed',
          accounts: event.accounts,
          selectedAccountId: event.accounts[0].accountId,
          error: null,
        }
      }
      return {
        status: 'selectingAccount',
        accounts: event.accounts,
        selectedAccountId: null,
        error: null,
      }

    case 'API_KEY_REJECTED':
      return {
        ...state,
        status: 'error',
        error: event.error,
      }

    case 'SELECT_ACCOUNT':
      return {
        ...state,
        status: 'completed',
        selectedAccountId: event.accountId,
      }

    case 'ACCOUNT_SELECTION_FAILED':
      return {
        ...state,
        status: 'error',
        error: event.error,
      }

    case 'RESET':
      return initialOnboardingState
  }
}
