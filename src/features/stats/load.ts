/**
 * 통계 화면이 읽는 것 중 날짜별 줄이 아닌 것. 캐릭터 전신 그림과 누적 순수익의 시작 날짜다.
 *
 * 날짜별 줄은 화면이 `features/cashbook/ledger-query` 의 `useLedgerDays` 로 든다. 기록 표의 판이 오르면 그 쿼리가
 * 무효화되므로 여기서 판을 견주지 않는다.
 */
import { getStatsCumulativeStart, setStatsCumulativeStart } from '../../storage/stats-cumulative-start'
import {
  getCharacterProfiles,
  getCharacterProfilesByNames,
  type CharacterProfileSnapshot,
} from '../../storage/character-profiles'

/**
 * 단상에 세울 캐릭터 전신 그림. 줄의 키 → 그림 주소이고, 못 찾은 줄은 빠진다.
 *
 * ocid 가 있는 줄은 ocid 로 찾는다. 이름만 있는 줄(개명 전 이름, 날짜를 몰라 보스 기록이 빠진 과거 주의
 * 강화 줄)은 프로필을 이름으로 찾고, 같은 이름이 여럿이면 가장 최근에 본 캐릭터를 쓴다.
 */
export async function loadStatsImages(
  rows: readonly { key: string; ocid: string | null; name: string }[],
): Promise<Map<string, string>> {
  const ocids = rows.flatMap((row) => (row.ocid === null ? [] : [row.ocid]))
  const names = rows.flatMap((row) => (row.ocid === null && row.name !== '' ? [row.name] : []))
  const [byOcid, byName] = await Promise.all([
    getCharacterProfiles(ocids).catch(() => new Map<string, CharacterProfileSnapshot>()),
    getCharacterProfilesByNames(names).catch(() => [] as CharacterProfileSnapshot[]),
  ])
  const latestByName = new Map<string, CharacterProfileSnapshot>()
  for (const profile of byName) {
    const seen = latestByName.get(profile.name)
    if (seen === undefined || profile.updatedAt > seen.updatedAt) latestByName.set(profile.name, profile)
  }
  const images = new Map<string, string>()
  for (const row of rows) {
    const profile = row.ocid === null ? latestByName.get(row.name) : byOcid.get(row.ocid)
    if (profile !== undefined) images.set(row.key, profile.imageUrl)
  }
  return images
}

/** 누적 순수익의 시작 날짜. 고른 적이 없으면 `null`(기록이 처음 있는 날부터) */
export async function loadCumulativeStart(): Promise<string | null> {
  return getStatsCumulativeStart().catch(() => null)
}

export async function saveCumulativeStart(dateKey: string): Promise<void> {
  await setStatsCumulativeStart(dateKey).catch(() => undefined)
}
