import { crystalPayoutMeso } from '../../lib/boss/party-shares'
import { periodStartDateKey } from '../../lib/boss/boss-profit-period'
import type { FeePercent } from '../../lib/cashbook/item-split'
import { transferFeeMeso } from '../../lib/cashbook/boss-income-transfer'
import { withSaleFee } from '../../lib/cashbook/sale-fee'
import { accountFeePercent, autoFeePercent } from '../../lib/mvp/fees'
import { getAutoFeeDropRecords, type DropFeeUpdate } from '../../storage/boss-drops'
import { getAutoFeeProfitRecords, type ProfitSplitFeeUpdate } from '../../storage/boss-profit'
import { getAutoFeeIncomeRecords, type IncomeSaleFeeUpdate } from '../../storage/income'
import { getAutoFeeTransferRecords, type TransferFeeUpdate } from '../../storage/spend'
import { loadFeeContext } from './fee-context'

/**
 * 다시 계산이 고쳐 쓸 수입 기록. 수수료가 자동인 기록 가운데 지금의 등급 기록으로 센 요율이 적힌 요율과 다른 것이다.
 * 고쳐 쓰면 요율이 맞아 다시 안 잡힌다.
 */
export async function recalcIncomeUpdates(): Promise<IncomeSaleFeeUpdate[]> {
  const [context, incomes] = await Promise.all([loadFeeContext(), getAutoFeeIncomeRecords()])
  const updates: IncomeSaleFeeUpdate[] = []
  for (const record of incomes) {
    // 메이플 ID 기록(인벤토리에서 판 것)은 그 메이플 ID 의 등급이다. 캐릭터도 메이플 ID 도 없는 옛 기록만 대표 캐릭터로 센다.
    const percent = (
      record.ocid === null && record.accountId !== undefined
        ? accountFeePercent(context, record.accountId, record.earnedOn)
        : autoFeePercent(context, record.ocid ?? context.fallbackOcid, record.earnedOn)
    ) as FeePercent
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
      excluded: record.crystalExcluded,
    })
    const { ocid, bossKey, difficulty, periodKey } = record
    updates.push({ ocid, bossKey, difficulty, periodKey, splitFeePercent: percent, payoutMeso })
  }
  return updates
}

/** 다시 계산이 고쳐 쓸 `주간 보스 수입 이전` 기록. 요율은 메소를 받는 캐릭터의 그 날짜 등급이고, 수수료가 곧 지출이라 함께 다시 센다 */
export async function recalcTransferUpdates(): Promise<TransferFeeUpdate[]> {
  const [context, records] = await Promise.all([loadFeeContext(), getAutoFeeTransferRecords()])
  const updates: TransferFeeUpdate[] = []
  for (const record of records) {
    const transfer = record.transfer
    if (transfer === undefined) continue
    const percent = autoFeePercent(context, transfer.receiverOcid, record.spentOn)
    if (percent === transfer.feePercent) continue
    updates.push({ id: record.id, feePercent: percent, mesoAmount: transferFeeMeso(transfer.transferMeso, percent) })
  }
  return updates
}
