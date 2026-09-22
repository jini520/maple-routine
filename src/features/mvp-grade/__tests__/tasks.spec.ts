/** MVP 등급의 두 작업. 단계가 목록 함수로 남은 일을 세고, 조각만큼 잘라 저장소에 쓴다. */
jest.mock('../bulk-apply', () => ({ bulkIncomeUpdates: jest.fn(), bulkDropUpdates: jest.fn() }))
jest.mock('../recalculate-fees', () => ({
  recalcIncomeUpdates: jest.fn(),
  recalcDropUpdates: jest.fn(),
  recalcCrystalUpdates: jest.fn(),
}))
jest.mock('../../../storage/income', () => ({ applyAutoIncomeSaleFees: jest.fn(), updateIncomeSaleFees: jest.fn() }))
jest.mock('../../../storage/boss-drops', () => ({ applyAutoDropFees: jest.fn(), updateDropFees: jest.fn() }))
jest.mock('../../../storage/boss-profit', () => ({ updateProfitSplitFees: jest.fn() }))

import { bulkIncomeUpdates } from '../bulk-apply'
import { recalcCrystalUpdates } from '../recalculate-fees'
import { applyAutoIncomeSaleFees } from '../../../storage/income'
import { updateProfitSplitFees } from '../../../storage/boss-profit'
import { mvpBulkFeeTask, mvpRecalcFeeTask } from '../tasks'

const m = (fn: unknown) => fn as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('지난 기록 수수료 적용', () => {
  it('판매 기록 · 드롭 판매가 두 단계이고 이름 · 제목 · 완료 문구가 선다', () => {
    expect(mvpBulkFeeTask.steps.map((step) => step.label)).toEqual(['판매 기록', '드롭 판매가'])
    expect(mvpBulkFeeTask.name).toBe('지난 기록 수수료 적용')
    expect(mvpBulkFeeTask.title).toBe('지난 기록에 수수료를 적용하고 있어요')
    expect(mvpBulkFeeTask.doneToast(1240)).toBe('지난 기록 1,240건에 수수료를 적용했어요')
  })

  it('남은 일은 목록의 길이이고, 조각은 앞에서 limit 개를 잘라 적용한다', async () => {
    const updates = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, mesoAmount: 1, saleFeePercent: 3, saleFeeMeso: 0 }))
    m(bulkIncomeUpdates).mockResolvedValue(updates)
    const [sales] = mvpBulkFeeTask.steps

    await expect(sales!.remaining()).resolves.toBe(5)
    await expect(sales!.runChunk(2)).resolves.toBe(2)
    expect(applyAutoIncomeSaleFees).toHaveBeenCalledWith(updates.slice(0, 2))
  })
})

describe('자동 수수료 다시 계산', () => {
  it('판매 기록 · 드롭 판매가 · 결정석 분배 세 단계다', () => {
    expect(mvpRecalcFeeTask.steps.map((step) => step.label)).toEqual(['판매 기록', '드롭 판매가', '결정석 분배'])
    expect(mvpRecalcFeeTask.doneToast(3)).toBe('자동 수수료 기록 3건을 다시 계산했어요')
  })

  it('결정석 단계는 받은 몫과 함께 고쳐 쓴다', async () => {
    const update = { ocid: 'a1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-08-06', splitFeePercent: 3, payoutMeso: 1 }
    m(recalcCrystalUpdates).mockResolvedValue([update])

    await expect(mvpRecalcFeeTask.steps[2]!.runChunk(200)).resolves.toBe(1)
    expect(updateProfitSplitFees).toHaveBeenCalledWith([update])
  })
})
