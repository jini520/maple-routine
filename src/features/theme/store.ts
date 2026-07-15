import { create } from 'zustand'
import type { ThemeName } from '../../types'
import { getTheme, setTheme } from '../../storage/theme'
import { setStatusBarStyle } from '../../native/status-bar'
import { setNavigationBarStyle } from '../../native/system-bars'

export interface ThemeStore {
  theme: ThemeName
  restoreFromStorage(): Promise<void>
  selectTheme(theme: ThemeName): Promise<void>
}

const DEFAULT_THEME: ThemeName = '머쉬맘'
const DEFAULT_DARK_THEME: ThemeName = '혼테일'
const DARK_THEMES: ReadonlySet<ThemeName> = new Set(['레테', '혼테일'])

// 저장된 테마가 없을 때만 쓰는 1회성 판정 — OS 다크모드 설정 변경을 앱 실행 중 실시간으로
// 반영하지는 않는다(범위 밖, ADR-009 2026-07-14 참고). jsdom 테스트 환경은 matchMedia를
// 기본 제공하지 않아 안전하게 라이트(DEFAULT_THEME)로 폴백한다.
function resolveSystemTheme(): ThemeName {
  if (typeof window.matchMedia !== 'function') {
    return DEFAULT_THEME
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DEFAULT_DARK_THEME : DEFAULT_THEME
}

function applyThemeToDocument(theme: ThemeName): void {
  if (theme === DEFAULT_THEME) {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = theme
  }
  const isDark = DARK_THEMES.has(theme)
  void setStatusBarStyle(isDark)
  void setNavigationBarStyle(isDark)
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  theme: DEFAULT_THEME,

  async restoreFromStorage() {
    const stored = await getTheme()
    const theme = stored ?? resolveSystemTheme()
    applyThemeToDocument(theme)
    set({ theme })
  },

  async selectTheme(theme: ThemeName) {
    await setTheme(theme)
    applyThemeToDocument(theme)
    set({ theme })
  },
}))
