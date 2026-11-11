// 우리 서버에 자기를 밝히는 헤더. 세션이 있으면 Bearer 하나, 없으면 키 해시 하나, 둘 다 없으면 null.
import { serverIdentityHeaders, serverIdentityOfAccount, serverIdentitiesOf } from '../server-identity'
import type { NexonAuthConfig } from '../../../types/auth'

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../lib/crypto/api-key-hash', () => ({ apiKeyHashHex: (key: string) => `해시(${key})` }))

const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>

// 기기가 만든 계정 번호는 기기마다 달라 서버가 읽지 않는다. 싣지 않는다.
it('로그인이 있으면 Authorization: Bearer 하나만 싣는다', async () => {
  getAuthConfig.mockResolvedValue({ login: { type: 'login', id: 'account-login', session: 'S' }, mainKeyId: null, apiKeys: [{ type: 'key', id: 'account-key', label: '', value: '키', loginId: 'account-login' }] })

  await expect(serverIdentityHeaders()).resolves.toEqual({ Authorization: 'Bearer S' })
})

it('키만 있으면 메인 키의 해시만 싣는다', async () => {
  getAuthConfig.mockResolvedValue({ login: null, mainKeyId: 'account-key', apiKeys: [{ type: 'key', id: 'account-key', label: '', value: '키1', loginId: null }, { type: 'key', id: 'account-key', label: '', value: '키2', loginId: null }] })

  await expect(serverIdentityHeaders()).resolves.toEqual({ 'x-api-key-hash': '해시(키1)' })
})

it('수단이 없거나 저장소를 못 읽으면 null 이다', async () => {
  getAuthConfig.mockResolvedValueOnce(null)
  await expect(serverIdentityHeaders()).resolves.toBeNull()

  getAuthConfig.mockRejectedValueOnce(new Error('디스크'))
  await expect(serverIdentityHeaders()).resolves.toBeNull()
})

// 부계정 키는 로그인 사용자만 등록한다. 그 키로 밝히면 로그인이 만료된 사이 부계정이 메인 사람처럼 기록된다.
it('로그인이 없으면 부계정 키를 건너뛰고 메인 키로 밝힌다', async () => {
  getAuthConfig.mockResolvedValue({
    login: null,
    mainKeyId: 'account-메인',
    apiKeys: [
      { type: 'key', id: 'account-부', label: '', value: '부-키', loginId: 'account-login' },
      { type: 'key', id: 'account-메인', label: '', value: '메인-키', loginId: null },
    ],
  })

  await expect(serverIdentityHeaders()).resolves.toEqual({ 'x-api-key-hash': '해시(메인-키)' })
})

it('로그인이 없고 부계정 키만 남았으면 밝힐 수단이 없다', async () => {
  getAuthConfig.mockResolvedValue({
    login: null,
    mainKeyId: null,
    apiKeys: [{ type: 'key', id: 'account-부', label: '', value: '부-키', loginId: 'account-login' }],
  })

  await expect(serverIdentityHeaders()).resolves.toBeNull()
})

describe('계정마다의 신원', () => {
  const config: NexonAuthConfig = {
    login: { type: 'login', id: 'account-login', session: 'S' },
    mainKeyId: null,
    apiKeys: [
      { type: 'key', id: 'account-부', label: '', value: '부-키', loginId: 'account-login' },
      { type: 'key', id: 'account-남의-부', label: '', value: '남의-키', loginId: 'account-다른-로그인' },
    ],
  }

  // 서버는 기록의 메이플 ID 가 보낸 신원의 넥슨 계정에 있어야 적는다. 부계정의 기록은 그 키로 밝혀야 한다.
  it('로그인 계정은 세션, 부계정은 그 키의 해시로 밝히고, 계정을 모르면 메인 계정으로 밝힌다', () => {
    expect(serverIdentityOfAccount(config, 'account-login')).toEqual({ Authorization: 'Bearer S' })
    expect(serverIdentityOfAccount(config, 'account-부')).toEqual({ 'x-api-key-hash': '해시(부-키)' })
    expect(serverIdentityOfAccount(config, null)).toEqual({ Authorization: 'Bearer S' })
  })

  it('지금 로그인에 귀속되지 않은 키의 계정은 밝힐 수 없다', () => {
    expect(serverIdentityOfAccount(config, 'account-남의-부')).toBeNull()
    expect(serverIdentityOfAccount(config, 'account-모름')).toBeNull()
  })

  it('쓸 수 있는 신원 전부는 로그인과 그 로그인의 부계정 키다', () => {
    expect(serverIdentitiesOf(config)).toEqual([{ Authorization: 'Bearer S' }, { 'x-api-key-hash': '해시(부-키)' }])
    expect(serverIdentitiesOf(null)).toEqual([])
  })
})
