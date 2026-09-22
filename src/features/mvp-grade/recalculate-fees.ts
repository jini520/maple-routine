import { crystalPayoutMeso } from '../../lib/boss/party-shares'
import { periodStartDateKey } from '../../lib/boss/boss-profit-period'
import type { FeePercent } from '../../lib/cashbook/item-split'
import { withSaleFee } from '../../lib/cashbook/sale-fee'
import { autoFeePercent, type FeeRateContext } from '../../lib/mvp/fees'
import { getAutoFeeDropRecords, updateDropFees, type DropFeeUpdate } from '../../storage/boss-drops'
import { getAutoFeeProfitRecords, updateProfitSplitFees, type ProfitSplitFeeUpdate } from '../../storage/boss-profit'
import { getCharacterAccountSightings } from '../../storage/character-accounts'
import { getRepresentativeCharacter, getTrackedCharacterOcids } from '../../storage/character-selection'
import { getAutoFeeIncomeRecords, updateIncomeSaleFee } from '../../storage/income'
import { getMvpGradeHistories } from '../../storage/mvp-grades'

/** 캐릭터 없는 옛 수입 기록이 쓰는 캐릭터. 대표가 목록에서 빠졌으면 추적 목록의 첫 캐릭터다. */
async function representativeOcid(): Promise<string | null> {
  const representative = await getRepresentativeCharacter()
  if (representative !== null) return representative
  return (await getTrackedCharacterOcids())?.[0] ?? null
}

/**
 * 수수료가 자동인 기록을 지금의 등급 기록으로 다시 센다. 요율이 바뀐 기록만 다시 쓰고 그 수를 돌려준다.
 * 등급 기록을 바꾸는 자리(설정의 시트 · 주간 수정 · 새 메이플 ID 흐름)가 저장한 뒤 부른다.
 */
export async function recalculateAutoFees(): Promise<number> {
  const [histories, sightings, representative, incomes, drops, crystals] = await Promise.all([
    getMvpGradeHistories(),
    getCharacterAccountSightings(),
    representativeOcid(),
    getAutoFeeIncomeRecords(),
    getAutoFeeDropRecords(),
    getAutoFeeProfitRecords(),
  ])
  const context: FeeRateContext = { histories, sightings }
  let changed = 0

  for (const record of incomes) {
    const percent = autoFeePercent(context, record.ocid ?? representative, record.earnedOn) as FeePercent
    if (record.saleFeePercent === percent) continue
    const fields = withSaleFee(record, percent)
    if (fields === null) continue
    await updateIncomeSaleFee(record.id, fields)
    changed += 1
  }

  const dropUpdates: DropFeeUpdate[] = []
  for (const drop of drops) {
    const percent = autoFeePercent(context, drop.ocid, periodStartDateKey(drop.periodKey))
    const saleFeePercent = drop.saleFeeAuto ? percent : drop.saleFeePercent
    const splitFeePercent = drop.splitFeeAuto ? percent : drop.splitFeePercent
    if (saleFeePercent === drop.saleFeePercent && splitFeePercent === drop.splitFeePercent) continue
    const { ocid, bossKey, difficulty, periodKey, dropIndex } = drop
    dropUpdates.push({ ocid, bossKey, difficulty, periodKey, dropIndex, saleFeePercent, splitFeePercent })
  }
  await updateDropFees(dropUpdates)
  changed += dropUpdates.length

  const crystalUpdates: ProfitSplitFeeUpdate[] = []
  for (const record of crystals) {
    const percent = autoFeePercent(context, record.ocid, record.defeatedOn ?? periodStartDateKey(record.periodKey))
    if (record.splitFeePercent === percent) continue
    const payoutMeso = crystalPayoutMeso(record.priceMeso, record.partySize, {
      myShare: record.crystalMyShare,
      sharesTotal: record.crystalSharesTotal,
      splitFeePercent: percent,
    })
    const { ocid, bossKey, difficulty, periodKey } = record
    crystalUpdates.push({ ocid, bossKey, difficulty, periodKey, splitFeePercent: percent, payoutMeso })
  }
  await updateProfitSplitFees(crystalUpdates)
  changed += crystalUpdates.length

  return changed
}
