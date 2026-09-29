/**
 * 통계 화면의 읽기. 가계부의 날짜별 줄을 앱이 조회할 수 있는 가장 이른 날부터 오늘까지 한 번 읽는다.
 *
 * 카드마다 따로 읽지 않는다. 누적 카드가 처음부터 더하므로 그 범위가 나머지 카드의 범위를 다 덮는다.
 */
import { cashbookDataRevision, loadMonthDays } from '../cashbook/records'
import { getEnhancementHistoryRevision } from '../../storage/enhancement-history'
import { getSpendRecordsRevision } from '../../storage/spend'
import { getStatsCumulativeStart, setStatsCumulativeStart } from '../../storage/stats-cumulative-start'
import {
  getCharacterProfiles,
  getCharacterProfilesByNames,
  type CharacterProfileSnapshot,
} from '../../storage/character-profiles'
import { historyFloorDateKey } from '../cashbook/range'
import type { DaysByDate } from './aggregate'

export async function loadStatsDays(todayDateKey: string): Promise<DaysByDate> {
  return loadMonthDays(historyFloorDateKey(todayDateKey), todayDateKey)
}

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

/**
 * 통계가 읽는 표들의 판. 가계부의 판(보스 · 드롭 · 수입)에 강화 내역과 지출 기록의 판을 더한다.
 * 모두 단조 증가라 어느 쪽이 올라도 합이 달라진다. 같으면 다시 읽을 까닭이 없다.
 */
export function statsDataRevision(): number {
  return cashbookDataRevision() + getEnhancementHistoryRevision() + getSpendRecordsRevision()
}

/** 누적 순수익의 시작 날짜. 고른 적이 없으면 `null`(기록이 처음 있는 날부터) */
export async function loadCumulativeStart(): Promise<string | null> {
  return getStatsCumulativeStart().catch(() => null)
}

/** `null` 이면 처음부터 더한다 */
export async function saveCumulativeStart(dateKey: string | null): Promise<void> {
  await setStatsCumulativeStart(dateKey).catch(() => undefined)
}
