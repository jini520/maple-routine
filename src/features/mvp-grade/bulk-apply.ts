import { periodStartDateKey } from '../../lib/boss/boss-profit-period'
import type { FeePercent } from '../../lib/cashbook/item-split'
import { withSaleFee } from '../../lib/cashbook/sale-fee'
import { auctionFeePercentOf } from '../../lib/mvp/grades'
import { recordGradeAt } from '../../lib/mvp/fees'
import { getBulkFeeDropRecords, type DropFeeUpdate } from '../../storage/boss-drops'
import { getBulkFeeIncomeRecords, type IncomeSaleFeeUpdate } from '../../storage/income'
import { loadFeeContext } from './fee-context'

/**
 * 일괄 적용이 고쳐 쓸 수입 기록. 수수료가 빈 기록 가운데 그 날 등급이 있는 것에 등급 요율을 붙인다.
 * 첫 시작 주보다 앞선 기록은 등급이 없어 빠진다. 적용하면 수수료가 들어가 다시 안 잡힌다.
 */
export async function bulkIncomeUpdates(): Promise<IncomeSaleFeeUpdate[]> {
  const [context, incomes] = await Promise.all([loadFeeContext(), getBulkFeeIncomeRecords()])
  const updates: IncomeSaleFeeUpdate[] = []
  for (const record of incomes) {
    const grade = recordGradeAt(context, record.ocid ?? context.fallbackOcid, record.earnedOn)
    if (grade === null) continue
    const fields = withSaleFee(record, auctionFeePercentOf(grade) as FeePercent)
    if (fields !== null) updates.push({ id: record.id, ...fields })
  }
  return updates
}

/** 일괄 적용이 고쳐 쓸 드롭. 판매 · 분배 두 칸에 같은 요율을 붙인다. */
export async function bulkDropUpdates(): Promise<DropFeeUpdate[]> {
  const [context, drops] = await Promise.all([loadFeeContext(), getBulkFeeDropRecords()])
  const updates: DropFeeUpdate[] = []
  for (const drop of drops) {
    const grade = recordGradeAt(context, drop.ocid, periodStartDateKey(drop.periodKey))
    if (grade === null) continue
    const percent = auctionFeePercentOf(grade)
    const { ocid, bossKey, difficulty, periodKey, dropIndex } = drop
    updates.push({ ocid, bossKey, difficulty, periodKey, dropIndex, saleFeePercent: percent, splitFeePercent: percent })
  }
  return updates
}
