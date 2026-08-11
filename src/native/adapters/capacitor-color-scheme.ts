import type { ColorSchemePort } from '@core/native/ports'

/**
 * OS 라이트/다크 설정 — 웹뷰 구현([[ADR-127]]).
 *
 * 이 앱의 "네이티브"는 웹뷰라 구현이 미디어 쿼리다(같은 이유로 `capacitor-splash-screen` 이 DOM
 * 커버를 갖는다). jsdom 은 `matchMedia` 를 기본 제공하지 않으므로 없으면 라이트로 폴백한다 —
 * 포트를 도입하기 전 `features/theme/store.ts` 가 하던 판단 그대로다.
 */
export const capacitorColorSchemePort: ColorSchemePort = {
  get: () => {
    if (typeof window.matchMedia !== 'function') {
      return 'light'
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  },
}
