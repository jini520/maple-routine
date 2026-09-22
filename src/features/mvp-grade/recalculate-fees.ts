import { crystalPayoutMeso } from '../../lib/boss/party-shares'
import { periodStartDateKey } from '../../lib/boss/boss-profit-period'
import type { FeePercent } from '../../lib/cashbook/item-split'
import { withSaleFee } from '../../lib/cashbook/sale-fee'
import { autoFeePercent } from '../../lib/mvp/fees'
import { getAutoFeeDropRecords, type DropFeeUpdate } from '../../storage/boss-drops'
import { getAutoFeeProfitRecords, type ProfitSplitFeeUpdate } from '../../storage/boss-profit'
import { getAutoFeeIncomeRecords, type IncomeSaleFeeUpdate } from '../../storage/income'
import { loadFeeContext } from './fee-context'

/**
 * 다시 계산이 고쳐 쓸 수입 기록. 수수료가 자동인 기록 가운데 지금의 등급 기록으로 센 요율이 적힌 요율과 다른 것이다.
 * 고쳐 쓰면 요율이 맞아 다시 안 잡힌다.
 */
export async function recalcIncomeUpdates(): Promise<IncomeSaleFeeUpdate[]> {
  const [context, incomes] = await Promise.all([loadFeeContext(), getAutoFeeIncomeRecords()])
  const updates: IncomeSaleFeeUpdate[] = []
  for (const record of incomes) {
    const percent = autoFeePercent(context, record.ocid ?? context.fallbackOcid, record.earnedOn) as FeePercent
    if (record.saleFeePercent === percent) continue
    const fields = withSaleFee(record, percent)
    if (fields !== null) updates.push({ id: record.id, ...fields })
  }
  return updates
}

/** 다시 계산이 고쳐 쓸 드롭. 자동인 칸만 바꾼다. */
export async function recalcDropUpdates(): Promise<DropFeeUpdate[]> {
  const [context, drops] = await Promise.all([loadFeeContext(), getAutoFeeDropRecords()])
  const updates: DropFeeUpdate[] = []
  for (const drop of drops) {
    const percent = autoFeePercent(context, drop.ocid, periodStartDateKey(drop.periodKey))
    const saleFeePercent = drop.saleFeeAuto ? percent : drop.saleFeePercent
    const splitFeePercent = drop.splitFeeAuto ? percent : drop.splitFeePercent
    if (saleFeePercent === drop.saleFeePercent && splitFeePercent === drop.splitFeePercent) continue
    const { ocid, bossKey, difficulty, periodKey, dropIndex } = drop
    updates.push({ ocid, bossKey, difficulty, periodKey, dropIndex, saleFeePercent, splitFeePercent })
  }
  return updates
}

/** 다시 계산이 고쳐 쓸 결정석 기록. 받은 몫이 저장된 값이라 요율과 함께 다시 센다. */
export async function recalcCrystalUpdates(): Promise<ProfitSplitFeeUpdate[]> {
  const [context, crystals] = await Promise.all([loadFeeContext(), getAutoFeeProfitRecords()])
  const updates: ProfitSplitFeeUpdate[] = []
  for (const record of crystals) {
    const percent = autoFeePercent(context, record.ocid, record.defeatedOn ?? periodStartDateKey(record.periodKey))
    if (record.splitFeePercent === percent) continue
    const payoutMeso = crystalPayoutMeso(record.priceMeso, record.partySize, {
      myShare: record.crystalMyShare,
      sharesTotal: record.crystalSharesTotal,
      splitFeePercent: percent,
    })
    const { ocid, bossKey, difficulty, periodKey } = record
    updates.push({ ocid, bossKey, difficulty, periodKey, splitFeePercent: percent, payoutMeso })
  }
  return updates
}
