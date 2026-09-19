// 월간 결정석 개수는 **그 주가 끝날 때까지의 그 달 누적**이다(사용자 지정).
//
// 전에는 그 주 목록에 선 월간 보스만 세서 **이 주에 잡은 수**를 말했다. 1주차 1명 · 2주차 2명이면
// 2주차가 `2개` 였고, 사용자가 보고 싶은 것은 `3개` 다.
import { act, renderHook, waitFor } from '@testing-library/react-native'

import type { BossProfitRecord } from '../../../storage/boss-profit'

let mockStamp = '0'
const mockListeners = new Set<() => void>()
jest.mock('../period-cache', () => ({
  bossRecordsStamp: () => mockStamp,
  subscribeBossRecordsStamp: (listener: () => void) => {
    mockListeners.add(listener)
    return () => {
      mockListeners.delete(listener)
    }
  },
}))

jest.mock('../../../storage/boss-profit', () => ({
  getBossProfitRecords: jest.fn(),
  getWeeklyPeriodKeysWithRecords: jest.fn(),
}))
const {
  getBossProfitRecords: getBossProfitRecordsMock,
  getWeeklyPeriodKeysWithRecords: getWeeksMock,
} = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>

const { countMonthlyCrystalsUpToWeek, useMonthlyCrystalsUpToWeek } =
  require('../monthly-crystals') as typeof import('../monthly-crystals')

const NOW = new Date('2026-09-25T12:00:00+09:00')

function 월간기록(ocid: string, overrides: Partial<BossProfitRecord> = {}): BossProfitRecord {
  return {
    ocid,
    bossKey: 'black_mage',
    boss: '검은 마법사',
    difficulty: 'hard',
    cycle: 'monthly',
    periodKey: '2026-09',
    partySize: 1,
    priceMeso: 665_000_000,
    payoutMeso: 665_000_000,
    recordedAt: '2026-09-01T00:00:00.000Z',
    world: '엘리시움',
    worldKey: 'elysium',
    defeatedOn: null,
    ...overrides,
  }
}

function 수(records: BossProfitRecord[], weekKey: string, weeksWithRecords: string[] = []): number {
  const byWorld = countMonthlyCrystalsUpToWeek(records, weekKey, NOW, weeksWithRecords)
  return Object.values(byWorld).reduce((sum, entry) => sum + entry.count, 0)
}

describe('countMonthlyCrystalsUpToWeek', () => {
  // 사용자가 든 예 그대로다.
  it('1주차 1명 · 2주차 2명이면 1주차 1개 · 2주차 3개 · 3주차 3개', () => {
    const records = [
      월간기록('A', { defeatedOn: '2026-09-05' }),
      월간기록('B', { defeatedOn: '2026-09-11' }),
      월간기록('C', { defeatedOn: '2026-09-12' }),
    ]

    expect(수(records, '2026-09-03')).toBe(1)
    expect(수(records, '2026-09-10')).toBe(3)
    expect(수(records, '2026-09-17')).toBe(3)
  })

  // 지난 주를 다시 열어도 그 주 이후의 처치가 섞이지 않는다.
  it('보고 있는 주 뒤의 처치는 안 센다', () => {
    const records = [월간기록('A', { defeatedOn: '2026-09-24' })]

    expect(수(records, '2026-09-17')).toBe(0)
  })

  describe('달 경계 주(8/27~9/2)는 주 이름의 달을 센다', () => {
    const records = [
      월간기록('A', { periodKey: '2026-08', defeatedOn: '2026-08-28' }),
      월간기록('B', { periodKey: '2026-09', defeatedOn: '2026-09-02' }),
    ]

    it('8월 4주차는 8월 누적이다. 9/2 에 잡은 9월 보스는 안 든다', () => {
      expect(수(records, '2026-08-27')).toBe(1)
    })

    it('9/1~9/2 에 잡은 9월 보스는 9월 1주차부터 든다', () => {
      expect(수(records, '2026-09-03')).toBe(1)
    })
  })

  // 목록이 그 보스를 세우는 주와 같은 규칙이다. 날짜를 모르면 기록이 있는 가장 빠른 주차다.
  it('날짜를 모르는 기록은 그 기록이 선 주부터 센다', () => {
    const records = [월간기록('A', { defeatedOn: null })]

    expect(수(records, '2026-09-03', ['2026-09-10'])).toBe(0)
    expect(수(records, '2026-09-10', ['2026-09-10'])).toBe(1)
  })

  it('월드별로 갈라 세고, 월드를 모르는 기록은 뺀다', () => {
    const records = [
      월간기록('A', { defeatedOn: '2026-09-05' }),
      월간기록('B', { defeatedOn: '2026-09-05', world: '스카니아', worldKey: 'scania' }),
      월간기록('C', { defeatedOn: '2026-09-05', world: null, worldKey: null }),
    ]

    expect(countMonthlyCrystalsUpToWeek(records, '2026-09-03', NOW, [])).toEqual({
      elysium: { world: '엘리시움', count: 1 },
      scania: { world: '스카니아', count: 1 },
    })
  })

  it('주간 기록은 안 센다', () => {
    const records = [월간기록('A', { cycle: 'weekly', periodKey: '2026-09-03', defeatedOn: '2026-09-05' })]

    expect(수(records, '2026-09-03')).toBe(0)
  })
})

describe('useMonthlyCrystalsUpToWeek', () => {
  beforeEach(() => {
    getBossProfitRecordsMock.mockReset()
    getWeeksMock.mockReset().mockResolvedValue([])
    mockStamp = '0'
  })

  it('그 주 이름의 달 기록을 읽어 센다', async () => {
    getBossProfitRecordsMock.mockResolvedValue([월간기록('A', { defeatedOn: '2026-09-05' })])

    const { result } = await renderHook(() => useMonthlyCrystalsUpToWeek(['A'], '2026-09-10'))

    await waitFor(() => expect(result.current?.elysium?.count).toBe(1))
    expect(getBossProfitRecordsMock).toHaveBeenCalledWith(['A'], ['2026-09'])
  })

  // 직접 완료를 적거나 취소하면 칩이 바로 따라와야 한다.
  it('기록 판이 바뀌면 다시 센다', async () => {
    getBossProfitRecordsMock.mockResolvedValue([월간기록('A', { defeatedOn: '2026-09-05' })])
    const { result } = await renderHook(() => useMonthlyCrystalsUpToWeek(['A', 'B'], '2026-09-10'))
    await waitFor(() => expect(result.current?.elysium?.count).toBe(1))

    getBossProfitRecordsMock.mockResolvedValue([
      월간기록('A', { defeatedOn: '2026-09-05' }),
      월간기록('B', { defeatedOn: '2026-09-11' }),
    ])
    await act(async () => {
      mockStamp = '1'
      for (const listener of mockListeners) listener()
    })

    await waitFor(() => expect(result.current?.elysium?.count).toBe(2))
  })

  it('주간 탭이 아니면(null) 안 읽는다', async () => {
    const { result } = await renderHook(() => useMonthlyCrystalsUpToWeek(['A'], null))

    expect(result.current).toBeNull()
    expect(getBossProfitRecordsMock).not.toHaveBeenCalled()
  })
})
