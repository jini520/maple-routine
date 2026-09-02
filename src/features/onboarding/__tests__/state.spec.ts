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
    })

    expect(result).toEqual<OnboardingState>({
      status: 'completed',
      accounts: [],
      error: null,
      apiKeyNotice: null,
    })
  })

  it('SUBMIT_API_KEY — verifyingApiKey로 전이하고 기존 error를 지운다', () => {
    const errored: OnboardingState = {
      status: 'error',
      accounts: [],
      error: { kind: 'network' },
      apiKeyNotice: null,
    }

    const result = onboardingReducer(errored, { type: 'SUBMIT_API_KEY' })

    expect(result).toEqual<OnboardingState>({
      status: 'verifyingApiKey',
      accounts: [],
      error: null,
      apiKeyNotice: null,
    })
  })




  it('API_KEY_REJECTED — error 상태로 전이하고 accounts/selectedAccountId는 유지한다', () => {
    const verifying: OnboardingState = {
      status: 'verifyingApiKey',
      accounts: [],
      error: null,
      apiKeyNotice: null,
    }

    const result = onboardingReducer(verifying, {
      type: 'API_KEY_REJECTED',
      error: { kind: 'invalidApiKey' },
    })

    expect(result).toEqual<OnboardingState>({
      status: 'error',
      accounts: [],
      error: { kind: 'invalidApiKey' },
      apiKeyNotice: null,
    })
  })





  it('SELECT_TRACKING_MODE — selectingContentCharacters로 전이한다(ADR-035 결정 13)', () => {
    const selecting: OnboardingState = {
      status: 'selectingTrackingMode',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: null,
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
      error: null,
      apiKeyNotice: null,
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
      error: null,
      apiKeyNotice: null,
    }

    const result = onboardingReducer(seeding, { type: 'ONBOARDING_FINISHED' })

    expect(result).toEqual<OnboardingState>({
      ...seeding,
      status: 'completed',
    })
  })

  // ADR-115 결정 10: status를 바꾸지 않는 유일한 이벤트다. 뒤에 원래 화면이 남아 있어야
  // 사용자가 무엇을 하다 이렇게 됐는지 보면서 이유를 읽는다. 이동은 확인 후 RESET이 한다.
  // ADR-116 결정 1: 원인 둘(무효 키·429)이 같은 사슬을 타므로 이벤트가 kind를 싣는다.
  it.each(['invalid', 'rateLimited'] as const)(
    'API_KEY_NOTICED(%s) — 원인만 담고 status·계정은 건드리지 않는다',
    (kind) => {
      const completed: OnboardingState = {
        status: 'completed',
        accounts: [account('acc-1')],
        error: null,
        apiKeyNotice: null,
      }

      const result = onboardingReducer(completed, { type: 'API_KEY_NOTICED', kind })

      expect(result).toEqual<OnboardingState>({ ...completed, apiKeyNotice: kind })
    },
  )

  // ADR-116 결정 2: 처방이 같아 갈아끼울 실익이 없고, 읽던 문구가 눈앞에서 바뀌면 안 된다.
  // 같은 객체를 돌려주는 것까지 단언한다. 아니면 원인이 겹칠 때마다 헛렌더가 난다.
  it('API_KEY_NOTICED — 이미 알림이 있으면 덮어쓰지 않고 같은 state를 그대로 돌려준다', () => {
    const noticed: OnboardingState = {
      status: 'selectingContentCharacters',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: 'invalid',
    }

    const result = onboardingReducer(noticed, { type: 'API_KEY_NOTICED', kind: 'rateLimited' })

    expect(result.apiKeyNotice).toBe('invalid')
    expect(result).toBe(noticed)
  })

  it('RESET — 알림이 켜져 있어도 initialOnboardingState로 되돌아간다(알림도 함께 꺼진다)', () => {
    const noticed: OnboardingState = {
      status: 'completed',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: 'rateLimited',
    }

    expect(onboardingReducer(noticed, { type: 'RESET' }).apiKeyNotice).toBeNull()
  })

  it('RESET — 어떤 상태에서도 initialOnboardingState로 되돌아간다', () => {
    const completed: OnboardingState = {
      status: 'completed',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: null,
    }

    const result = onboardingReducer(completed, { type: 'RESET' })

    expect(result).toEqual<OnboardingState>(initialOnboardingState)
    expect(result).toBe(initialOnboardingState)
  })
})
