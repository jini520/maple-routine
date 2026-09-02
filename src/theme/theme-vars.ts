/**
 * 테마 38토큰을 **CSS 커스텀 프로퍼티 이름 → 값** 맵으로 낸다. NativeWind 의 `vars()` 가 그 맵을
 * 받아 렌더 트리에 내려보내고, `className`(`bg-primary`·`text-text-muted` …)이 `var(--color-*)` 로
 * 그것을 읽는다(3단계).
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

import { hexToOklch, parseHex, toHex, withLightness } from '../lib/color'
import { THEME_TOKEN_KEYS, deriveMediaScope } from '../lib/theme/theme-derive'
import type { ThemeDefinition } from '../types/theme'

/** `mediaInkMuted` → `--color-media-ink-muted`. core 의 `toCustomPropertyName` 과 같은 규칙이다. */
export function toColorVariableName(token: string): string {
  return `--color-${token.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()}`
}

/**
 * 스크림 위 패널의 테두리 — **RN 에는 선택자가 없어서 값으로 만든다.**
 *
 * 웹은 `:root[data-mode='light'] .panel-on-scrim { border-color: color-mix(...) }` 로 푼다. RN 에는
 * `data-mode` 도 `color-mix` 도 없으므로, 그 규칙이 계산하는 **결과를 토큰 하나로 미리 만들어** 둔다.
 * 그러면 호출부는 `border-panel-border` 라고만 쓰면 되고(3단계가 `className` 을 그대로
 * 옮기려는 이유), 모드 분기는 이 함수 안에서 **딱 한 번** 일어난다.
 *
 * 분기 기준은 반드시 `definition.mode` 다 — 테마 **이름**으로 가르면이 폐기한
 * `DARK_THEMES` 수동 목록이 되살아난다(테마를 수십 개로 늘릴 계획이라 특히 안 된다).
 *
 * 다크에서 테두리를 그대로 두는 것도 결정이다 — 그쪽은 패널과 배경 대비가 1.07~1.18 이라
 * **경계를 그리는 것이 테두리뿐이다.** 라이트에서만 `text` 쪽으로 눌러 합성된 배경색에 가라앉힌다.
 */
export const PANEL_BORDER_TOKEN = 'panel-border'

/** 라이트에서 `border` 를 `text` 쪽으로 미는 비중 — 가 실기기에서 세 번 만에 잡은 값. */
const PANEL_BORDER_RATIO = 0.4

/**
 * `color-mix(in srgb, base <ratio>%, other)` 와 같은 계산.
 *
 * core 의 `mixOklab` 을 쓰지 않는 이유는 가 **`in srgb`** 로 값을 잡았기 때문이다
 * (틴트 파생은 `in oklab` 이라 색 공간이 다르다). 색 공간을 바꾸면 그 ADR 이
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
 * 값의 형태 자체가 다르다 — 로 에셋이 들어온 뒤에도 그대로다(core 는 `url("…")` 을
 * 내지만 RN 에서 그 안의 값은 URL 문자열이 아니다). 그리는 것은 `ThemeBackdrop` 몫이고,
 * **그리는 곳은 그 하나뿐이다**.
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
 * 시트 스코프 — **미디어 스코프와 같은 기법, 다른 목적**이다.
 *
 * ## 무엇이 어긋났나
 *
 * `BottomSheet` 의 몸통이 `definition.bg` 였다 — **자기가 덮고 있는 페이지와 같은 토큰**이다.
 * 스크림을 합성한 배경과 견주면 다크에서 대비가 1.03~1.05 다(라이트는 같은 코드가 4.18~4.29).
 *
 * **스크림 쪽으로는 못 고친다.** 다크의 `bg` 는 이미 OKLCH L 0.13~0.15 라 그 아래 여유가 없어,
 * 백드롭을 **완전 불투명 검정**으로 만들어도 대비는 1.07 이 천장이다. 라이트가 멀쩡한 이유도
 * 같다 — 거기는 L 0.95 에서 0.55 까지 0.40 을 내려갈 수 있다. 그래서 고칠 곳은 시트이고,
 * 다크에서 떠 있음 은 어둡게가 아니라 **밝게**로 만든다.
 *
 * ## 넷을 **함께** 올린다
 *
 * 몸통만 올리면 시트 안 `bg-surface` 타일이 몸통과 **같은 색**이 되고(대비 1.00, 테두리만 남는다),
 * 몸통을 더 올리면 이번엔 타일이 몸통보다 **어두워진다**. 계열째 올려야 안쪽의 위아래 관계가
 * 그대로 남는다 — 그래서 **시트 안 코드는 한 줄도 안 고친다**(세 시트와 그 안의 폼들이 쓰는
 * `bg-bg`·`bg-surface`·`bg-surface-2` 가 전부 그대로 살아 새 기준을 따른다).
 *
 * ## 라이트는 안 건드린다
 *
 * 대비가 이미 멀쩡하고, 한 칸 더 올리면 `#FFFFFF` 에 부딪혀 눌린다. 분기 재료는 반드시
 * `definition.mode` 다 — 테마 **이름**으로 가르면이 폐기한 `DARK_THEMES` 수동
 * 목록이 되살아난다(`resolvePanelBorder` 가 바로 위에서 같은 모양으로 서 있다).
 *
 * 라이트에서도 **넷을 다 낸다** — 값이 같아 재선언이 무해하고, 호출부에 모드 분기가 안 생긴다.
 */
const SHEET_SCOPE_TOKENS = ['bg', 'surface', 'surface2', 'track'] as const

/**
 * 한 칸 — `deriveMediaScope` 가 카드 안 `surface → surface-2` 를 벌릴 때 쓰는 폭과 **같은 수**다.
 *
 * 새 눈금을 만들지 않는다. 이 앱에서 표면 한 단계 는 이미 이 값이고, 두 벌이 되면 어느 쪽이
 * 진짜인지 알 수 없게 된다(테스트가 두 값의 일치를 지킨다).
 */
export const SHEET_LIFT = 0.09

export function buildSheetScopeVariables(definition: ThemeDefinition): Record<string, string> {
  const lift = (hex: string): string =>
    definition.mode === 'dark' ? withLightness(hex, hexToOklch(hex).l + SHEET_LIFT) : hex

  return Object.fromEntries(
    SHEET_SCOPE_TOKENS.map((token) => [toColorVariableName(token), lift(definition[token])]),
  )
}

/**
 * `.media-scope` 에 해당하는 변수 맵.
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
