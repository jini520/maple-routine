import { create } from 'zustand'
import {
  DEFAULT_DARK_THEME,
  DEFAULT_THEME,
  buildThemeCss,
  getThemeDefinition,
} from '../../lib/theme-registry'
import type { ThemeName } from '../../types'
import { getTheme, setTheme } from '../../storage/theme'
import { setStatusBarStyle } from '../../native/status-bar'
import { setNavigationBarStyle } from '../../native/system-bars'

export interface ThemeStore {
  theme: ThemeName
  restoreFromStorage(): Promise<void>
  selectTheme(theme: ThemeName): Promise<void>
}

/** 주입한 테마 변수 스타일 태그의 id — 전환할 때 이 하나만 갈아끼운다. */
const THEME_STYLE_ID = 'theme-vars'

// 저장된 테마가 없을 때만 쓰는 1회성 판정 — OS 다크모드 설정 변경을 앱 실행 중 실시간으로
// 반영하지는 않는다(범위 밖, ADR-009 2026-07-14 참고). jsdom 테스트 환경은 matchMedia를
// 기본 제공하지 않아 안전하게 라이트(DEFAULT_THEME)로 폴백한다.
function resolveSystemTheme(): ThemeName {
  if (typeof window.matchMedia !== 'function') {
    return DEFAULT_THEME
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DEFAULT_DARK_THEME : DEFAULT_THEME
}

/**
 * 선택한 테마의 34토큰을 `<style>` 태그 하나로 주입한다([[ADR-064]] 결정 10).
 *
 * 전에는 `index.css` 에 테마별 `:root[data-theme]` 블록을 손으로 적었는데, 테마를 수십 개로
 * 늘릴 계획이라 그 방식으로는 감당이 안 된다. 이제 `job-themes.json` 을 읽어 규칙을 만들어
 * 붙인다 — 번들 CSS 뒤에 오므로 `@theme` 기본값(머쉬맘)을 덮는다. 일러스트 카드용
 * `.media-scope` 규칙도 같은 태그에 함께 들어간다.
 *
 * 라이트/다크는 테마 데이터의 `mode` 가 정한다(옛 `DARK_THEMES` Set 수동 관리 폐기, 결정 8).
 * `data-theme` 속성은 이제 스타일에 쓰이지 않지만, 지금 어떤 테마인지 눈으로 확인할 수 있게
 * 계속 붙여둔다.
 */
function applyThemeToDocument(theme: ThemeName): void {
  const definition = getThemeDefinition(theme)

  let style = document.getElementById(THEME_STYLE_ID)
  if (style === null) {
    style = document.createElement('style')
    style.id = THEME_STYLE_ID
    document.head.append(style)
  }
  style.textContent = buildThemeCss(definition)

  document.documentElement.dataset.theme = theme

  const isDark = definition.mode === 'dark'
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
