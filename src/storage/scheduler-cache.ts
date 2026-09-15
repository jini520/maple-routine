import { preferences } from './ports'
import type { SchedulerCharacterState } from '../types'
import { schedulerCacheKey } from './keys'

/**
 * 캐시 값의 모양 번호. 번호가 다른 값은 없는 것으로 본다.
 *
 * 2 는 보스 항목이 보스 key 와 난이도 key 를 든 모양이다. 옛 캐시는 옮기지 않고 버린다. 다음 동기화가 다시
 * 받아 덮어쓰는 값이라서다.
 */
const CACHE_VERSION = 2

export interface CachedSchedulerEntry {
  state: SchedulerCharacterState
  syncedAt: string // ISO 문자열. 이 state가 성공적으로 동기화된 실제 시각(wire의 date 필드와는 다른, 우리 기기 기준 caching 시각)
}

export async function getCachedSchedulerState(
  ocid: string,
): Promise<CachedSchedulerEntry | null> {
  const value = await preferences.get(schedulerCacheKey(ocid))
  if (value === null) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as CachedSchedulerEntry & { version?: number }
    if (parsed.version !== CACHE_VERSION) return null
    return { state: parsed.state, syncedAt: parsed.syncedAt }
  } catch {
    return null
  }
}

export async function setCachedSchedulerState(
  ocid: string,
  entry: CachedSchedulerEntry,
): Promise<void> {
  await preferences.set(schedulerCacheKey(ocid), JSON.stringify({ ...entry, version: CACHE_VERSION }))
}

export async function clearCachedSchedulerState(ocid: string): Promise<void> {
  await preferences.remove(schedulerCacheKey(ocid))
}
