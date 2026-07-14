import { Preferences } from '@capacitor/preferences'
import type { ThemeName } from '../types'
import { STORAGE_KEYS } from './keys'

function isThemeName(value: string): value is ThemeName {
  return value === '레테' || value === '렌' || value === '머쉬맘' || value === '혼테일'
}

export async function getTheme(): Promise<ThemeName | null> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.theme })
  if (value === null || !isThemeName(value)) {
    return null
  }
  return value
}

export async function setTheme(theme: ThemeName): Promise<void> {
  await Preferences.set({ key: STORAGE_KEYS.theme, value: theme })
}
