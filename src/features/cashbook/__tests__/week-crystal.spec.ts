// `주간 보스 수입 이전` 의 체크 박스가 채우는 금액. 보스 수익 주간 탭에서 그 캐릭터 카드의 결정석 몫과 같은 값이다.
//
// 그 주에 선 월간 보스의 몫도 들고, 드롭 판매 몫은 들지 않는다. 0 메소로 읽힌 결정석(`제외` · 한도 초과)은 기록이 0 으로 준다.

import type { BossProfitRecord } from '../../../storage/boss-profit'

jest.mock('../../../storage/boss-profit', () => ({
  getBossProfitRecords: jest.fn(),
  getWeeklyPeriodKeysWithRecords: jest.fn(),
}))
const { getBossProfitRecords, getWeeklyPeriodKeysWithRecords } = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>

const { loadWeekCrystalMeso } = require('../week-crystal') as typeof import('../week-crystal')

const NOW = new Date('2026-11-21T12:00:00+09:00')

function 기록(over: Partial<BossProfitRecord> = {}): BossProfitRecord {
  return {
    ocid: 'ocid-1',
    bossKey: 'lucid',
    boss: '루시드',
    difficulty: 'hard',
    cycle: 'weekly',
    periodKey: '2026-11-19',
    partySize: 1,
    priceMeso: 1_000_000,
    payoutMeso: 1_000_000,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    recordedAt: '2026-11-20T00:00:00.000Z',
    world: '스카니아',
    worldKey: 'scania',
    defeatedOn: '2026-11-20',
    ...over,
  }
}

beforeEach(() => {
  getBossProfitRecords.mockReset()
  getWeeklyPeriodKeysWithRecords.mockReset().mockResolvedValue(['2026-11-19'])
})

describe('loadWeekCrystalMeso', () => {
  it('시트 날짜가 든 주의 주간 보스와 그 주에 잡은 월간 보스의 결정석 몫을 더한다', async () => {
    getBossProfitRecords.mockResolvedValue([
      기록({ payoutMeso: 300_000_000 }),
      기록({ bossKey: 'will', payoutMeso: 0 }),
      기록({ bossKey: 'black_mage', cycle: 'monthly', periodKey: '2026-11', defeatedOn: '2026-11-21', payoutMeso: 2_000_000_000 }),
      기록({ bossKey: 'black_mage', cycle: 'monthly', periodKey: '2026-11', defeatedOn: '2026-11-05', payoutMeso: 9 }),
    ])

    await expect(loadWeekCrystalMeso('ocid-1', '2026-11-22', NOW)).resolves.toBe(2_300_000_000)
    expect(getBossProfitRecords).toHaveBeenCalledWith(['ocid-1'], ['2026-11-19', '2026-11'])
  })

  // 11-26 주는 11월과 12월에 걸친다. 두 달의 월간 기록을 함께 본다.
  it('달에 걸친 주는 두 달의 월간 기록을 함께 읽는다', async () => {
    getBossProfitRecords.mockResolvedValue([])

    await expect(loadWeekCrystalMeso('ocid-1', '2026-11-30', NOW)).resolves.toBe(0)
    expect(getBossProfitRecords).toHaveBeenCalledWith(['ocid-1'], ['2026-11-26', '2026-11', '2026-12'])
  })
})
