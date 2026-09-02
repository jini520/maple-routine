// 증감 칩의 비교 기준(**정정**, 2026-08-10). **결정석만 본다.**
//
// 처음엔 드롭도 더했다(이번 기간이 아이템 포함이라 셈법을 맞추려고). 사용자가 뒤집었다: 아이템
// 판매가는 주마다 들쭉날쭉해서 섞으면 증감이 "이번 주 보스를 얼마나 돌았나"가 아니라 "비싼 게
// 떴나"를 말하게 된다. 화면도 같은 잣대로 이번 기간의 결정석 합만 넘긴다.

jest.mock('../../../storage/boss-profit', () => ({
  getBossProfitRecords: jest.fn(),
  getAllBossProfitRecordKeys: jest.fn(),
}))
const { getBossProfitRecords: getBossProfitRecordsMock } = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
jest.mock('../../../storage/boss-drops', () => ({
  getBossDropRecords: jest.fn(),
}))
const { getBossDropRecords: getBossDropRecordsMock } = jest.requireMock('../../../storage/boss-drops') as Record<string, jest.Mock>

beforeEach(() => {
  getBossProfitRecordsMock.mockReset().mockResolvedValue([])
  getBossDropRecordsMock.mockReset().mockResolvedValue([])
})

describe('loadPreviousPeriodTotal: 결정석만 (정정)', () => {
  it('결정석 기록 합만 낸다. 그 기간에 아이템을 팔았어도 더하지 않는다', async () => {
    getBossProfitRecordsMock.mockResolvedValue([{ payoutMeso: 6_800_000_000 }])
    getBossDropRecordsMock.mockResolvedValue([
      { priceState: 'entered', priceMeso: 15_000_000_000, priceShare: 3 },
    ])
    const { loadPreviousPeriodTotal } = require('../backfill') as typeof import('../backfill')

    await expect(loadPreviousPeriodTotal(['ocid-1'], 'weekly', '2026-08-13')).resolves.toBe(
      6_800_000_000,
    )
  })

  it('드롭 테이블을 아예 읽지 않는다. 쓰지 않을 값을 조회하지 않는다', async () => {
    getBossProfitRecordsMock.mockResolvedValue([{ payoutMeso: 1 }])
    const { loadPreviousPeriodTotal } = require('../backfill') as typeof import('../backfill')

    await loadPreviousPeriodTotal(['ocid-1'], 'weekly', '2026-08-13')

    expect(getBossDropRecordsMock).not.toHaveBeenCalled()
  })

  it('ocid 가 없으면 조회하지 않는다', async () => {
    const { loadPreviousPeriodTotal } = require('../backfill') as typeof import('../backfill')

    await expect(loadPreviousPeriodTotal([], 'weekly', '2026-08-13')).resolves.toBe(0)
    expect(getBossProfitRecordsMock).not.toHaveBeenCalled()
  })
})
