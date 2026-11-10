// 우리 서버에 자기를 밝히는 헤더. 세션이 있으면 Bearer 하나, 없으면 키 해시 하나, 둘 다 없으면 null.
import { serverIdentityHeaders } from '../server-identity'

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../lib/crypto/api-key-hash', () => ({ apiKeyHashHex: (key: string) => `해시(${key})` }))

const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>

it('로그인이 있으면 Authorization: Bearer 하나만 싣고, 메인 계정 id 를 함께 싣는다', async () => {
  getAuthConfig.mockResolvedValue({ login: { type: 'login', id: 'account-login', session: 'S' }, mainKeyId: null, apiKeys: [{ type: 'key', id: 'account-key', label: '', value: '키', loginId: 'account-login' }] })

  await expect(serverIdentityHeaders()).resolves.toEqual({ Authorization: 'Bearer S', 'x-nexon-account-id': 'account-login' })
})

it('키만 있으면 메인 키(첫 키)의 해시와 그 계정 id 를 싣는다', async () => {
  getAuthConfig.mockResolvedValue({ login: null, mainKeyId: 'account-key', apiKeys: [{ type: 'key', id: 'account-key', label: '', value: '키1', loginId: null }, { type: 'key', id: 'account-key', label: '', value: '키2', loginId: null }] })

  await expect(serverIdentityHeaders()).resolves.toEqual({ 'x-api-key-hash': '해시(키1)', 'x-nexon-account-id': 'account-key' })
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

  await expect(serverIdentityHeaders()).resolves.toEqual({ 'x-api-key-hash': '해시(메인-키)', 'x-nexon-account-id': 'account-메인' })
})

it('로그인이 없고 부계정 키만 남았으면 밝힐 수단이 없다', async () => {
  getAuthConfig.mockResolvedValue({
    login: null,
    mainKeyId: null,
    apiKeys: [{ type: 'key', id: 'account-부', label: '', value: '부-키', loginId: 'account-login' }],
  })

  await expect(serverIdentityHeaders()).resolves.toBeNull()
})
