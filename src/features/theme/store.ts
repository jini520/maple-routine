import { create } from 'zustand'
import { DEFAULT_DARK_THEME, DEFAULT_THEME, getThemeDefinition } from '../../lib/theme/theme-registry'
import type { ThemeName } from '../../types'
import { getTheme, setTheme } from '../../storage/theme'
import { getColorSchemePort, getThemeAppearancePort } from '../../native/ports'
import { setStatusBarStyle } from '../../native/status-bar'
import { setNavigationBarStyle } from '../../native/system-bars'

export interface ThemeStore {
  theme: ThemeName
  restoreFromStorage(): Promise<void>
  selectTheme(theme: ThemeName): Promise<void>
}

// 저장된 테마가 없을 때만 쓰는 1회성 판정. OS 다크모드 설정 변경을 앱 실행 중 실시간으로
// 반영하지는 않는다(범위 밖 2026-07-14 참고). "OS가 지금 무엇인가"는 플랫폼마다
// 묻는 법이 달라 포트가 답한다.
function resolveSystemTheme(): ThemeName {
  return getColorSchemePort().get() === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_THEME
}

/**
 * 고른 테마를 화면에 반영.
 *
 * 토큰을 칠하는 일은 `ThemeAppearancePort` 구현이 갖는다. 플랫폼마다 방법이 달라서다.
 * 상태바·내비바 명암은 여기 남는다. 다크 테마면 밝은 글리프라는 판단이 플랫폼과 무관해서다.
 */
function applyTheme(theme: ThemeName): void {
  const definition = getThemeDefinition(theme)
  getThemeAppearancePort().apply(theme, definition)

  const isDark = definition.mode === 'dark'
  void setStatusBarStyle(isDark)
  void setNavigationBarStyle(isDark)
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  theme: DEFAULT_THEME,

  async restoreFromStorage() {
    const stored = await getTheme()
    const theme = stored ?? resolveSystemTheme()
    applyTheme(theme)
    set({ theme })
  },

  async selectTheme(theme: ThemeName) {
    await setTheme(theme)
    applyTheme(theme)
    set({ theme })
  },
}))
