import { periodStartDateKey } from '../../lib/boss/boss-profit-period'
import type { FeePercent } from '../../lib/cashbook/item-split'
import { withSaleFee } from '../../lib/cashbook/sale-fee'
import { auctionFeePercentOf } from '../../lib/mvp/grades'
import { recordGradeAt } from '../../lib/mvp/fees'
import { applyAutoDropFees, getBulkFeeDropRecords, type DropFeeUpdate } from '../../storage/boss-drops'
import { applyAutoIncomeSaleFee, getBulkFeeIncomeRecords } from '../../storage/income'
import { loadFeeContext } from './fee-context'

/**
 * 기존 사용자의 첫 확인 화면에서 켠 일괄 적용. 수수료가 빈 지난 기록 가운데 그 날 등급이 있는 것에
 * 등급 요율을 붙이고 자동으로 바꾼다. 첫 시작 주보다 앞선 기록은 등급이 없어 건너뛴다. 적용한 수를 돌려준다.
 */
export async function applyFeesToPastRecords(): Promise<number> {
  const [context, incomes, drops] = await Promise.all([loadFeeContext(), getBulkFeeIncomeRecords(), getBulkFeeDropRecords()])
  let applied = 0

  for (const record of incomes) {
    const grade = recordGradeAt(context, record.ocid ?? context.fallbackOcid, record.earnedOn)
    if (grade === null) continue
    const fields = withSaleFee(record, auctionFeePercentOf(grade) as FeePercent)
    if (fields === null) continue
    await applyAutoIncomeSaleFee(record.id, fields)
    applied += 1
  }

  const dropUpdates: DropFeeUpdate[] = []
  for (const drop of drops) {
    const grade = recordGradeAt(context, drop.ocid, periodStartDateKey(drop.periodKey))
    if (grade === null) continue
    const percent = auctionFeePercentOf(grade)
    const { ocid, bossKey, difficulty, periodKey, dropIndex } = drop
    dropUpdates.push({ ocid, bossKey, difficulty, periodKey, dropIndex, saleFeePercent: percent, splitFeePercent: percent })
  }
  await applyAutoDropFees(dropUpdates)
  return applied + dropUpdates.length
}
