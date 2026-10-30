jest.mock('../../schedule-sync/schedule-query', () => ({ refreshSchedules: jest.fn(async () => undefined) }))
jest.mock('../../schedule-sync/read-schedule', () => ({ readTrackedOcidsSync: jest.fn(() => ['a', 'b']) }))
jest.mock('../../schedule-window/sync', () => ({ syncScheduleWindow: jest.fn(async () => undefined) }))
jest.mock('../../enhancement-history/collect', () => ({ collectEnhancementHistory: jest.fn(async () => undefined) }))

import { pullRefresh } from '../pull'

const { refreshSchedules: roundMock } = jest.requireMock('../../schedule-sync/schedule-query') as Record<string, jest.Mock>
const { readTrackedOcidsSync: trackedMock } = jest.requireMock('../../schedule-sync/read-schedule') as Record<string, jest.Mock>
const { syncScheduleWindow: windowMock } = jest.requireMock('../../schedule-window/sync') as Record<string, jest.Mock>
const { collectEnhancementHistory: enhancementMock } = jest.requireMock('../../enhancement-history/collect') as Record<string, jest.Mock>

const NOW = new Date('2026-10-30T05:00:00.000Z')

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
  jest.clearAllMocks()
  trackedMock.mockReturnValue(['a', 'b'])
  roundMock.mockResolvedValue(undefined)
  windowMock.mockResolvedValue(undefined)
  enhancementMock.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.useRealTimers()
})

it('회차 → 창 → 오늘 강화 순이다. 오늘 강화는 KST 오늘 하루치다', async () => {
  const order: string[] = []
  roundMock.mockImplementation(async () => void order.push('round'))
  windowMock.mockImplementation(async () => void order.push('window'))
  enhancementMock.mockImplementation(async () => void order.push('enhancement'))

  await pullRefresh()

  expect(order).toEqual(['round', 'window', 'enhancement'])
  expect(windowMock).toHaveBeenCalledWith(['a', 'b'], expect.any(Date))
  expect(enhancementMock).toHaveBeenCalledWith(['2026-10-30'], expect.any(Date))
})

it('추적이 없으면 창을 안 부른다', async () => {
  trackedMock.mockReturnValue(null)

  await pullRefresh()

  expect(windowMock).not.toHaveBeenCalled()
  expect(enhancementMock).toHaveBeenCalled()
})

it('창이나 강화가 던져도 당김은 끝난다', async () => {
  windowMock.mockRejectedValue(new Error('network'))
  enhancementMock.mockRejectedValue(new Error('network'))

  await expect(pullRefresh()).resolves.toBeUndefined()
})
