import { Preferences } from '@capacitor/preferences'
import { trackedCharactersKey } from './keys'

export type SchedulerKind = 'daily' | 'weekly'

export async function getTrackedCharacterOcids(kind: SchedulerKind): Promise<string[] | null> {
  const { value } = await Preferences.get({ key: trackedCharactersKey(kind) })
  if (value === null) {
    return null
  }

  try {
    return JSON.parse(value) as string[]
  } catch {
    return null
  }
}

export async function setTrackedCharacterOcids(
  kind: SchedulerKind,
  ocids: string[],
): Promise<void> {
  await Preferences.set({ key: trackedCharactersKey(kind), value: JSON.stringify(ocids) })
}

export async function clearTrackedCharacterOcids(kind: SchedulerKind): Promise<void> {
  await Preferences.remove({ key: trackedCharactersKey(kind) })
}
