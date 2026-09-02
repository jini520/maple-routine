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

// 저장된 테마가 없을 때만 쓰는 1회성 판정 — OS 다크모드 설정 변경을 앱 실행 중 실시간으로
// 반영하지는 않는다(범위 밖, ADR-009 2026-07-14 참고). "OS가 지금 무엇인가"는 플랫폼마다
// 묻는 법이 달라(웹뷰는 미디어 쿼리, RN 은 Appearance) 포트가 답한다.
function resolveSystemTheme(): ThemeName {
  return getColorSchemePort().get() === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_THEME
}

/**
 * 고른 테마를 화면에 반영한다.
 *
 * **토큰을 어떻게 칠하는가는 플랫폼마다 다르다**. 웹뷰는 34토큰을 `<style>` 하나로 주입하고
 * `data-theme`/`data-mode`·`color-scheme`·`scrollbar-color` 를 문서에 건다(
 * ). 그 DOM 작업은 `ThemeAppearancePort` 구현이 갖는다.
 *
 * 반면 **상태바·내비바 명암은 여기 남는다**: 이미 자기 포트가 있고, "다크 테마면 밝은 글리프"라는
 * 판단 자체는 플랫폼과 무관하다.
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
