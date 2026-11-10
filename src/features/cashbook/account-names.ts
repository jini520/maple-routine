/**
 * 메이플 ID 기록의 이름(`메이플 ID · 대표 캐릭터`)과 시트의 메이플 ID 보기.
 *
 * 메이플 ID 는 사람이 읽을 수 없는 글자라 그 ID 의 대표 캐릭터로 부른다. 넥슨을 부르지 않는다. 대표는 기기에 저장된
 * `character/list` 응답에서 고르고, 없으면 그 ID 의 추적 캐릭터에서 고른다. 기록에는 ID 만 있어서 이름은 그릴 때 만든다.
 */
import { compareByName, pickRepresentativeCharacter } from '../../lib/character-order'
import { accountOfOcid, type CharacterAccountSighting } from '../../lib/mvp/membership'
import { getCharacterAccountSightings } from '../../storage/character-accounts'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import type { MapleAccount } from '../../types'
import { currentCredentials } from '../auth/current-credential'
import { trackedAccountIdsOf } from '../mvp-grade/accounts'
import { readCachedCharacterLists } from '../mvp-grade/character-list'
import { readCharacterBasic } from '../schedule-sync/read-schedule'

/** 대표를 못 찾은 ID 의 이름. MVP 등급 카드가 목록을 못 받은 ID 를 부르는 말과 같다. */
const MAPLE_ID_NAME = '메이플 ID'

/** 시트의 캐릭터 칸에 캐릭터 뒤로 서는 메이플 ID 보기 하나. */
export interface SheetAccount {
  accountId: string
  /** `메이플 ID · 대표 캐릭터` */
  label: string
}

/** 이름을 만드는 데 쓰는 기기의 값. 화면 밖에서 시험하려고 읽기와 계산을 가른다. */
export interface AccountNameSources {
  /** 기기에 저장된 `character/list` 응답. 받은 적이 없으면 `undefined` */
  lists: readonly MapleAccount[] | undefined
  sightings: readonly CharacterAccountSighting[]
  trackedOcids: readonly string[]
  /** 추적 캐릭터의 이름 · 레벨. 캐시에 없으면 `null` */
  profileOf: (ocid: string) => { name: string; level: number | null } | null
}

interface Representative {
  name: string
  level: number
}

/** 대표 레벨이 높은 것이 먼저이고, 같으면 이름순이다. 캐릭터 관리의 메이플 ID 드롭다운과 같은 차례다. */
function byRepresentative(left: Representative, right: Representative): number {
  return right.level !== left.level ? right.level - left.level : compareByName(left.name, right.name)
}

function representativeOf(accountId: string, sources: AccountNameSources): Representative | null {
  const listed = sources.lists?.find((account) => account.accountId === accountId)
  if (listed !== undefined && listed.characters.length > 0) return pickRepresentativeCharacter(listed.characters)
  const tracked = sources.trackedOcids.flatMap((ocid) => {
    if (accountOfOcid(sources.sightings, ocid) !== accountId) return []
    const profile = sources.profileOf(ocid)
    return profile === null || profile.name === '' ? [] : [{ name: profile.name, level: profile.level ?? 0 }]
  })
  return tracked.sort(byRepresentative)[0] ?? null
}

function labelOf(representative: Representative | null): string {
  return representative === null ? MAPLE_ID_NAME : `${MAPLE_ID_NAME} · ${representative.name}`
}

/** ID 마다 이름. 하루 목록 줄과 통계가 기록의 이름으로 쓴다. */
export function accountLabelsOf(accountIds: readonly string[], sources: AccountNameSources): Map<string, string> {
  return new Map(accountIds.map((accountId) => [accountId, labelOf(representativeOf(accountId, sources))]))
}

/** 추적 캐릭터가 속한 ID 의 보기. 대표를 못 찾은 ID 는 맨 끝이다. */
export function sheetAccountsOf(sources: AccountNameSources): SheetAccount[] {
  return trackedAccountIdsOf(sources.trackedOcids, sources.sightings)
    .map((accountId) => ({ accountId, representative: representativeOf(accountId, sources) }))
    .sort((left, right) => {
      if (left.representative === null || right.representative === null) {
        return Number(left.representative === null) - Number(right.representative === null)
      }
      return byRepresentative(left.representative, right.representative)
    })
    .map(({ accountId, representative }) => ({ accountId, label: labelOf(representative) }))
}

/** 못 읽은 값은 비운 채로 간다. 이름이 `메이플 ID` 로 떨어질 뿐 기록은 보인다. */
async function loadSources(): Promise<AccountNameSources> {
  const [sightings, trackedOcids, credentials] = await Promise.all([
    getCharacterAccountSightings().catch(() => []),
    getTrackedCharacterOcids().catch(() => null),
    currentCredentials(),
  ])
  return {
    // 넥슨 계정마다 받아 둔 목록을 모은다. 부계정의 메이플 ID 는 그 계정의 목록에만 있다.
    lists: readCachedCharacterLists(credentials),
    sightings,
    trackedOcids: trackedOcids ?? [],
    profileOf: (ocid) => {
      const profile = readCharacterBasic(ocid)?.profile
      return profile === undefined ? null : { name: profile.name, level: profile.level ?? null }
    },
  }
}

export async function loadAccountLabels(accountIds: readonly string[]): Promise<Map<string, string>> {
  if (accountIds.length === 0) return new Map()
  return accountLabelsOf(accountIds, await loadSources())
}

export async function loadSheetAccounts(): Promise<SheetAccount[]> {
  return sheetAccountsOf(await loadSources())
}
