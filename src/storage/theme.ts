import { preferences } from './ports'
import { isThemeName } from '../lib/theme/theme-registry'
import type { ThemeName } from '../types'
import { STORAGE_KEYS } from './keys'

export async function getTheme(): Promise<ThemeName | null> {
  const value = await preferences.get(STORAGE_KEYS.theme)
  if (value === null || !isThemeName(value)) {
    return null
  }
  return value
}

export async function setTheme(theme: ThemeName): Promise<void> {
  await preferences.set(STORAGE_KEYS.theme, theme)
}
