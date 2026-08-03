/**
 * 테마 레지스트리 — 등록된 테마 목록과 CSS 커스텀 프로퍼티 생성 ([[ADR-064]] 결정 10).
 *
 * `storage/` 와 `features/` 가 함께 쓰므로 `lib/` 에 둔다(다른 JSON 접근자와 같은 자리).
 *
 * `src/data/job-themes.json` 이 단일 진실 공급원이다 — 테마 이름 목록·라이트/다크 판정·CSS 변수가
 * 모두 이 파일에서 나온다. 전에는 `index.css` 에 테마별 `:root[data-theme]` 블록을 손으로 적고
 * `ThemeName` 유니온·타입 가드·`THEME_OPTIONS` 2곳·`DARK_THEMES` Set 을 따로 동기화해야 했는데,
 * 하나라도 빠뜨리면 조용히 어긋났다. 이제 테마 추가는 **JSON 한 블록**이다.
 */

import jobThemesData from '../data/job-themes.json'
import type { JobThemes, ThemeBackground, ThemeDefinition, ThemeName } from '../types/theme'
import { deriveMediaScope } from './theme-derive'
import { getThemeBackgroundUrl } from './theme-backgrounds'

const JOB_THEMES = jobThemesData as JobThemes

/**
 * 등록된 테마 이름. **JSON 키 순서가 설정 화면 표시 순서**이고, 기본 테마가 맨 앞이다.
 */
export const THEME_NAMES = Object.keys(JOB_THEMES) as readonly ThemeName[]

/**
 * 앱 기본 테마와 기본 다크 테마.
 *
 * 색 데이터에서 유도할 수 없는 **프로덕트 결정**이라 이름으로 박아둔다. 대신 여기 한 곳에만 둬서
 * 스토어·`index.css` 기본값·테스트가 같은 값을 본다. 저장된 선택이 없을 때 OS 다크 모드 설정으로
 * 둘 중 하나를 고른다([[ADR-009]] 2026-07-14).
 */
export const DEFAULT_THEME: ThemeName = '머쉬맘'
export const DEFAULT_DARK_THEME: ThemeName = '혼테일'

export function isThemeName(value: string): value is ThemeName {
  return (THEME_NAMES as readonly string[]).includes(value)
}

export function getThemeDefinition(name: ThemeName): ThemeDefinition {
  return JOB_THEMES[name]
}

/** `mediaInkMuted` → `media-ink-muted`. Tailwind 유틸이 참조하는 이름 규칙이다. */
function toCustomPropertyName(token: string): string {
  return `--color-${token.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()}`
}

function declarations(entries: Readonly<Record<string, string>>, indent: string): string {
  return Object.entries(entries)
    .map(([token, value]) => `${indent}${toCustomPropertyName(token)}: ${value};`)
    .join('\n')
}

/**
 * 배경 이미지 프로퍼티 ([[ADR-088]] 결정 3).
 *
 * 배경이 없는 테마는 **한 줄도 내지 않는다** — CSS 쪽 기본값(`--theme-bg-image` 미선언 →
 * `none`)이 그대로 살아 다른 테마의 그림이 안 바뀐다. 슬러그에 해당하는 파일이 없을 때도
 * 마찬가지다(에셋만 사라지고 테마는 산다).
 */
function backgroundDeclarations(background: ThemeBackground | undefined): string[] {
  if (background === undefined) return []

  const url = getThemeBackgroundUrl(background.image)
  if (url === null) return []

  return [
    `  --theme-bg-image: url("${url}");`,
    `  --theme-bg-size: ${background.size};`,
    `  --theme-bg-position: ${background.position};`,
    `  --theme-bg-dim: ${background.dim};`,
    `  --theme-bg-fade-top: ${background.fadeTop};`,
  ]
}

/**
 * 한 테마의 `:root` + `.media-scope` 규칙을 만든다.
 *
 * `.media-scope` 안에서 표면·텍스트를 `media-*` 로 다시 묶고 accent 틴트·잉크도 **다시 선언**한다.
 * 커스텀 프로퍼티는 선언된 요소에서 `var()` 가 해석되므로, 다시 선언하지 않으면 `:root` 의
 * `surface` 기준 값이 그대로 내려온다 — [[ADR-021]] 에 미해결로 남아 있던 카드 안 배지
 * AA 미달(레테 3.88:1)이 정확히 그 문제였다([[ADR-064]] 결정 5).
 */
export function buildThemeCss(theme: ThemeDefinition): string {
  // mode 는 색이 아니라 의도라, background 는 색이 아니라 에셋이라 --color-* 로 내보내지 않는다.
  const { mode, background, ...tokens } = theme
  void mode
  const scope: Readonly<Record<string, string>> = deriveMediaScope(theme, theme.mode)

  return [
    ':root {',
    declarations(tokens, '  '),
    ...backgroundDeclarations(background),
    '}',
    '.media-scope {',
    declarations(scope, '  '),
    '}',
  ].join('\n')
}
