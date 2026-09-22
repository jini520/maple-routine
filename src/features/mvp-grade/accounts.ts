/** 등급을 묻고 고치는 자리가 함께 쓰는 메이플 ID 읽기. 추적 캐릭터의 ID 와 ID 표시. */
import { summarizeAccount, type AccountSummaryView } from '../character-manage/derivations'
import { accountOfOcid, type CharacterAccountSighting } from '../../lib/mvp/membership'
import { getAuthConfig } from '../../storage/api-key'
import { getCharacterProfiles } from '../../storage/character-profiles'
import type { MapleAccount } from '../../types'
import { fetchAndRecordCharacterList } from './character-list'

export interface AccountIdentity {
  /** 목록을 못 받았으면 `null` 이라 ID 만 적는다 */
  summary: AccountSummaryView | null
  portraitUrl: string | null
}

/** 추적 캐릭터가 속한 메이플 ID. 추적 차례대로, 겹치지 않게. 소속을 아직 모르는 캐릭터는 빠진다. */
export function trackedAccountIdsOf(
  trackedOcids: readonly string[] | null,
  sightings: readonly CharacterAccountSighting[],
): string[] {
  const ids = (trackedOcids ?? [])
    .map((ocid) => accountOfOcid(sightings, ocid))
    .filter((accountId): accountId is string => accountId !== null)
  return [...new Set(ids)]
}

/** 목록을 받아 그 ID 들의 표시를 만든다. 못 받으면 표시 없이 ID 만 선다. */
export async function loadAccountIdentities(accountIds: readonly string[]): Promise<Map<string, AccountIdentity>> {
  let lists: MapleAccount[] = []
  const auth = await getAuthConfig().catch(() => null)
  if (auth !== null) lists = await fetchAndRecordCharacterList(auth.apiKey).catch(() => [])
  const summaries = new Map<string, AccountSummaryView>()
  for (const account of lists) {
    if (!accountIds.includes(account.accountId)) continue
    const summary = summarizeAccount(account)
    if (summary !== null) summaries.set(account.accountId, summary)
  }
  const profiles = await getCharacterProfiles([...summaries.values()].map((summary) => summary.representative.ocid)).catch(
    () => new Map(),
  )
  return new Map(
    accountIds.map((accountId) => {
      const summary = summaries.get(accountId) ?? null
      const portraitUrl = summary === null ? null : (profiles.get(summary.representative.ocid)?.imageUrl ?? null)
      return [accountId, { summary, portraitUrl }]
    }),
  )
}
