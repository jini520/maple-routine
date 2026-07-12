import { Preferences } from '@capacitor/preferences'
import { trackedCharactersKey } from './keys'

export type SchedulerKind = 'content' | 'boss'

function parseOcids(value: string | null): string[] | null {
  if (value === null) {
    return null
  }

  try {
    return JSON.parse(value) as string[]
  } catch {
    return null
  }
}

function dedupeByOcid(ocids: string[]): string[] {
  return Array.from(new Set(ocids))
}

async function migrateLegacyTrackedCharacters(): Promise<void> {
  const contentRaw = await Preferences.get({ key: 'trackedCharacters:content' })
  if (contentRaw.value !== null) {
    return
  }

  const legacyDailyRaw = await Preferences.get({ key: 'trackedCharacters:daily' })
  const legacyWeeklyRaw = await Preferences.get({ key: 'trackedCharacters:weekly' })
  const legacyDaily = parseOcids(legacyDailyRaw.value)
  const legacyWeekly = parseOcids(legacyWeeklyRaw.value)

  if (legacyDaily === null && legacyWeekly === null) {
    return
  }

  const content = dedupeByOcid([...(legacyDaily ?? []), ...(legacyWeekly ?? [])])
  await Preferences.set({ key: 'trackedCharacters:content', value: JSON.stringify(content) })

  if (legacyWeekly !== null) {
    await Preferences.set({ key: 'trackedCharacters:boss', value: JSON.stringify(legacyWeekly) })
  }

  await Preferences.remove({ key: 'trackedCharacters:daily' })
  await Preferences.remove({ key: 'trackedCharacters:weekly' })
}

export async function getTrackedCharacterOcids(kind: SchedulerKind): Promise<string[] | null> {
  await migrateLegacyTrackedCharacters()

  const { value } = await Preferences.get({ key: trackedCharactersKey(kind) })
  return parseOcids(value)
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
