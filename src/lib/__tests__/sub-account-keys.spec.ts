// 앱은 서버가 지금 로그인에 준 부계정만 부른다. 다른 기기에서 지운 부계정의 키를 이 기기가 계속 부르면, 계정 관리에도 안 보이는
// 키가 조회를 이어 가 지울 방법이 없다. 반대로 아직 등록하지 못한 키까지 빼면 방금 넣은 계정의 캐릭터를 부르지 못한다.
import { apiKeyHashHex } from '../crypto/api-key-hash'
import { listedSubAccountConfig, storedApiKeyHashHex } from '../sub-account-keys'
import type { NexonApiKeyMethod, NexonAuthConfig } from '../../types'

function 키(id: string, value: string, loginId: string | null = 'login-1'): NexonApiKeyMethod {
  return { type: 'key', id, label: '', value, loginId }
}

function 설정(...apiKeys: NexonApiKeyMethod[]): NexonAuthConfig {
  return { login: { type: 'login', id: 'login-1', session: 'S' }, apiKeys, mainKeyId: null }
}

function 등록표(value: string): string {
  return `login-1:${apiKeyHashHex(value)}`
}

it('서버가 저장한 키 해시는 앱이 보내는 해시를 한 번 더 해시한 값이다', () => {
  expect(storedApiKeyHashHex('키')).toBe(apiKeyHashHex(apiKeyHashHex('키')))
})

describe('listedSubAccountConfig', () => {
  const 목록 = [{ apiKeyHashes: [storedApiKeyHashHex('키-가')], mapleIds: ['h1'] }]

  it('서버 목록에 해시가 있는 키와 아직 등록하지 않은 키를 남긴다', () => {
    const config = 설정(키('a', '키-가'), 키('b', '키-나'))

    const listed = listedSubAccountConfig(config, { loginId: 'login-1', subAccounts: 목록 }, [등록표('키-가')])

    expect(listed?.apiKeys.map((one) => one.id)).toEqual(['a', 'b'])
  })

  it('등록한 적이 있는데 목록에 없는 키는 뺀다', () => {
    const config = 설정(키('a', '키-가'), 키('b', '키-나'))

    const listed = listedSubAccountConfig(config, { loginId: 'login-1', subAccounts: 목록 }, [등록표('키-가'), 등록표('키-나')])

    expect(listed?.apiKeys.map((one) => one.id)).toEqual(['a'])
  })

  it('목록을 받은 적 없는 로그인이면 그대로 둔다', () => {
    const config = 설정(키('a', '키-가'), 키('b', '키-나'))

    expect(listedSubAccountConfig(config, null, [등록표('키-나')])).toBe(config)
    expect(listedSubAccountConfig(config, { loginId: 'login-old', subAccounts: [] }, [등록표('키-나')])).toBe(config)
  })

  // 다른 로그인에 귀속된 키는 어차피 부르지 않는다. 그 로그인이 돌아오면 이어져야 해서 설정에서 빼지 않는다.
  it('지금 로그인에 귀속되지 않은 키와 로그인이 없는 설정은 건드리지 않는다', () => {
    const config = 설정(키('a', '키-가', 'login-old'))
    expect(listedSubAccountConfig(config, { loginId: 'login-1', subAccounts: [] }, [])?.apiKeys).toHaveLength(1)

    const keyOnly: NexonAuthConfig = { login: null, apiKeys: [키('a', '키-가', null)], mainKeyId: 'a' }
    expect(listedSubAccountConfig(keyOnly, { loginId: 'login-1', subAccounts: [] }, [])).toBe(keyOnly)
  })
})
