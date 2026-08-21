/**
 * 테마 38토큰을 **CSS 커스텀 프로퍼티 이름 → 값** 맵으로 낸다. NativeWind 의 `vars()` 가 그 맵을
 * 받아 렌더 트리에 내려보내고, `className`(`bg-primary`·`text-text-muted` …)이 `var(--color-*)` 로
 * 그것을 읽는다([[ADR-128]] 3단계).
 *
 * ## 왜 CSS 문자열을 만들지 않는가
 *
 * 웹뷰 구현은 `buildThemeCss(definition)` 로 `<style>` 하나를 만들어 문서에 붙인다. RN 에는 CSS 도
 * DOM 도 없지만, **애초에 문자열이 될 필요가 없다** — `ThemeDefinition extends ThemeTokens` 라
 * 문자열로 굳기 전의 값이 이미 객체로 있다. 그래서 이 파일은 `buildThemeCss` 를 부르지 않고 같은
 * 값을 같은 이름에 실어 넘긴다(`buildThemeCss` 는 웹이 계속 쓴다).
 *
 * **이름 규칙은 core 와 한 글자도 달라선 안 된다** — `tailwind.config.js` 가 만든 유틸리티가
 * `var(--color-surface-2)` 를 참조하는데 여기서 `--color-surface2` 를 내면 색이 **조용히 사라진다**
 * (변수를 못 찾으면 그 스타일 속성 자체가 빠진다, 실측). core 의 변환 함수는 export 되지 않아
 * 규칙을 여기 한 번 더 적었고, 그래서 `__tests__/theme-vars.test.ts` 가 이 파일의 출력과
 * `buildThemeCss` 의 출력을 **직접 대조**해 두 벌이 갈라지는 것을 막는다.
 */

import { parseHex, toHex } from '../lib/color'
import { THEME_TOKEN_KEYS, deriveMediaScope } from '../lib/theme-derive'
import type { ThemeDefinition } from '../types/theme'

/** `mediaInkMuted` → `--color-media-ink-muted`. core 의 `toCustomPropertyName` 과 같은 규칙이다. */
export function toColorVariableName(token: string): string {
  return `--color-${token.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()}`
}

/**
 * 스크림 위 패널의 테두리 ([[ADR-122]]) — **RN 에는 선택자가 없어서 값으로 만든다.**
 *
 * 웹은 `:root[data-mode='light'] .panel-on-scrim { border-color: color-mix(...) }` 로 푼다. RN 에는
 * `data-mode` 도 `color-mix` 도 없으므로, 그 규칙이 계산하는 **결과를 토큰 하나로 미리 만들어** 둔다.
 * 그러면 호출부는 `border-panel-border` 라고만 쓰면 되고([[ADR-128]] 3단계가 `className` 을 그대로
 * 옮기려는 이유), 모드 분기는 이 함수 안에서 **딱 한 번** 일어난다.
 *
 * 분기 기준은 반드시 `definition.mode` 다 — 테마 **이름**으로 가르면 [[ADR-064]] 결정 8이 폐기한
 * `DARK_THEMES` 수동 목록이 되살아난다(테마를 수십 개로 늘릴 계획이라 특히 안 된다).
 *
 * 다크에서 테두리를 그대로 두는 것도 결정이다 — 그쪽은 패널과 배경 대비가 1.07~1.18 이라
 * **테두리가 유일한 경계**다. 라이트에서만 `text` 쪽으로 눌러 합성된 배경색에 가라앉힌다.
 */
export const PANEL_BORDER_TOKEN = 'panel-border'

/** 라이트에서 `border` 를 `text` 쪽으로 미는 비중 — [[ADR-122]] 가 실기기에서 세 번 만에 잡은 값. */
const PANEL_BORDER_RATIO = 0.4

/**
 * `color-mix(in srgb, base <ratio>%, other)` 와 같은 계산.
 *
 * core 의 `mixOklab` 을 쓰지 않는 이유는 [[ADR-122]] 가 **`in srgb`** 로 값을 잡았기 때문이다
 * (틴트 파생([[ADR-064]] 결정 2)은 `in oklab` 이라 색 공간이 다르다). 색 공간을 바꾸면 그 ADR 이
 * 실기기에서 확정한 세 값이 전부 달라진다.
 */
function mixSrgb(base: string, other: string, ratio: number): string {
  const a = parseHex(base)
  const b = parseHex(other)
  const channel = (x: number, y: number): number => x * ratio + y * (1 - ratio)

  return toHex({
    r: channel(a.r, b.r),
    g: channel(a.g, b.g),
    b: channel(a.b, b.b),
  })
}

export function resolvePanelBorder(definition: ThemeDefinition): string {
  return definition.mode === 'light'
    ? mixSrgb(definition.border, definition.text, PANEL_BORDER_RATIO)
    : definition.border
}

/**
 * `:root` 에 해당하는 변수 맵 — 38토큰 + 모드에서 파생되는 `--color-panel-border`.
 *
 * 배경 이미지(`--theme-bg-*`)는 내지 않는다. RN 은 벽지를 CSS 배경이 아니라 `<Image>` 로 그리므로
 * 값의 형태 자체가 다르다 — [[ADR-129]] 로 에셋이 들어온 뒤에도 그대로다(core 는 `url("…")` 을
 * 내지만 RN 에서 그 안의 값은 URL 문자열이 아니다). 그리는 것은 `ThemeBackdrop` 몫이고,
 * **그리는 곳은 그 하나뿐이다**([[ADR-133]]).
 */
export function buildThemeVariables(definition: ThemeDefinition): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const token of THEME_TOKEN_KEYS) {
    variables[toColorVariableName(token)] = definition[token]
  }
  variables[toColorVariableName(PANEL_BORDER_TOKEN)] = resolvePanelBorder(definition)
  return variables
}

/**
 * `.media-scope` 에 해당하는 변수 맵 ([[ADR-064]] 결정 5).
 *
 * 일러스트 카드 안은 바탕이 `surface` 가 아니라 `mediaSurface` 라 표면·텍스트·완료 배지를 **다시
 * 선언**해야 한다. 웹에서 그것이 필요한 이유("커스텀 프로퍼티는 선언된 요소에서 `var()` 가
 * 해석된다")가 RN 에서도 **그대로 성립한다** — `vars()` 는 렌더 트리를 따라 상속되고 하위에서 같은
 * 이름을 다시 선언하면 그 서브트리만 새 기준을 쓴다(실측 2026-08-11).
 */
export function buildMediaScopeVariables(definition: ThemeDefinition): Record<string, string> {
  const scope = deriveMediaScope(definition, definition.mode)
  return Object.fromEntries(
    Object.entries(scope).map(([token, value]) => [toColorVariableName(token), value]),
  )
}
