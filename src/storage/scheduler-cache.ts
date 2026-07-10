import { Preferences } from '@capacitor/preferences'
import type { SchedulerCharacterState } from '../types'
import { schedulerCacheKey } from './keys'

export interface CachedSchedulerEntry {
  state: SchedulerCharacterState
  syncedAt: string // ISO 문자열 — 이 state가 성공적으로 동기화된 실제 시각(wire의 date 필드와는 다른, 우리 기기 기준 caching 시각)
}

export async function getCachedSchedulerState(
  ocid: string,
): Promise<CachedSchedulerEntry | null> {
  const { value } = await Preferences.get({ key: schedulerCacheKey(ocid) })
  if (value === null) {
    return null
  }

  try {
    return JSON.parse(value) as CachedSchedulerEntry
  } catch {
    return null
  }
}

export async function setCachedSchedulerState(
  ocid: string,
  entry: CachedSchedulerEntry,
): Promise<void> {
  await Preferences.set({ key: schedulerCacheKey(ocid), value: JSON.stringify(entry) })
}

export async function clearCachedSchedulerState(ocid: string): Promise<void> {
  await Preferences.remove({ key: schedulerCacheKey(ocid) })
}
