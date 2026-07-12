import { describe, expect, it } from 'vitest'
import type { MapleAccount } from '../../../types'
import {
  initialSettingsState,
  settingsReducer,
  type SettingsState,
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

describe('settingsReducer', () => {
  it('VERIFY_START — verifying으로 전이하고 기존 error를 지운다', () => {
    const errored: SettingsState = {
      status: 'error',
      accounts: [],
      error: { kind: 'network' },
      prefetchProgress: null,
    }

    const result = settingsReducer(errored, { type: 'VERIFY_START' })

    expect(result).toEqual<SettingsState>({
      status: 'verifying',
      accounts: [],
      error: null,
      prefetchProgress: null,
    })
  })

  it('ACCOUNTS_VERIFIED — 계정이 정확히 1개면 선택 화면 없이 prefetching으로 전이한다', () => {
    const accounts = [account('acc-1')]

    const result = settingsReducer(initialSettingsState, {
      type: 'ACCOUNTS_VERIFIED',
      accounts,
    })

    expect(result).toEqual<SettingsState>({
      status: 'prefetching',
      accounts,
      error: null,
      prefetchProgress: null,
    })
  })

  it('ACCOUNTS_VERIFIED — 계정이 0개면 selectingAccount로 전이한다', () => {
    const result = settingsReducer(initialSettingsState, {
      type: 'ACCOUNTS_VERIFIED',
      accounts: [],
    })

    expect(result).toEqual<SettingsState>({
      status: 'selectingAccount',
      accounts: [],
      error: null,
      prefetchProgress: null,
    })
  })

  it('ACCOUNTS_VERIFIED — 계정이 2개 이상이면 selectingAccount로 전이한다', () => {
    const accounts = [account('acc-1'), account('acc-2')]

    const result = settingsReducer(initialSettingsState, {
      type: 'ACCOUNTS_VERIFIED',
      accounts,
    })

    expect(result).toEqual<SettingsState>({
      status: 'selectingAccount',
      accounts,
      error: null,
      prefetchProgress: null,
    })
  })

  it('VERIFY_FAILED — error 상태로 전이하고 accounts 필드는 지우지 않고 유지한다', () => {
    const verifying: SettingsState = {
      status: 'verifying',
      accounts: [account('acc-1')],
      error: null,
      prefetchProgress: null,
    }

    const result = settingsReducer(verifying, {
      type: 'VERIFY_FAILED',
      error: { kind: 'invalidApiKey' },
    })

    expect(result).toEqual<SettingsState>({
      status: 'error',
      accounts: verifying.accounts,
      error: { kind: 'invalidApiKey' },
      prefetchProgress: null,
    })
  })

  it('SELECT_ACCOUNT — prefetching으로 전이하고 accounts는 유지한다', () => {
    const accounts = [account('acc-1'), account('acc-2')]
    const selecting: SettingsState = {
      status: 'selectingAccount',
      accounts,
      error: null,
      prefetchProgress: null,
    }

    const result = settingsReducer(selecting, {
      type: 'SELECT_ACCOUNT',
      accountId: 'acc-2',
    })

    expect(result).toEqual<SettingsState>({
      status: 'prefetching',
      accounts,
      error: null,
      prefetchProgress: null,
    })
  })

  it('ACCOUNT_SELECTION_FAILED — error 상태로 전이하고 accounts는 유지한다(재시도 가능하도록)', () => {
    const accounts = [account('acc-1'), account('acc-2')]
    const selecting: SettingsState = {
      status: 'selectingAccount',
      accounts,
      error: null,
      prefetchProgress: null,
    }

    const result = settingsReducer(selecting, {
      type: 'ACCOUNT_SELECTION_FAILED',
      error: { kind: 'storageWriteFailed' },
    })

    expect(result).toEqual<SettingsState>({
      status: 'error',
      accounts,
      error: { kind: 'storageWriteFailed' },
      prefetchProgress: null,
    })
  })

  it('PREFETCH_PROGRESS — prefetchProgress를 갱신하고 다른 필드는 유지한다', () => {
    const prefetching: SettingsState = {
      status: 'prefetching',
      accounts: [account('acc-1')],
      error: null,
      prefetchProgress: null,
    }

    const result = settingsReducer(prefetching, {
      type: 'PREFETCH_PROGRESS',
      completed: 3,
      total: 10,
    })

    expect(result).toEqual<SettingsState>({
      ...prefetching,
      prefetchProgress: { completed: 3, total: 10 },
    })
  })

  it('PREFETCH_FINISHED — initialSettingsState와 필드별로 동일한 idle 상태로 돌아간다', () => {
    const prefetching: SettingsState = {
      status: 'prefetching',
      accounts: [account('acc-1')],
      error: null,
      prefetchProgress: { completed: 10, total: 10 },
    }

    const result = settingsReducer(prefetching, { type: 'PREFETCH_FINISHED' })

    expect(result).toEqual<SettingsState>(initialSettingsState)
  })

  it('RESET — 어떤 상태에서도 initialSettingsState로 되돌아간다', () => {
    const errored: SettingsState = {
      status: 'error',
      accounts: [account('acc-1')],
      error: { kind: 'network' },
      prefetchProgress: null,
    }

    const result = settingsReducer(errored, { type: 'RESET' })

    expect(result).toEqual<SettingsState>(initialSettingsState)
    expect(result).toBe(initialSettingsState)
  })
})
