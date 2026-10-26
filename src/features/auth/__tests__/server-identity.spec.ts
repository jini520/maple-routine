// 우리 서버에 자기를 밝히는 헤더. 세션이 있으면 Bearer 하나, 없으면 키 해시 하나, 둘 다 없으면 null.
import { serverIdentityHeaders } from '../server-identity'

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../lib/crypto/api-key-hash', () => ({ apiKeyHashHex: (key: string) => `해시(${key})` }))

const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>

it('로그인이 있으면 Authorization: Bearer 하나만 싣고, 메인 계정 id 를 함께 싣는다', async () => {
  getAuthConfig.mockResolvedValue({ login: { type: 'login', id: 'account-login', session: 'S' }, apiKeys: [{ type: 'key', id: 'account-key', label: '', value: '키' }] })

  await expect(serverIdentityHeaders()).resolves.toEqual({ Authorization: 'Bearer S', 'x-nexon-account-id': 'account-login' })
})

it('키만 있으면 첫 키의 해시와 그 계정 id 를 싣는다', async () => {
  getAuthConfig.mockResolvedValue({ login: null, apiKeys: [{ type: 'key', id: 'account-key', label: '', value: '키1' }, { type: 'key', id: 'account-key', label: '', value: '키2' }] })

  await expect(serverIdentityHeaders()).resolves.toEqual({ 'x-api-key-hash': '해시(키1)', 'x-nexon-account-id': 'account-key' })
})

it('수단이 없거나 저장소를 못 읽으면 null 이다', async () => {
  getAuthConfig.mockResolvedValueOnce(null)
  await expect(serverIdentityHeaders()).resolves.toBeNull()

  getAuthConfig.mockRejectedValueOnce(new Error('디스크'))
  await expect(serverIdentityHeaders()).resolves.toBeNull()
})
