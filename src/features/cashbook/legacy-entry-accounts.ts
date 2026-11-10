/**
 * 주인을 모르는 옛 손입력을 붙이는 부팅 단계. 앱을 켤 때마다 돈다.
 *
 * 그 넥슨 계정의 메이플 ID 가 하나뿐이면 그 ID 로 옮긴다. 그래도 남은 기록은 화면이 대표로 세우는 캐릭터에게 붙인다. 지금까지
 * 앱은 넥슨 계정을 하나만 두어 고르지 않고 적은 기록도 그 계정의 것이고, 사용자가 직접 적은 기록이라 대표 캐릭터에게 붙인다.
 * 메이플 ID 소속은 `character/list` 를 받아야 생기므로, 붙일 기록이 남아 있으면 다음 부팅에 다시 본다.
 */
import { ACCOUNT_INCOME_CATEGORY_KEYS, ACCOUNT_SPEND_CATEGORY_KEYS } from '../../lib/cashbook/categories'
import { accountOfOcid } from '../../lib/mvp/membership'
import { getCharacterAccountSightings } from '../../storage/character-accounts'
import { getRepresentativeCharacter, getTrackedCharacterOcids } from '../../storage/character-selection'
import { assignLegacyIncomeAccounts, assignOwnerlessIncomes } from '../../storage/income'
import { assignLegacySpendAccounts, assignOwnerlessSpends } from '../../storage/spend'
import { fillLegacyAccountIds } from '../auth/legacy-account-ids'
import { resolveDisplayRepresentative } from '../character-manage/derivations'

/**
 * 옛 계정 칸의 빈 글자를 메인 계정으로 채운 뒤에 돈다. 먼저 돌면 그 기록의 넥슨 계정을 몰라 메이플 ID 를 셀 수 없다.
 * 실패해도 기록은 그대로 보이므로 삼킨다.
 *
 * @example void assignLegacyEntryAccounts()
 */
export async function assignLegacyEntryAccounts(): Promise<void> {
  await fillLegacyAccountIds()
  try {
    await Promise.all([
      assignLegacyIncomeAccounts(ACCOUNT_INCOME_CATEGORY_KEYS),
      assignLegacySpendAccounts(ACCOUNT_SPEND_CATEGORY_KEYS),
    ])
    const owner = await representativeOwner()
    if (owner === null) return
    await Promise.all([
      assignOwnerlessIncomes(owner, ACCOUNT_INCOME_CATEGORY_KEYS),
      assignOwnerlessSpends(owner, ACCOUNT_SPEND_CATEGORY_KEYS),
    ])
  } catch {
    // 다음에 켤 때 다시 본다.
  }
}

/** 화면이 대표로 세우는 캐릭터와 그 메이플 ID. 대표가 없거나 그 메이플 ID 를 아직 모르면 `null`. */
async function representativeOwner(): Promise<{ ocid: string; accountId: string } | null> {
  const [stored, tracked, sightings] = await Promise.all([
    getRepresentativeCharacter(),
    getTrackedCharacterOcids(),
    getCharacterAccountSightings(),
  ])
  const ocid = resolveDisplayRepresentative(tracked ?? [], stored)
  if (ocid === null) return null
  const accountId = accountOfOcid(sightings, ocid)
  return accountId === null ? null : { ocid, accountId }
}
