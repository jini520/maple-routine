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
import type {
  JobThemes,
  ThemeBackground,
  ThemeCategory,
  ThemeDefinition,
  ThemeName,
} from '../types/theme'
import { deriveMediaScope } from './theme-derive'
import { getThemeBackgroundUrl } from './theme-backgrounds'

const JOB_THEMES = jobThemesData as JobThemes

/**
 * 카테고리 **표시 순서** ([[ADR-104]] 결정 6).
 *
 * 색 데이터에서 유도할 수 없는 프로덕트 결정이라 `DEFAULT_THEME` 과 같은 자리에 둔다. JSON 에
 * 순서 번호를 넣지 않는 이유는 테마를 추가할 때마다 번호를 다시 매기게 되기 때문이다.
 */
export const THEME_CATEGORIES: readonly ThemeCategory[] = ['기본', '직업', '보스']

/**
 * 등록된 테마 이름. **표시 순서는 카테고리 순서 → 그 안에서 JSON 키 순서**다([[ADR-104]] 결정 6,
 * 예전 규약은 "JSON 키 순서 = 표시 순서"였다). 정렬이 안정적이라 같은 카테고리 안에서는 JSON 에
 * 적은 순서가 그대로 남는다 — 새 테마는 자기 카테고리 블록 끝에 붙는다.
 */
export const THEME_NAMES = (Object.keys(JOB_THEMES) as ThemeName[])
  .slice()
  .sort(
    (a, b) =>
      THEME_CATEGORIES.indexOf(JOB_THEMES[a].category) -
      THEME_CATEGORIES.indexOf(JOB_THEMES[b].category),
  ) as readonly ThemeName[]

/** 선택 목록의 섹션 하나. */
export interface ThemeCategoryGroup {
  category: ThemeCategory
  themes: readonly ThemeName[]
}

/**
 * 테마 목록을 카테고리 섹션으로 묶는다 ([[ADR-104]] 결정 3).
 *
 * **항목이 없는 카테고리는 그룹째 내지 않는다** — 라이트/다크 필터가 걸러낸 뒤 헤더만 남는 것을
 * 막는 책임이 여기 있다. 호출부는 거르고 이 함수에 넘기기만 하면 된다.
 */
export function groupThemesByCategory(names: readonly ThemeName[]): readonly ThemeCategoryGroup[] {
  return THEME_CATEGORIES.map((category) => ({
    category,
    themes: names.filter((name) => JOB_THEMES[name].category === category),
  })).filter((group) => group.themes.length > 0)
}

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
  // mode 는 색이 아니라 의도라, category 는 분류라, background 는 에셋이라 --color-* 로
  // 내보내지 않는다.
  const { mode, category, background, ...tokens } = theme
  void mode
  void category
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
