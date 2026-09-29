/**
 * 통계 화면의 읽기. 가계부의 날짜별 줄을 앱이 조회할 수 있는 가장 이른 날부터 오늘까지 한 번 읽는다.
 *
 * 카드마다 따로 읽지 않는다. 누적 카드가 처음부터 더하므로 그 범위가 나머지 카드의 범위를 다 덮는다.
 */
import { loadMonthDays } from '../cashbook/records'
import { getCharacterProfiles, type CharacterProfileSnapshot } from '../../storage/character-profiles'
import { historyFloorDateKey } from '../cashbook/range'
import type { DaysByDate } from './aggregate'

export async function loadStatsDays(todayDateKey: string): Promise<DaysByDate> {
  return loadMonthDays(historyFloorDateKey(todayDateKey), todayDateKey)
}

/** 단상에 세울 캐릭터 전신 그림. 프로필이 없는 캐릭터는 빠진다. */
export async function loadStatsImages(ocids: readonly string[]): Promise<Map<string, string>> {
  const profiles = await getCharacterProfiles(ocids).catch(() => new Map<string, CharacterProfileSnapshot>())
  return new Map([...profiles.values()].map((profile) => [profile.ocid, profile.imageUrl]))
}
