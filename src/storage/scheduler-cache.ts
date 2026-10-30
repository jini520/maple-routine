/**
 * 1.0.12 까지의 스케줄 캐시(Preferences `schedulerCache:{ocid}`). 이제 읽고 지우기만 한다.
 *
 * 스케줄은 쿼리 캐시(`query_cache` 표)가 든다. 이 키는 업데이트 뒤 첫 실행이 쿼리 캐시로 옮긴 뒤 지운다
 * (`features/schedule-sync/schedule-query.ts` 의 `seedScheduleQueriesFromLegacyCache`). 버리기만 하면 업데이트 직후
 * 오프라인이거나 넥슨 점검일 때 화면이 빈다.
 */
import { preferences } from './ports'
import type { SchedulerCharacterState } from '../types'
import { schedulerCacheKey } from './keys'

const CACHE_VERSION = 4

/** 캐릭터 하나의 스케줄과 받은 시각. 쿼리 캐시 `schedule(ocid)` 의 데이터 모양이기도 하다. */
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

export async function clearCachedSchedulerState(ocid: string): Promise<void> {
  await preferences.remove(schedulerCacheKey(ocid))
}
