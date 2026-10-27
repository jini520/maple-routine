jest.mock('../../../storage/boss-profit', () => ({
  upsertBossProfitRecord: jest.fn(),
  setBossProfitDefeatedOn: jest.fn(),
  deleteBossProfitRecord: jest.fn(),
}))
jest.mock('../../mvp-grade/fee-context', () => ({ loadFeeContext: jest.fn() }))
jest.mock('../../app-review/request', () => ({ countCoreSave: jest.fn() }))

import { upsertBossProfitRecord } from '../../../storage/boss-profit'
import { loadFeeContext } from '../../mvp-grade/fee-context'
import { countCoreSave } from '../../app-review/request'
import { saveManualCompletion } from '../record'

const upsertMock = upsertBossProfitRecord as jest.Mock

beforeEach(() => {
  ;(countCoreSave as jest.Mock).mockClear()
  upsertMock.mockReset().mockResolvedValue(undefined)
  ;(loadFeeContext as jest.Mock).mockReset().mockResolvedValue({
    histories: new Map([['A', [{ startDate: '2026-09-10', grade: 'gold' }]]]),
    sightings: [{ ocid: 'ocid-1', name: '루디', accountId: 'A', firstSeenOn: '2026-09-01', lastSeenOn: '2026-09-22' }],
    fallbackOcid: 'ocid-1',
  })
})

const input = {
  ocid: 'ocid-1',
  bossKey: 'lotus',
  bossName: '스우',
  cycle: 'weekly' as const,
  periodKey: '2026-09-17',
  difficulty: 'hard' as const,
  partySize: 2,
  defeatedOn: '2026-09-18',
  world: null,
  worldKey: null,
}

describe('saveManualCompletion 의 송금 수수료', () => {
  it('자동이면 잡은 날의 등급 요율로 적고 기록도 자동이다', async () => {
    await saveManualCompletion(
      { ...input, shares: { myShare: 2, sharesTotal: 3, splitFeePercent: 5, splitFeeAuto: true } },
      new Date('2026-09-18T12:00:00Z'),
    )

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ splitFeePercent: 3, splitFeeAuto: true }))
  })

  it('손으로 고른 요율은 그대로 적는다', async () => {
    await saveManualCompletion(
      { ...input, shares: { myShare: 2, sharesTotal: 3, splitFeePercent: 5 } },
      new Date('2026-09-18T12:00:00Z'),
    )

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ splitFeePercent: 5, splitFeeAuto: false }))
  })
})

// 리뷰 요청은 저장이 성공한 기록만 센다. 실패한 저장을 세면 기록이 없는 사람에게 묻는다.
describe('saveManualCompletion 과 리뷰 요청의 저장 횟수', () => {
  const shares = { myShare: 1, sharesTotal: 2, splitFeePercent: 5 }

  it('저장이 성공하면 한 번 센다', async () => {
    await saveManualCompletion({ ...input, shares }, new Date('2026-09-18T12:00:00Z'))

    expect(countCoreSave).toHaveBeenCalledTimes(1)
  })

  it('저장이 실패하면 세지 않는다', async () => {
    upsertMock.mockRejectedValueOnce(new Error('저장'))

    await expect(saveManualCompletion({ ...input, shares }, new Date('2026-09-18T12:00:00Z'))).rejects.toThrow()

    expect(countCoreSave).not.toHaveBeenCalled()
  })
})
