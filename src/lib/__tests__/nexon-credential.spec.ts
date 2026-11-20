// 저장된 수단에서 넥슨에 넘길 자격을 고른다. 여기서 막는 사고는 **수단이 있는데 없다고 말하는
// 것**이다. 그러면 부르는 쪽이 조회를 통째로 건너뛰고 화면에는 네트워크 오류가 뜬다.
import {
  apiKeyCredential,
  apiKeyValueOf,
  credentialOf,
  credentialOfOwner,
  loginCredentialOf,
  usableCredentialsOf,
} from '../nexon-credential'
import type { NexonApiKeyMethod, NexonAuthConfig } from '../../types'

function 설정(login: string | null, ...keys: string[]): NexonAuthConfig {
  return {
    login:
      login === null
        ? null
        : { type: 'login', id: 'account-login', session: login },
    apiKeys: keys.map((value) => ({ type: 'key' as const, id: 'account-key', label: '', value, loginId: null })),
    mainKeyId: login === null && keys.length > 0 ? 'account-key' : null,
  }
}

describe('credentialOf', () => {
  it('키만 있으면 키다', () => {
    expect(credentialOf(설정(null, '키-가'))).toEqual({ type: 'key', value: '키-가', accountId: 'account-key' })
  })

  it('로그인만 있으면 서버 세션이다', () => {
    // 종전에는 여기서 null 을 돌려줬다. 그래서 키를 거둔 사용자의 조회가 전부 죽었다.
    expect(credentialOf(설정('액세스'))).toEqual({ type: 'login', value: '액세스', accountId: 'account-login' })
  })

  it('둘 다 있으면 로그인이 이긴다', () => {
    // 로그인을 붙이면 같은 계정의 키는 거둬진다. 남아 있는 키는 다른 넥슨 계정의 부계정 키다.
    expect(credentialOf(설정('액세스', '키-가'))).toEqual({ type: 'login', value: '액세스', accountId: 'account-login' })
  })

  it('수단이 없으면 null 이다', () => {
    expect(credentialOf(설정(null))).toBeNull()
    expect(credentialOf(null)).toBeNull()
  })

})

/** 키 하나. 귀속(`loginId`)을 마음대로 준다. */
function 키(id: string, loginId: string | null): NexonApiKeyMethod {
  return { type: 'key', id, label: '', value: `값-${id}`, loginId }
}

const 로그인 = { type: 'login' as const, id: 'account-login', session: '세션' }

// 부계정 키는 등록한 로그인에 귀속된다. 메인 키는 귀속과 따로 적는다.
describe('credentialOf: 메인 키', () => {
  it('로그인이 없으면 메인 키로 적은 키다. 앞 로그인의 부계정 키였어도 메인이 될 수 있다', () => {
    const config = { login: null, mainKeyId: 'account-부', apiKeys: [키('account-다른', null), 키('account-부', 'account-login')] }

    expect(credentialOf(config)).toEqual({ type: 'key', value: '값-account-부', accountId: 'account-부' })
  })

  // 로그인이 만료되거나 로그아웃하면 부계정 키만 남는다. 그 키를 메인으로 쓰면 다른 넥슨 계정이 메인 계정이 된다.
  it('메인 키로 적은 키가 없으면 메인 계정의 자격이 없다', () => {
    expect(credentialOf({ login: null, mainKeyId: null, apiKeys: [키('account-부', 'account-login')] })).toBeNull()
  })
})

describe('usableCredentialsOf', () => {
  it('로그인이 있으면 로그인과, 그 로그인에 귀속된 부계정 키다. 로그인이 맨 앞이다', () => {
    const config = {
      login: 로그인,
      mainKeyId: null,
      apiKeys: [키('account-다른', 'account-다른-로그인'), 키('account-부1', 'account-login'), 키('account-부2', 'account-login')],
    }

    expect(usableCredentialsOf(config).map((one) => one.accountId)).toEqual(['account-login', 'account-부1', 'account-부2'])
  })

  it('로그인이 없으면 메인 키 하나뿐이다. 부계정 키는 귀속된 로그인이 돌아올 때까지 부르지 않는다', () => {
    const apiKeys = [키('account-부', 'account-login'), 키('account-메인', null)]

    expect(usableCredentialsOf({ login: null, mainKeyId: 'account-메인', apiKeys }).map((one) => one.accountId)).toEqual([
      'account-메인',
    ])
    expect(usableCredentialsOf({ login: null, mainKeyId: null, apiKeys })).toEqual([])
    expect(usableCredentialsOf(null)).toEqual([])
  })

  // 무효가 된 키는 계정 관리에 남지만 부르면 같은 실패를 다시 받는다. 그 계정의 캐릭터도 이미 추적에서 뺐다.
  it('무효 표시가 붙은 부계정 키는 빠진다', () => {
    const config = {
      login: 로그인,
      mainKeyId: null,
      apiKeys: [{ ...키('account-무효', 'account-login'), invalid: { untrackedOcids: [] } }, 키('account-부', 'account-login')],
    }

    expect(usableCredentialsOf(config).map((one) => one.accountId)).toEqual(['account-login', 'account-부'])
    expect(credentialOfOwner(config, 'account-무효')).toBeNull()
  })
})

// 캐릭터는 그 캐릭터가 속한 넥슨 계정의 자격으로 부른다.
describe('credentialOfOwner', () => {
  const config = {
    login: 로그인,
    mainKeyId: null,
    apiKeys: [키('account-부', 'account-login'), 키('account-다른', 'account-다른-로그인')],
  }

  it('어느 계정의 캐릭터인지 모르면 메인 계정의 자격이다', () => {
    expect(credentialOfOwner(config, null)?.accountId).toBe('account-login')
  })

  it('부계정의 캐릭터는 그 부계정 키다', () => {
    expect(credentialOfOwner(config, 'account-부')).toEqual({ type: 'key', value: '값-account-부', accountId: 'account-부' })
  })

  it('계정은 알지만 쓸 수 있는 자격이 없으면 null 이다. 다른 계정의 자격으로 부르지 않는다', () => {
    expect(credentialOfOwner(config, 'account-다른')).toBeNull()
    expect(credentialOfOwner(config, 'account-지운-키')).toBeNull()
  })
})

describe('apiKeyValueOf', () => {
  it('키면 그 값이다. 실패가 어느 키를 지울지 이 값으로 가린다', () => {
    expect(apiKeyValueOf(apiKeyCredential('키-가'))).toBe('키-가')
  })

  it('로그인이면 없다. 지울 키가 없다', () => {
    expect(apiKeyValueOf({ type: 'login', value: '액세스', accountId: null })).toBeUndefined()
  })
})

describe('loginCredentialOf', () => {
  it('로그인이 있으면 액세스 토큰이다', () => {
    expect(loginCredentialOf(설정('액세스', '키-가'))).toEqual({ type: 'login', value: '액세스', accountId: 'account-login' })
  })

  it('없으면 null 이다', () => {
    expect(loginCredentialOf(설정(null, '키-가'))).toBeNull()
  })
})
