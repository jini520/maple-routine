// 저장된 수단에서 넥슨에 넘길 자격을 고른다. 여기서 막는 사고는 **수단이 있는데 없다고 말하는
// 것**이다. 그러면 부르는 쪽이 조회를 통째로 건너뛰고 화면에는 네트워크 오류가 뜬다.
import { apiKeyCredential, apiKeyValueOf, credentialOf, loginCredentialOf } from '../nexon-credential'
import type { NexonAuthConfig } from '../../types'

function 설정(login: string | null, ...keys: string[]): NexonAuthConfig {
  return {
    login:
      login === null
        ? null
        : {
            kind: 'login',
            session: '세션',
            accessToken: login,
            accessExpiresAt: '2026-09-27T12:30:00.000Z',
          },
    apiKeys: keys.map((value) => ({ kind: 'apiKey' as const, label: '', value })),
  }
}

describe('credentialOf', () => {
  it('키만 있으면 키다', () => {
    expect(credentialOf(설정(null, '키-가'))).toEqual({ kind: 'apiKey', value: '키-가' })
  })

  it('로그인만 있으면 액세스 토큰이다', () => {
    // 종전에는 여기서 null 을 돌려줬다. 그래서 키를 거둔 사용자의 조회가 전부 죽었다.
    expect(credentialOf(설정('액세스'))).toEqual({ kind: 'login', value: '액세스' })
  })

  it('둘 다 있으면 로그인이 이긴다', () => {
    // 로그인을 붙이면 같은 계정의 키는 거둬진다. 남아 있는 키는 다른 넥슨 계정의 것이고,
    // 그것을 어느 메이플 ID 에 쓸지는 아직 아무도 안 정한다(열린 질문).
    expect(credentialOf(설정('액세스', '키-가'))).toEqual({ kind: 'login', value: '액세스' })
  })

  it('수단이 없으면 null 이다', () => {
    expect(credentialOf(설정(null))).toBeNull()
    expect(credentialOf(null)).toBeNull()
  })

  it('키가 여럿이면 첫 키다', () => {
    expect(credentialOf(설정(null, '키-가', '키-나'))).toEqual({ kind: 'apiKey', value: '키-가' })
  })
})

describe('apiKeyValueOf', () => {
  it('키면 그 값이다. 실패가 어느 키를 지울지 이 값으로 가린다', () => {
    expect(apiKeyValueOf(apiKeyCredential('키-가'))).toBe('키-가')
  })

  it('로그인이면 없다. 지울 키가 없다', () => {
    expect(apiKeyValueOf({ kind: 'login', value: '액세스' })).toBeUndefined()
  })
})

describe('loginCredentialOf', () => {
  it('로그인이 있으면 액세스 토큰이다', () => {
    expect(loginCredentialOf(설정('액세스', '키-가'))).toEqual({ kind: 'login', value: '액세스' })
  })

  it('없으면 null 이다', () => {
    expect(loginCredentialOf(설정(null, '키-가'))).toBeNull()
  })
})
