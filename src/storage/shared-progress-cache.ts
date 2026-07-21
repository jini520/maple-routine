import { Preferences } from '@capacitor/preferences'
import type { SharedProgressEntry } from '../types'
import { accountSharedProgressKey, worldSharedProgressKey } from './keys'

type SharedProgressMap = Record<string, SharedProgressEntry>

async function getSharedProgress(key: string): Promise<SharedProgressMap> {
  const { value } = await Preferences.get({ key })
  if (value === null) {
    return {}
  }

  try {
    return JSON.parse(value) as SharedProgressMap
  } catch {
    return {}
  }
}

async function setSharedProgressEntry(
  key: string,
  itemName: string,
  entry: SharedProgressEntry,
): Promise<void> {
  const current = await getSharedProgress(key)
  current[itemName] = entry
  await Preferences.set({ key, value: JSON.stringify(current) })
}

export async function getWorldSharedProgress(world: string): Promise<SharedProgressMap> {
  return getSharedProgress(worldSharedProgressKey(world))
}

export async function setWorldSharedProgressEntry(
  world: string,
  itemName: string,
  entry: SharedProgressEntry,
): Promise<void> {
  await setSharedProgressEntry(worldSharedProgressKey(world), itemName, entry)
}

export async function getAccountSharedProgress(accountId: string): Promise<SharedProgressMap> {
  return getSharedProgress(accountSharedProgressKey(accountId))
}

export async function setAccountSharedProgressEntry(
  accountId: string,
  itemName: string,
  entry: SharedProgressEntry,
): Promise<void> {
  await setSharedProgressEntry(accountSharedProgressKey(accountId), itemName, entry)
}
