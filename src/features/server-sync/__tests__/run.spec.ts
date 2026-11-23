// 한 번의 동기화. 올리기를 먼저 해야 아직 못 올린 기기 값이 받은 값에 덮이지 않고, 올리기의 거절로 지운 줄의 서버 값이 같은 동기화에 들어온다.
import { runServerSync } from '../run'

jest.mock('../accounts', () => ({ prepareServerAccounts: jest.fn() }))
jest.mock('../push', () => ({ pushServerSync: jest.fn() }))
jest.mock('../pull', () => ({ pullServerSync: jest.fn() }))

const { prepareServerAccounts } = jest.requireMock('../accounts') as { prepareServerAccounts: jest.Mock }
const { pushServerSync } = jest.requireMock('../push') as { pushServerSync: jest.Mock }
const { pullServerSync } = jest.requireMock('../pull') as { pullServerSync: jest.Mock }

const order: string[] = []

beforeEach(() => {
  jest.clearAllMocks()
  order.length = 0
  prepareServerAccounts.mockImplementation(async () => order.push('accounts'))
  pushServerSync.mockImplementation(async () => order.push('push'))
  pullServerSync.mockImplementation(async () => order.push('pull'))
})

it('계정을 알리고 올린 뒤 받는다', async () => {
  await runServerSync()

  expect(order).toEqual(['accounts', 'push', 'pull'])
})

// 남은 대기 줄의 기록은 받기가 건너뛰어 덮이지 않는다. 받기까지 멈추면 다른 기기의 기록이 그 동기화에 안 들어온다.
it('계정 알리기나 올리기가 던져도 받고, 받기가 던져도 던지지 않는다', async () => {
  prepareServerAccounts.mockRejectedValue(new Error('저장소'))
  pushServerSync.mockRejectedValue(new Error('저장소'))
  pullServerSync.mockRejectedValue(new Error('저장소'))

  await expect(runServerSync()).resolves.toBeUndefined()
  expect(pullServerSync).toHaveBeenCalledTimes(1)
})
