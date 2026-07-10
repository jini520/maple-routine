import { describe, expect, it } from 'vitest'
import type { MapleAccount } from '../../../types'
import {
  initialOnboardingState,
  onboardingReducer,
  type OnboardingState,
} from '../state'

function account(accountId: string): MapleAccount {
  return {
    accountId,
    characters: [
      {
        ocid: `ocid-${accountId}`,
        name: `캐릭터-${accountId}`,
        world: '베라',
        jobClass: '렌',
        level: 200,
      },
    ],
  }
}

describe('onboardingReducer', () => {
  it('RESTORE_COMPLETED — 저장된 계정으로 즉시 completed 상태가 된다', () => {
    const result = onboardingReducer(initialOnboardingState, {
      type: 'RESTORE_COMPLETED',
      selectedAccountId: 'acc-1',
    })

    expect(result).toEqual<OnboardingState>({
      status: 'completed',
      accounts: [],
      selectedAccountId: 'acc-1',
      error: null,
    })
  })

  it('SUBMIT_API_KEY — verifyingApiKey로 전이하고 기존 error를 지운다', () => {
    const errored: OnboardingState = {
      status: 'error',
      accounts: [],
      selectedAccountId: null,
      error: { kind: 'network' },
    }

    const result = onboardingReducer(errored, { type: 'SUBMIT_API_KEY' })

    expect(result).toEqual<OnboardingState>({
      status: 'verifyingApiKey',
      accounts: [],
      selectedAccountId: null,
      error: null,
    })
  })

  it('API_KEY_VERIFIED — 계정이 정확히 1개면 선택 화면 없이 자동으로 completed된다', () => {
    const accounts = [account('acc-1')]

    const result = onboardingReducer(initialOnboardingState, {
      type: 'API_KEY_VERIFIED',
      accounts,
    })

    expect(result).toEqual<OnboardingState>({
      status: 'completed',
      accounts,
      selectedAccountId: 'acc-1',
      error: null,
    })
  })

  it('API_KEY_VERIFIED — 계정이 0개면 selectingAccount로 전이한다', () => {
    const result = onboardingReducer(initialOnboardingState, {
      type: 'API_KEY_VERIFIED',
      accounts: [],
    })

    expect(result).toEqual<OnboardingState>({
      status: 'selectingAccount',
      accounts: [],
      selectedAccountId: null,
      error: null,
    })
  })

  it('API_KEY_VERIFIED — 계정이 2개 이상이면 selectingAccount로 전이한다', () => {
    const accounts = [account('acc-1'), account('acc-2')]

    const result = onboardingReducer(initialOnboardingState, {
      type: 'API_KEY_VERIFIED',
      accounts,
    })

    expect(result).toEqual<OnboardingState>({
      status: 'selectingAccount',
      accounts,
      selectedAccountId: null,
      error: null,
    })
  })

  it('API_KEY_REJECTED — error 상태로 전이하고 accounts/selectedAccountId는 유지한다', () => {
    const verifying: OnboardingState = {
      status: 'verifyingApiKey',
      accounts: [],
      selectedAccountId: null,
      error: null,
    }

    const result = onboardingReducer(verifying, {
      type: 'API_KEY_REJECTED',
      error: { kind: 'invalidApiKey' },
    })

    expect(result).toEqual<OnboardingState>({
      status: 'error',
      accounts: [],
      selectedAccountId: null,
      error: { kind: 'invalidApiKey' },
    })
  })

  it('SELECT_ACCOUNT — 선택한 계정으로 completed 전이하고 accounts는 유지한다', () => {
    const accounts = [account('acc-1'), account('acc-2')]
    const selecting: OnboardingState = {
      status: 'selectingAccount',
      accounts,
      selectedAccountId: null,
      error: null,
    }

    const result = onboardingReducer(selecting, {
      type: 'SELECT_ACCOUNT',
      accountId: 'acc-2',
    })

    expect(result).toEqual<OnboardingState>({
      status: 'completed',
      accounts,
      selectedAccountId: 'acc-2',
      error: null,
    })
  })

  it('ACCOUNT_SELECTION_FAILED — error 상태로 전이하고 accounts/selectedAccountId는 유지한다(재시도 가능하도록)', () => {
    const accounts = [account('acc-1'), account('acc-2')]
    const selecting: OnboardingState = {
      status: 'selectingAccount',
      accounts,
      selectedAccountId: null,
      error: null,
    }

    const result = onboardingReducer(selecting, {
      type: 'ACCOUNT_SELECTION_FAILED',
      error: { kind: 'storageWriteFailed' },
    })

    expect(result).toEqual<OnboardingState>({
      status: 'error',
      accounts,
      selectedAccountId: null,
      error: { kind: 'storageWriteFailed' },
    })
  })

  it('RESET — 어떤 상태에서도 initialOnboardingState로 되돌아간다', () => {
    const completed: OnboardingState = {
      status: 'completed',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
    }

    const result = onboardingReducer(completed, { type: 'RESET' })

    expect(result).toEqual<OnboardingState>(initialOnboardingState)
    expect(result).toBe(initialOnboardingState)
  })
})
