jest.mock('../../../storage/mvp-grades', () => ({ getMvpGradeHistories: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ getCharacterAccountSightings: jest.fn() }))
jest.mock('../../../storage/character-selection', () => ({
  getRepresentativeCharacter: jest.fn(),
  getTrackedCharacterOcids: jest.fn(),
}))
jest.mock('../../../storage/income', () => ({ getAutoFeeIncomeRecords: jest.fn(), updateIncomeSaleFee: jest.fn() }))
jest.mock('../../../storage/boss-drops', () => ({ getAutoFeeDropRecords: jest.fn(), updateDropFees: jest.fn() }))
jest.mock('../../../storage/boss-profit', () => ({ getAutoFeeProfitRecords: jest.fn(), updateProfitSplitFees: jest.fn() }))

import { getMvpGradeHistories } from '../../../storage/mvp-grades'
import { getCharacterAccountSightings } from '../../../storage/character-accounts'
import { getRepresentativeCharacter, getTrackedCharacterOcids } from '../../../storage/character-selection'
import { getAutoFeeIncomeRecords, updateIncomeSaleFee } from '../../../storage/income'
import { getAutoFeeDropRecords, updateDropFees } from '../../../storage/boss-drops'
import { getAutoFeeProfitRecords, updateProfitSplitFees } from '../../../storage/boss-profit'
import { recalculateAutoFees } from '../recalculate-fees'

const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.Mock

// A 는 8/6 부터 실버(3%), 그 앞은 브론즈(5%). B 는 등급이 없다(일반 5%).
beforeEach(() => {
  jest.clearAllMocks()
  mocked(getMvpGradeHistories).mockResolvedValue(
    new Map([['A', [{ startDate: '2026-06-11', grade: 'bronze' }, { startDate: '2026-08-06', grade: 'silver' }]]]),
  )
  mocked(getCharacterAccountSightings).mockResolvedValue([
    { ocid: 'a1', name: '에이', accountId: 'A', firstSeenOn: '2026-06-01', lastSeenOn: '2026-09-22' },
    { ocid: 'b1', name: '비', accountId: 'B', firstSeenOn: '2026-06-01', lastSeenOn: '2026-09-22' },
  ])
  mocked(getRepresentativeCharacter).mockResolvedValue('a1')
  mocked(getTrackedCharacterOcids).mockResolvedValue(['b1', 'a1'])
  mocked(getAutoFeeIncomeRecords).mockResolvedValue([])
  mocked(getAutoFeeDropRecords).mockResolvedValue([])
  mocked(getAutoFeeProfitRecords).mockResolvedValue([])
})

const income = (over: Record<string, unknown>) => ({
  id: 'x',
  ocid: 'a1',
  earnedOn: '2026-08-10',
  category: 'item_sale',
  mesoAmount: 1_140_000_000,
  saleFeePercent: 5,
  saleFeeMeso: 60_000_000,
  saleFeeAuto: true,
  hunt: null,
  ...over,
})

describe('recalculateAutoFees', () => {
  it('요율이 바뀐 수입 기록만 다시 쓰고 그 수를 센다', async () => {
    mocked(getAutoFeeIncomeRecords).mockResolvedValue([
      income({ id: 'changed' }),
      income({ id: 'same', earnedOn: '2026-07-01' }), // 그 날은 브론즈라 5% 그대로
    ])

    await expect(recalculateAutoFees()).resolves.toBe(1)
    expect(updateIncomeSaleFee).toHaveBeenCalledTimes(1)
    expect(updateIncomeSaleFee).toHaveBeenCalledWith('changed', { mesoAmount: 1_164_000_000, saleFeePercent: 3, saleFeeMeso: 36_000_000 })
  })

  it('캐릭터 없는 옛 기록은 대표 캐릭터의 ID 로 센다', async () => {
    mocked(getAutoFeeIncomeRecords).mockResolvedValue([income({ id: 'account-wide', ocid: null })])

    await expect(recalculateAutoFees()).resolves.toBe(1)
    expect(mocked(updateIncomeSaleFee).mock.calls[0][1].saleFeePercent).toBe(3)
  })

  it('대표 캐릭터가 없으면 추적 목록의 첫 캐릭터로 센다', async () => {
    mocked(getRepresentativeCharacter).mockResolvedValue(null)
    mocked(getAutoFeeIncomeRecords).mockResolvedValue([income({ id: 'account-wide', ocid: null })])

    // 첫 캐릭터 b1 의 ID B 는 등급이 없어 일반 5% 라 그대로다
    await expect(recalculateAutoFees()).resolves.toBe(0)
  })

  it('드롭은 자동인 칸만 바꾼다', async () => {
    mocked(getAutoFeeDropRecords).mockResolvedValue([
      {
        ocid: 'a1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-08-06', dropIndex: 0,
        saleFeePercent: 5, splitFeePercent: 5, saleFeeAuto: true, splitFeeAuto: false,
      },
    ])

    await expect(recalculateAutoFees()).resolves.toBe(1)
    expect(updateDropFees).toHaveBeenCalledWith([
      { ocid: 'a1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-08-06', dropIndex: 0, saleFeePercent: 3, splitFeePercent: 5 },
    ])
  })

  it('결정석은 요율과 함께 받은 몫을 다시 센다', async () => {
    mocked(getAutoFeeProfitRecords).mockResolvedValue([
      {
        ocid: 'a1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-08-06', partySize: 2, priceMeso: 1_000_000,
        payoutMeso: 0, crystalMyShare: 2, crystalSharesTotal: 3, splitFeePercent: 5, splitFeeAuto: true, defeatedOn: null,
      },
    ])

    await expect(recalculateAutoFees()).resolves.toBe(1)
    // 500,000 × (200 − 3) × 2 / (300 − 3 × 1)
    expect(updateProfitSplitFees).toHaveBeenCalledWith([
      { ocid: 'a1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-08-06', splitFeePercent: 3, payoutMeso: 663_299 },
    ])
  })
})
