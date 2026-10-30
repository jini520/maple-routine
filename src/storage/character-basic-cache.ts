/**
 * 1.0.12 까지의 `character/basic` 캐시(Preferences `characterBasicCache:{ocid}`). 이제 읽고 지우기만 한다.
 *
 * 기본 정보는 쿼리 캐시(`query_cache` 표)가 든다. 이 키는 업데이트 뒤 첫 실행이 쿼리 캐시로 옮긴 뒤 지운다
 * (`features/schedule-sync/schedule-query.ts` 의 `seedScheduleQueriesFromLegacyCache`). 계정별 인덱스 키도 그때 함께 지운다.
 */
import { worldKeyOfApiName } from '../lib/world/worlds'
import { preferences } from './ports'
import type { CharacterBasicProfile } from '../types'
import {
  characterBasicCacheIndexKey,
  characterBasicCacheKey,
  LEGACY_CHARACTER_BASIC_CACHE_INDEX_KEY,
} from './keys'

/** 캐릭터 하나의 기본 정보와 받은 시각. 쿼리 캐시 `characterBasic(ocid)` 의 데이터 모양이기도 하다. */
export interface CachedCharacterBasicEntry {
  profile: CharacterBasicProfile
  cachedAt: string
}

export async function getCachedCharacterBasic(ocid: string): Promise<CachedCharacterBasicEntry | null> {
  const value = await preferences.get(characterBasicCacheKey(ocid))
  if (value === null) {
    return null
  }

  try {
    const entry = JSON.parse(value) as CachedCharacterBasicEntry
    // 월드 key 가 생기기 전 캐시는 읽을 때 이름으로 채운다.
    const { profile } = entry
    if (profile.worldKey === undefined && profile.world !== undefined) {
      return { ...entry, profile: { ...profile, worldKey: worldKeyOfApiName(profile.world) } }
    }
    return entry
  } catch {
    return null
  }
}

export async function clearCachedCharacterBasic(ocid: string): Promise<void> {
  await preferences.remove(characterBasicCacheKey(ocid))
}

/** 계정별 인덱스와 그 전의 전역 인덱스. 캐릭터 관리의 첫 목록이 읽던 것인데 이제 쿼리 캐시에서 센다. */
export async function clearCharacterBasicCacheIndex(accountIds: readonly string[]): Promise<void> {
  await Promise.all([
    preferences.remove(LEGACY_CHARACTER_BASIC_CACHE_INDEX_KEY),
    ...accountIds.map((accountId) => preferences.remove(characterBasicCacheIndexKey(accountId))),
  ])
}
