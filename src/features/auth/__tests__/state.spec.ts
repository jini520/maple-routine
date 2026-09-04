import type { MapleAccount } from '../../../types'
import { authReducer, initialAuthState, type AuthState } from '../state'

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

describe('authReducer', () => {
  it('RESTORE_SIGNED_IN: 저장된 키가 있으면 즉시 signedIn 이 된다', () => {
    const result = authReducer(initialAuthState, { type: 'RESTORE_SIGNED_IN' })

    expect(result).toEqual<AuthState>({
      status: 'signedIn',
      accounts: [],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: false,
    })
  })

  it('SUBMIT_API_KEY: verifying 으로 전이하고 기존 error를 지운다', () => {
    const errored: AuthState = {
      status: 'signedOut',
      accounts: [],
      error: { kind: 'network' },
      apiKeyNotice: null,
      developmentStageBlocked: false,
    }

    const result = authReducer(errored, { type: 'SUBMIT_API_KEY' })

    expect(result).toEqual<AuthState>({
      status: 'verifying',
      accounts: [],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: false,
    })
  })

  it('API_KEY_VERIFIED: signedIn 으로 전이하고 응답을 싣는다', () => {
    const verifying: AuthState = {
      status: 'verifying',
      accounts: [],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: false,
    }

    const result = authReducer(verifying, {
      type: 'API_KEY_VERIFIED',
      accounts: [account('acc-1')],
    })

    expect(result).toEqual<AuthState>({
      status: 'signedIn',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: false,
    })
  })

  // **실패가 상태가 아니다.** 폼이 그대로 서 있으므로 status 는 signedOut 으로 돌아가고
  // 원인만 error 에 남는다. 실패 전용 상태를 두면 같은 것을 두 번 말한다.
  it('API_KEY_REJECTED: signedOut 으로 돌아가고 원인은 error 에 남는다', () => {
    const verifying: AuthState = {
      status: 'verifying',
      accounts: [],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: false,
    }

    const result = authReducer(verifying, {
      type: 'API_KEY_REJECTED',
      error: { kind: 'invalidApiKey' },
    })

    expect(result).toEqual<AuthState>({
      status: 'signedOut',
      accounts: [],
      error: { kind: 'invalidApiKey' },
      apiKeyNotice: null,
      developmentStageBlocked: false,
    })
  })

  // 폼이 선 상태로 되돌린다. verifying 으로 남으면 모달을 닫았을 때 제출 버튼이 스피너로 굳는다.
  it('DEVELOPMENT_STAGE_KEY_BLOCKED: 폼으로 되돌리고 모달만 켠다', () => {
    const verifying: AuthState = {
      status: 'verifying',
      accounts: [],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: false,
    }

    const result = authReducer(verifying, { type: 'DEVELOPMENT_STAGE_KEY_BLOCKED' })

    expect(result).toEqual<AuthState>({
      status: 'signedOut',
      accounts: [],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: true,
    })
  })

  it('DEVELOPMENT_STAGE_KEY_ACKNOWLEDGED: 모달만 닫는다', () => {
    const blocked: AuthState = {
      status: 'signedOut',
      accounts: [],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: true,
    }

    expect(authReducer(blocked, { type: 'DEVELOPMENT_STAGE_KEY_ACKNOWLEDGED' })).toEqual<AuthState>({
      ...blocked,
      developmentStageBlocked: false,
    })
  })

  // status를 바꾸지 않는 유일한 이벤트다. 뒤에 원래 화면이 남아 있어야
  // 사용자가 무엇을 하다 이렇게 됐는지 보면서 이유를 읽는다. 이동은 확인 후 SIGNED_OUT이 한다.
  // 원인 둘(무효 키·429)이 같은 사슬을 타므로 이벤트가 kind를 싣는다.
  it.each(['invalid', 'rateLimited'] as const)(
    'API_KEY_NOTICED(%s). 원인만 담고 status·계정은 건드리지 않는다',
    (kind) => {
      const signedIn: AuthState = {
        status: 'signedIn',
        accounts: [account('acc-1')],
        error: null,
        apiKeyNotice: null,
        developmentStageBlocked: false,
      }

      const result = authReducer(signedIn, { type: 'API_KEY_NOTICED', kind })

      expect(result).toEqual<AuthState>({ ...signedIn, apiKeyNotice: kind })
    },
  )

  // 처방이 같아 갈아끼울 실익이 없고, 읽던 문구가 눈앞에서 바뀌면 안 된다.
  // 같은 객체를 돌려주는 것까지 단언한다. 아니면 원인이 겹칠 때마다 헛렌더가 난다.
  it('API_KEY_NOTICED: 이미 알림이 있으면 덮어쓰지 않고 같은 state를 그대로 돌려준다', () => {
    const noticed: AuthState = {
      status: 'signedIn',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: 'invalid',
      developmentStageBlocked: false,
    }

    const result = authReducer(noticed, { type: 'API_KEY_NOTICED', kind: 'rateLimited' })

    expect(result.apiKeyNotice).toBe('invalid')
    expect(result).toBe(noticed)
  })

  it('SIGNED_OUT: 알림이 켜져 있어도 initialAuthState로 되돌아간다(알림도 함께 꺼진다)', () => {
    const noticed: AuthState = {
      status: 'signedIn',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: 'rateLimited',
      developmentStageBlocked: false,
    }

    expect(authReducer(noticed, { type: 'SIGNED_OUT' }).apiKeyNotice).toBeNull()
  })

  it('SIGNED_OUT: 어떤 상태에서도 initialAuthState로 되돌아간다', () => {
    const signedIn: AuthState = {
      status: 'signedIn',
      accounts: [account('acc-1')],
      error: null,
      apiKeyNotice: null,
      developmentStageBlocked: false,
    }

    const result = authReducer(signedIn, { type: 'SIGNED_OUT' })

    expect(result).toEqual<AuthState>(initialAuthState)
    expect(result).toBe(initialAuthState)
  })
})
