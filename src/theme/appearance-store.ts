/**
 * `ThemeAppearancePort` 가 쓰고 뷰가 읽는 **한 칸짜리 저장소**.
 *
 * ## 왜 이런 게 있나 — 값이 흐르는 방향이 웹뷰와 반대다
 *
 * 웹뷰에서 테마 적용은 side-effect 다: 포트가 `<style>` 을 갈아끼우면 끝이고 React 는 그 사실을
 * 모른다. RN 에서는 테마가 **렌더 트리의 일부**라(`vars()` 를 얹은 View) 누군가 리렌더를 일으켜야
 * 한다. 그래서 포트는 여기에 값을 놓고, `ThemeProvider` 가 `useSyncExternalStore` 로 그것을 구독한다.
 *
 * ## 왜 zustand 가 아닌가
 *
 * `features/theme/store.ts`(core)가 이미 "고른 테마"의 진실을 갖고 있다. 여기에 또 스토어를 두면
 * **진실이 둘**이 된다 — 이 칸이 담는 것은 상태가 아니라 *"포트가 방금 적용한 것"* 이고, 쓰는 주체가
 * 정확히 하나(포트)뿐이다. 액션도 셀렉터도 미들웨어도 필요 없어서 구독 가능한 값 한 칸으로 둔다.
 *
 * ## 초기값이 기본 테마인 이유
 *
 * 변수를 못 찾으면 NativeWind 는 그 스타일 속성을 **조용히 뺀다**(색이 없는 화면이 된다, 실측). 웹은
 * 그 자리를 `index.css` 의 `@theme` 기본 블록(= 머쉬맘)이 메워 첫 페인트가 항상 색을 갖는데, RN 에는
 * 번들 CSS 에 해당하는 것이 없다. 그래서 같은 역할을 초기값이 한다 — `restoreFromStorage()` 가 돌기
 * 전에도 화면은 기본 테마로 그려지고, 저장된 테마가 오면 갈아탄다(웹과 같은 순서).
 */

import { DEFAULT_THEME, getThemeDefinition } from '../lib/theme-registry'
import type { ThemeDefinition, ThemeName } from '../types/theme'

export interface ThemeAppearance {
  theme: ThemeName
  definition: ThemeDefinition
}

function defaultAppearance(): ThemeAppearance {
  return { theme: DEFAULT_THEME, definition: getThemeDefinition(DEFAULT_THEME) }
}

let current: ThemeAppearance = defaultAppearance()
const listeners = new Set<() => void>()

/**
 * `useSyncExternalStore` 의 `getSnapshot` 이 그대로 쓴다 — **바뀌지 않았으면 같은 객체**여야 한다
 * (매번 새 객체를 만들면 React 가 무한 리렌더로 읽는다).
 */
export function getThemeAppearance(): ThemeAppearance {
  return current
}

export function subscribeThemeAppearance(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 포트는 여기로만 쓴다.
 *
 * 같은 값이면 아무에게도 알리지 않는다 — `getThemeDefinition` 은 JSON 모듈을 그대로 돌려주므로 같은
 * 테마를 두 번 적용하면 참조까지 같고, 그때 리렌더를 돌릴 이유가 없다. 구독 해제가 콜백 안에서
 * 일어나도 안전하도록 복사한 목록을 순회한다.
 */
export function setThemeAppearance(theme: ThemeName, definition: ThemeDefinition): void {
  if (current.theme === theme && current.definition === definition) return

  current = { theme, definition }
  for (const listener of [...listeners]) listener()
}

/** 테스트 격리용 — 포트 슬롯의 `__reset*ForTest` 와 같은 자리. */
export function __resetThemeAppearanceForTest(): void {
  current = defaultAppearance()
  listeners.clear()
}
