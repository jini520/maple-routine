/**
 * 주인을 모르는 옛 손입력을 그 넥슨 계정의 하나뿐인 메이플 ID 로 옮기는 부팅 단계. 앱을 켤 때마다 돈다.
 *
 * 메이플 ID 소속은 `character/list` 를 받아야 생기므로, 옮길 기록이 남아 있으면 다음 부팅에 다시 본다.
 */
import { ACCOUNT_INCOME_CATEGORY_KEYS, ACCOUNT_SPEND_CATEGORY_KEYS } from '../../lib/cashbook/categories'
import { assignLegacyIncomeAccounts } from '../../storage/income'
import { assignLegacySpendAccounts } from '../../storage/spend'
import { fillLegacyAccountIds } from '../auth/legacy-account-ids'

/**
 * 옛 계정 칸의 빈 글자를 메인 계정으로 채운 뒤에 돈다. 먼저 돌면 그 기록의 넥슨 계정을 몰라 메이플 ID 를 셀 수 없다.
 * 실패해도 기록은 그대로 보이므로 삼킨다.
 *
 * @example void assignLegacyEntryAccounts()
 */
export async function assignLegacyEntryAccounts(): Promise<void> {
  await fillLegacyAccountIds()
  await Promise.all([
    assignLegacyIncomeAccounts(ACCOUNT_INCOME_CATEGORY_KEYS),
    assignLegacySpendAccounts(ACCOUNT_SPEND_CATEGORY_KEYS),
  ]).catch(() => undefined)
}
