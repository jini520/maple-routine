import { create } from 'zustand'
import type { ThemeName } from '../../types'
import { getTheme, setTheme } from '../../storage/theme'

export interface ThemeStore {
  theme: ThemeName
  restoreFromStorage(): Promise<void>
  selectTheme(theme: ThemeName): Promise<void>
}

function applyThemeToDocument(theme: ThemeName): void {
  if (theme === '레테') {
    document.documentElement.dataset.theme = '레테'
  } else {
    delete document.documentElement.dataset.theme
  }
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  theme: '렌',

  async restoreFromStorage() {
    const stored = await getTheme()
    const theme = stored ?? '렌'
    applyThemeToDocument(theme)
    set({ theme })
  },

  async selectTheme(theme: ThemeName) {
    await setTheme(theme)
    applyThemeToDocument(theme)
    set({ theme })
  },
}))
