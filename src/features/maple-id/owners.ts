/**
 * 캐릭터마다의 메이플 ID 와 메이플 ID 의 차례. today 공유 컨텐츠 · 결정석 위젯과 보스 수익 결정석 칸이 같은 값을 쓴다.
 *
 * 소속은 기기 표 `character_accounts` 에서 읽고 넥슨을 부르지 않는다. 차례는 넥슨 계정 차례(넥슨 ID 계정, 그다음 API 키를
 * 등록한 차례)이고, 한 계정 안에서는 추적 목록에 먼저 선 차례다.
 */
import { accountOfOcid, type CharacterAccountSighting } from '../../lib/mvp/membership'
import { getCharacterAccountSightings, getNexonAccountIdsOfOcids } from '../../storage/character-accounts'
import { currentCredentials } from '../auth/current-credential'

export interface MapleIdOwners {
  /** ocid → 메이플 ID. 소속을 모르는 캐릭터는 빠진다 */
  ofOcid: Readonly<Record<string, string>>
  /** 메이플 ID 의 차례 */
  order: readonly string[]
}

export interface MapleIdOwnersSources {
  sightings: readonly CharacterAccountSighting[]
  /** ocid → 넥슨 계정 id */
  nexonAccountOfOcid: ReadonlyMap<string, string>
  /** 지금 쓸 수 있는 넥슨 계정 id 의 차례(`usableCredentialsOf`) */
  credentialAccountIds: readonly (string | null)[]
  trackedOcids: readonly string[]
}

/** 모르는 차례(무한대)끼리는 같다고 본다. 빼면 NaN 이 되어 차례가 흔들린다. */
function compareRank(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1
}

export function mapleIdOwnersOf(sources: MapleIdOwnersSources): MapleIdOwners {
  const ofOcid: Record<string, string> = {}
  for (const ocid of new Set(sources.sightings.map((one) => one.ocid))) {
    const mapleId = accountOfOcid(sources.sightings, ocid)
    if (mapleId !== null) ofOcid[ocid] = mapleId
  }

  // 메이플 ID 마다 가장 앞선 넥슨 계정 차례와 추적 목록 차례. 모르면 맨 뒤다.
  const rank = new Map<string, { account: number; tracked: number }>()
  const trackedIndex = new Map(sources.trackedOcids.map((ocid, index) => [ocid, index]))
  for (const [ocid, mapleId] of Object.entries(ofOcid)) {
    const nexonAccountId = sources.nexonAccountOfOcid.get(ocid)
    const accountIndex = nexonAccountId === undefined ? -1 : sources.credentialAccountIds.indexOf(nexonAccountId)
    const account = accountIndex === -1 ? Number.POSITIVE_INFINITY : accountIndex
    const tracked = trackedIndex.get(ocid) ?? Number.POSITIVE_INFINITY
    const known = rank.get(mapleId)
    rank.set(mapleId, {
      account: Math.min(known?.account ?? Number.POSITIVE_INFINITY, account),
      tracked: Math.min(known?.tracked ?? Number.POSITIVE_INFINITY, tracked),
    })
  }
  const order = [...rank.entries()]
    .sort(([, left], [, right]) => compareRank(left.account, right.account) || compareRank(left.tracked, right.tracked))
    .map(([mapleId]) => mapleId)

  return { ofOcid, order }
}

export async function loadMapleIdOwners(trackedOcids: readonly string[]): Promise<MapleIdOwners> {
  const sightings = await getCharacterAccountSightings()
  const [nexonAccountOfOcid, credentials] = await Promise.all([
    getNexonAccountIdsOfOcids([...new Set(sightings.map((one) => one.ocid))]),
    currentCredentials(),
  ])
  return mapleIdOwnersOf({
    sightings,
    nexonAccountOfOcid,
    credentialAccountIds: credentials.map((one) => one.accountId),
    trackedOcids,
  })
}
