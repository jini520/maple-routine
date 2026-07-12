import { Preferences } from '@capacitor/preferences'
import type { CharacterBasicProfile } from '../types'
import { characterBasicCacheKey } from './keys'

export interface CachedCharacterBasicEntry {
  profile: CharacterBasicProfile
  cachedAt: string
}

export async function getCachedCharacterBasic(ocid: string): Promise<CachedCharacterBasicEntry | null> {
  const { value } = await Preferences.get({ key: characterBasicCacheKey(ocid) })
  if (value === null) {
    return null
  }

  try {
    return JSON.parse(value) as CachedCharacterBasicEntry
  } catch {
    return null
  }
}

export async function setCachedCharacterBasic(
  ocid: string,
  entry: CachedCharacterBasicEntry,
): Promise<void> {
  await Preferences.set({ key: characterBasicCacheKey(ocid), value: JSON.stringify(entry) })
}

export async function clearCachedCharacterBasic(ocid: string): Promise<void> {
  await Preferences.remove({ key: characterBasicCacheKey(ocid) })
}
