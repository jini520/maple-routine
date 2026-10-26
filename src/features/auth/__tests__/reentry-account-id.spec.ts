// 키를 다시 받아 넣어도 같은 넥슨 계정이면 옛 계정 id 를 잇는다. 그래야 그 계정의 기록이 이어진다.
import { reusableNexonAccountId } from '../reentry-account-id'

jest.mock('../../../storage/character-accounts', () => ({ findNexonAccountIdOfMapleIds: jest.fn() }))
jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))

const { findNexonAccountIdOfMapleIds } = jest.requireMock('../../../storage/character-accounts') as Record<string, jest.Mock>
const { getAuthConfig } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>

const 목록 = [{ accountId: 'maple-1', characters: [] }]

beforeEach(() => {
  findNexonAccountIdOfMapleIds.mockReset()
  getAuthConfig.mockReset().mockResolvedValue({ login: { type: 'login', id: 'account-main', session: 's' }, apiKeys: [] })
})

it('목록의 메이플 ID 가 속했던 계정이 지금 수단에 없으면 그 계정을 잇는다', async () => {
  findNexonAccountIdOfMapleIds.mockResolvedValue('account-old')

  await expect(reusableNexonAccountId(목록)).resolves.toBe('account-old')
  expect(findNexonAccountIdOfMapleIds).toHaveBeenCalledWith(['maple-1'])
})

it('그 계정이 다른 수단으로 살아 있으면 잇지 않는다. 같은 계정 id 를 두 수단이 가지면 안 된다', async () => {
  findNexonAccountIdOfMapleIds.mockResolvedValue('account-main')

  await expect(reusableNexonAccountId(목록)).resolves.toBeNull()
})

it('처음 보는 메이플 ID 거나 소속을 못 읽으면 새 계정이다', async () => {
  findNexonAccountIdOfMapleIds.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('db'))

  await expect(reusableNexonAccountId(목록)).resolves.toBeNull()
  await expect(reusableNexonAccountId(목록)).resolves.toBeNull()
})
