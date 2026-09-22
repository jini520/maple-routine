jest.mock('../../../storage/mvp-grades', () => ({ getMvpGradeHistories: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ getCharacterAccountSightings: jest.fn() }))
jest.mock('../../../storage/character-selection', () => ({
  getRepresentativeCharacter: jest.fn(),
  getTrackedCharacterOcids: jest.fn(),
}))
jest.mock('../../../storage/income', () => ({ getBulkFeeIncomeRecords: jest.fn(), applyAutoIncomeSaleFee: jest.fn() }))
jest.mock('../../../storage/boss-drops', () => ({ getBulkFeeDropRecords: jest.fn(), applyAutoDropFees: jest.fn() }))

import { getMvpGradeHistories } from '../../../storage/mvp-grades'
import { getCharacterAccountSightings } from '../../../storage/character-accounts'
import { getRepresentativeCharacter, getTrackedCharacterOcids } from '../../../storage/character-selection'
import { applyAutoIncomeSaleFee, getBulkFeeIncomeRecords } from '../../../storage/income'
import { applyAutoDropFees, getBulkFeeDropRecords } from '../../../storage/boss-drops'
import { applyFeesToPastRecords } from '../bulk-apply'

const mocked = (fn: unknown) => fn as jest.Mock

// A 는 8/6 부터 실버(3%).
beforeEach(() => {
  jest.clearAllMocks()
  mocked(getMvpGradeHistories).mockResolvedValue(new Map([['A', [{ startDate: '2026-08-06', grade: 'silver' }]]]))
  mocked(getCharacterAccountSightings).mockResolvedValue([
    { ocid: 'a1', name: '에이', accountId: 'A', firstSeenOn: '2026-06-01', lastSeenOn: '2026-09-22' },
  ])
  mocked(getRepresentativeCharacter).mockResolvedValue('a1')
  mocked(getTrackedCharacterOcids).mockResolvedValue(['a1'])
  mocked(getBulkFeeIncomeRecords).mockResolvedValue([])
  mocked(getBulkFeeDropRecords).mockResolvedValue([])
})

describe('applyFeesToPastRecords', () => {
  it('그 날 등급이 있는 기록에만 등급 요율을 붙이고 적용한 수를 센다', async () => {
    mocked(getBulkFeeIncomeRecords).mockResolvedValue([
      { id: 'after', ocid: 'a1', earnedOn: '2026-08-10', category: 'item_sale', mesoAmount: 1_000_000_000, saleFeeMeso: null, hunt: null },
      // 첫 시작 주보다 앞이라 등급이 없다
      { id: 'before', ocid: 'a1', earnedOn: '2026-08-01', category: 'item_sale', mesoAmount: 1_000_000_000, saleFeeMeso: null, hunt: null },
      // 캐릭터 없는 옛 기록은 대표 캐릭터의 ID 로 센다
      { id: 'account-wide', ocid: null, earnedOn: '2026-08-10', category: 'item_sale', mesoAmount: 500_000_000, saleFeeMeso: null, hunt: null },
    ])

    await expect(applyFeesToPastRecords()).resolves.toBe(2)
    expect(applyAutoIncomeSaleFee).toHaveBeenCalledWith('after', { mesoAmount: 970_000_000, saleFeePercent: 3, saleFeeMeso: 30_000_000 })
    expect(applyAutoIncomeSaleFee).toHaveBeenCalledWith('account-wide', { mesoAmount: 485_000_000, saleFeePercent: 3, saleFeeMeso: 15_000_000 })
  })

  it('드롭은 판매 · 분배 두 칸에 같은 요율을 붙인다', async () => {
    mocked(getBulkFeeDropRecords).mockResolvedValue([
      { ocid: 'a1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-08-06', dropIndex: 0 },
      { ocid: 'a1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-07-30', dropIndex: 0 },
    ])

    await expect(applyFeesToPastRecords()).resolves.toBe(1)
    expect(applyAutoDropFees).toHaveBeenCalledWith([
      { ocid: 'a1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-08-06', dropIndex: 0, saleFeePercent: 3, splitFeePercent: 3 },
    ])
  })
})
