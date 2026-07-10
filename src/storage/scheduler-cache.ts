import { Preferences } from '@capacitor/preferences'
import type { SchedulerCharacterState } from '../types'
import { schedulerCacheKey } from './keys'

export async function getCachedSchedulerState(
  ocid: string,
): Promise<SchedulerCharacterState | null> {
  const { value } = await Preferences.get({ key: schedulerCacheKey(ocid) })
  if (value === null) {
    return null
  }

  try {
    return JSON.parse(value) as SchedulerCharacterState
  } catch {
    return null
  }
}

export async function setCachedSchedulerState(
  ocid: string,
  state: SchedulerCharacterState,
): Promise<void> {
  await Preferences.set({ key: schedulerCacheKey(ocid), value: JSON.stringify(state) })
}

export async function clearCachedSchedulerState(ocid: string): Promise<void> {
  await Preferences.remove({ key: schedulerCacheKey(ocid) })
}
