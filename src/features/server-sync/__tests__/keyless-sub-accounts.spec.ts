/**
 * 이 기기에 쓸 수 있는 키가 없는 부계정을 가르는 계산.
 *
 * 여기서 막는 사고는 둘이다. 키가 무효이거나 지워진 부계정의 기록이 합계에 섞이는 것, 쓸 수 있는 계정의 기록이 흐려져 합계에서 빠지는
 * 것이다.
 */
import type { CharacterAccountSighting } from '../../../lib/mvp/membership'
import type { NexonApiKeyMethod, NexonAuthConfig } from '../../../types/auth'
import { keyLostScopeOf } from '../keyless'

const LOGIN = { type: 'login', id: 'account-login', session: 's' } as const

function key(id: string, loginId: string | null, invalid = false): NexonApiKeyMethod {
  return { type: 'key', id, label: '', value: `value-${id}`, loginId, ...(invalid ? { invalid: { untrackedOcids: [] } } : {}) }
}

function sighting(ocid: string, accountId: string): CharacterAccountSighting {
  return { ocid, name: ocid, accountId, firstSeenOn: '2026-11-01', lastSeenOn: '2026-11-20' }
}

const BY_ACCOUNT = new Map([
  ['account-login', ['maple-login']],
  ['account-sub', ['maple-sub']],
  ['account-gone', ['maple-gone']],
])
const SIGHTINGS = [sighting('ocid-login', 'maple-login'), sighting('ocid-sub', 'maple-sub'), sighting('ocid-gone', 'maple-gone')]

describe('키가 있던 기기의 메이플 ID', () => {
  it('무효 표시가 붙은 부계정 키와 지워진 키의 메이플 ID 와 그 캐릭터를 고른다', () => {
    const config: NexonAuthConfig = { login: LOGIN, apiKeys: [key('account-sub', 'account-login', true)], mainKeyId: null }

    const scope = keyLostScopeOf(config, BY_ACCOUNT, SIGHTINGS)

    expect([...scope.mapleIds].sort()).toEqual(['maple-gone', 'maple-sub'])
    expect([...scope.ocids].sort()).toEqual([
      ['ocid-gone', 'maple-gone'],
      ['ocid-sub', 'maple-sub'],
    ])
  })

  it('지금 로그인과 쓸 수 있는 부계정 키의 메이플 ID 는 고르지 않는다', () => {
    const config: NexonAuthConfig = {
      login: LOGIN,
      apiKeys: [key('account-sub', 'account-login'), key('account-gone', 'account-login')],
      mainKeyId: null,
    }

    expect(keyLostScopeOf(config, BY_ACCOUNT, SIGHTINGS).mapleIds.size).toBe(0)
  })

  it('다른 로그인에 귀속된 키는 쓸 수 없어 그 메이플 ID 를 고른다', () => {
    const config: NexonAuthConfig = { login: LOGIN, apiKeys: [key('account-sub', 'account-other')], mainKeyId: null }

    expect(keyLostScopeOf(config, BY_ACCOUNT, SIGHTINGS).mapleIds.has('maple-sub')).toBe(true)
  })

  it('같은 메이플 ID 를 쓸 수 있는 계정에서도 봤으면 고르지 않는다', () => {
    const config: NexonAuthConfig = { login: LOGIN, apiKeys: [], mainKeyId: null }
    const byAccount = new Map([...BY_ACCOUNT, ['account-login', ['maple-login', 'maple-gone']]])

    expect(keyLostScopeOf(config, byAccount, SIGHTINGS).mapleIds.has('maple-gone')).toBe(false)
  })

  it('로그인 없이 키만 쓰면 메인 키의 계정은 쓸 수 있다', () => {
    const config: NexonAuthConfig = { login: null, apiKeys: [key('account-login', null)], mainKeyId: 'account-login' }

    const scope = keyLostScopeOf(config, new Map([['account-login', ['maple-login']]]), SIGHTINGS)

    expect(scope.mapleIds.size).toBe(0)
  })

  it('인증 수단이 없으면 아무것도 고르지 않는다', () => {
    expect(keyLostScopeOf(null, BY_ACCOUNT, SIGHTINGS).mapleIds.size).toBe(0)
  })
})
