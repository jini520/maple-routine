// 우리 서버에 자기를 밝히는 헤더. 세션이 있으면 Bearer 하나, 없으면 메인 키의 메이플 ID 해시 하나, 둘 다 없으면 null.
// 1.0.15 서버는 키 해시를 받지 않는다. 키는 다시 받으면 바뀌지만 메이플 ID 는 안 바뀐다.
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import type { NexonAuthConfig } from '../../../types/auth'
import { mainServerIdentityOf, serverIdentityHeaders } from '../server-identity'

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ getMapleIdsOfNexonAccountUngated: jest.fn() }))

const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const { getMapleIdsOfNexonAccountUngated } = jest.requireMock('../../../storage/character-accounts') as Record<string, jest.Mock>

const 메인키설정: NexonAuthConfig = {
  login: null,
  mainKeyId: 'account-메인',
  apiKeys: [
    { type: 'key', id: 'account-부', label: '', value: '부-키', loginId: 'account-login' },
    { type: 'key', id: 'account-메인', label: '', value: '메인-키', loginId: null },
  ],
}

beforeEach(() => {
  jest.clearAllMocks()
  getMapleIdsOfNexonAccountUngated.mockResolvedValue([])
})

// 기기가 만든 계정 번호는 기기마다 달라 서버가 읽지 않는다. 싣지 않는다.
it('로그인이 있으면 Authorization: Bearer 하나만 싣고 기기 표를 읽지 않는다', async () => {
  getAuthConfig.mockResolvedValue({ ...메인키설정, login: { type: 'login', id: 'account-login', session: 'S' } })

  await expect(serverIdentityHeaders()).resolves.toEqual({ Authorization: 'Bearer S' })
  expect(getMapleIdsOfNexonAccountUngated).not.toHaveBeenCalled()
})

// 같은 키로 늘 같은 값을 보내야 서버가 넥슨 계정 줄을 새로 만들었다가 합치지 않는다. 본 차례가 바뀌어도 같은 값이어야 한다.
it('키만 있으면 메인 키의 넥슨 계정에서 본 메이플 ID 가운데 정렬해 맨 앞의 것의 해시만 싣는다', async () => {
  getAuthConfig.mockResolvedValue(메인키설정)
  getMapleIdsOfNexonAccountUngated.mockResolvedValue(['maple-c', 'maple-a', 'maple-b'])

  await expect(serverIdentityHeaders()).resolves.toEqual({ 'x-maple-id-hash': nexonIdHashHex('maple-a') })
  // 부계정 키는 로그인 사용자만 등록한다. 그 키로 밝히면 로그인이 만료된 사이 부계정이 메인 사람처럼 기록된다.
  expect(getMapleIdsOfNexonAccountUngated).toHaveBeenCalledWith('account-메인')
})

it('메인 키의 메이플 ID 를 하나도 본 적이 없으면 밝히지 않는다', async () => {
  getAuthConfig.mockResolvedValue(메인키설정)

  await expect(serverIdentityHeaders()).resolves.toBeNull()
})

it('로그인이 없고 부계정 키만 남았거나, 수단이 없거나, 저장소를 못 읽으면 null 이다', async () => {
  getAuthConfig.mockResolvedValueOnce({ ...메인키설정, mainKeyId: null })
  await expect(serverIdentityHeaders()).resolves.toBeNull()

  getAuthConfig.mockResolvedValueOnce(null)
  await expect(serverIdentityHeaders()).resolves.toBeNull()

  getAuthConfig.mockResolvedValueOnce(메인키설정)
  getMapleIdsOfNexonAccountUngated.mockRejectedValueOnce(new Error('디스크'))
  await expect(serverIdentityHeaders()).resolves.toBeNull()
})

it('넘겨받은 메이플 ID 로 같은 규칙의 신원을 짓는다', async () => {
  const mapleIdsOf = jest.fn(async () => ['maple-b', 'maple-a'])

  await expect(mainServerIdentityOf(메인키설정, mapleIdsOf)).resolves.toEqual({ 'x-maple-id-hash': nexonIdHashHex('maple-a') })
  await expect(mainServerIdentityOf({ ...메인키설정, login: { type: 'login', id: 'L', session: 'S' } }, mapleIdsOf)).resolves.toEqual({
    Authorization: 'Bearer S',
  })
  expect(mapleIdsOf).toHaveBeenCalledTimes(1)
})
