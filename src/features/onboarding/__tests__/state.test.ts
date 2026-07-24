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
      prefetchProgress: null,
    })
  })

  it('SUBMIT_API_KEY — verifyingApiKey로 전이하고 기존 error를 지운다', () => {
    const errored: OnboardingState = {
      status: 'error',
      accounts: [],
      selectedAccountId: null,
      error: { kind: 'network' },
      prefetchProgress: null,
    }

    const result = onboardingReducer(errored, { type: 'SUBMIT_API_KEY' })

    expect(result).toEqual<OnboardingState>({
      status: 'verifyingApiKey',
      accounts: [],
      selectedAccountId: null,
      error: null,
      prefetchProgress: null,
    })
  })

  it('API_KEY_VERIFIED — 계정이 정확히 1개면 선택 화면 없이 prefetching으로 전이한다(ADR-016)', () => {
    const accounts = [account('acc-1')]

    const result = onboardingReducer(initialOnboardingState, {
      type: 'API_KEY_VERIFIED',
      accounts,
    })

    expect(result).toEqual<OnboardingState>({
      status: 'prefetching',
      accounts,
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: null,
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
      prefetchProgress: null,
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
      prefetchProgress: null,
    })
  })

  it('API_KEY_REJECTED — error 상태로 전이하고 accounts/selectedAccountId는 유지한다', () => {
    const verifying: OnboardingState = {
      status: 'verifyingApiKey',
      accounts: [],
      selectedAccountId: null,
      error: null,
      prefetchProgress: null,
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
      prefetchProgress: null,
    })
  })

  it('SELECT_ACCOUNT — 선택한 계정으로 prefetching 전이하고 accounts는 유지한다(ADR-016)', () => {
    const accounts = [account('acc-1'), account('acc-2')]
    const selecting: OnboardingState = {
      status: 'selectingAccount',
      accounts,
      selectedAccountId: null,
      error: null,
      prefetchProgress: null,
    }

    const result = onboardingReducer(selecting, {
      type: 'SELECT_ACCOUNT',
      accountId: 'acc-2',
    })

    expect(result).toEqual<OnboardingState>({
      status: 'prefetching',
      accounts,
      selectedAccountId: 'acc-2',
      error: null,
      prefetchProgress: null,
    })
  })

  it('ACCOUNT_SELECTION_FAILED — error 상태로 전이하고 accounts/selectedAccountId는 유지한다(재시도 가능하도록)', () => {
    const accounts = [account('acc-1'), account('acc-2')]
    const selecting: OnboardingState = {
      status: 'selectingAccount',
      accounts,
      selectedAccountId: null,
      error: null,
      prefetchProgress: null,
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
      prefetchProgress: null,
    })
  })

  it('PREFETCH_PROGRESS — prefetchProgress를 갱신하고 다른 필드는 유지한다', () => {
    const prefetching: OnboardingState = {
      status: 'prefetching',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: null,
    }

    const result = onboardingReducer(prefetching, {
      type: 'PREFETCH_PROGRESS',
      completed: 3,
      total: 10,
    })

    expect(result).toEqual<OnboardingState>({
      ...prefetching,
      prefetchProgress: { completed: 3, total: 10 },
    })
  })

  it('PREFETCH_FINISHED — selectingTrackingMode로 전이하고 prefetchProgress를 지운다(ADR-035)', () => {
    const prefetching: OnboardingState = {
      status: 'prefetching',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: { completed: 10, total: 10 },
    }

    const result = onboardingReducer(prefetching, { type: 'PREFETCH_FINISHED' })

    expect(result).toEqual<OnboardingState>({
      ...prefetching,
      status: 'selectingTrackingMode',
      prefetchProgress: null,
    })
  })

  it('SELECT_TRACKING_MODE — selectingContentCharacters로 전이한다(ADR-035 결정 13)', () => {
    const selecting: OnboardingState = {
      status: 'selectingTrackingMode',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: null,
    }

    const result = onboardingReducer(selecting, { type: 'SELECT_TRACKING_MODE', mode: 'manual' })

    expect(result).toEqual<OnboardingState>({
      ...selecting,
      status: 'selectingContentCharacters',
    })
  })

  it('SUBMIT_CONTENT_CHARACTERS — seedingTracking으로 전이한다(ADR-035 결정 15)', () => {
    const selecting: OnboardingState = {
      status: 'selectingContentCharacters',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: null,
    }

    const result = onboardingReducer(selecting, { type: 'SUBMIT_CONTENT_CHARACTERS' })

    expect(result).toEqual<OnboardingState>({
      ...selecting,
      status: 'seedingTracking',
    })
  })

  it('ONBOARDING_FINISHED — completed로 전이한다', () => {
    const seeding: OnboardingState = {
      status: 'seedingTracking',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: null,
    }

    const result = onboardingReducer(seeding, { type: 'ONBOARDING_FINISHED' })

    expect(result).toEqual<OnboardingState>({
      ...seeding,
      status: 'completed',
    })
  })

  it('RESET — 어떤 상태에서도 initialOnboardingState로 되돌아간다', () => {
    const completed: OnboardingState = {
      status: 'completed',
      accounts: [account('acc-1')],
      selectedAccountId: 'acc-1',
      error: null,
      prefetchProgress: null,
    }

    const result = onboardingReducer(completed, { type: 'RESET' })

    expect(result).toEqual<OnboardingState>(initialOnboardingState)
    expect(result).toBe(initialOnboardingState)
  })
})
