/**
 * `ThemeAppearancePort` 가 쓰고 뷰가 읽는 한 칸짜리 저장소.
 *
 * 테마가 렌더 트리의 일부라(`vars()` 를 얹은 View) 값이 바뀌면 누군가 리렌더를 일으켜야 한다.
 * 포트가 여기에 값을 놓고 `ThemeProvider` 가 `useSyncExternalStore` 로 구독한다.
 *
 * zustand 가 아닌 것은 `features/theme/store.ts` 가 이미 고른 테마의 진실을 갖기 때문이다. 여기에
 * 또 스토어를 두면 진실이 둘이 된다. 이 칸이 담는 것은 상태가 아니라 포트가 방금 적용한 것이고
 * 쓰는 주체가 정확히 하나다.
 *
 * 초기값이 기본 테마인 것은, 변수를 못 찾으면 NativeWind 가 그 스타일 속성을 **조용히 빼서**
 * 색이 없는 화면이 되기 때문이다.
 */

import { DEFAULT_THEME, getThemeDefinition } from '../lib/theme/theme-registry'
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
 * `useSyncExternalStore` 의 `getSnapshot` 이 그대로 쓰는 값. 바뀌지 않았으면 같은 객체여야 한다
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
 * 포트가 거치는 유일한 쓰기.
 *
 * 같은 값이면 아무에게도 알리지 않는다. `getThemeDefinition` 은 JSON 모듈을 그대로 돌려주므로 같은
 * 테마를 두 번 적용하면 참조까지 같고, 그때 리렌더를 돌릴 이유가 없다. 구독 해제가 콜백 안에서
 * 일어나도 안전하도록 복사한 목록을 순회한다.
 */
export function setThemeAppearance(theme: ThemeName, definition: ThemeDefinition): void {
  if (current.theme === theme && current.definition === definition) return

  current = { theme, definition }
  for (const listener of [...listeners]) listener()
}

/** 테스트 격리용. 포트 슬롯의 `__reset*ForTest` 와 같은 자리. */
export function __resetThemeAppearanceForTest(): void {
  current = defaultAppearance()
  listeners.clear()
}
