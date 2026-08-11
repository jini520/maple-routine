import { Preferences } from '@capacitor/preferences'
import { isThemeName } from '../lib/theme-registry'
import type { ThemeName } from '@core/types'
import { STORAGE_KEYS } from './keys'

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
