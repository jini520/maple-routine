import { describe, expect, it } from 'vitest'
import jobThemes from '../../data/job-themes.json'
import { contrastHex, hexToOklch } from '../color'
import {
  DEFAULT_THEME,
  THEME_CATEGORIES,
  THEME_NAMES,
  buildThemeCss,
  getThemeDefinition,
  groupThemesByCategory,
  isThemeName,
} from '../theme-registry'
import type { ThemeName } from '../../types/theme'

const NAMES = Object.keys(jobThemes) as ThemeName[]

describe('THEME_NAMES / isThemeName — JSON 키가 단일 진실 공급원', () => {
  it('등록된 테마를 하나도 빠뜨리거나 더하지 않는다', () => {
    expect([...THEME_NAMES].sort()).toEqual([...NAMES].sort())
  })

  it('기본 테마가 맨 앞이다', () => {
    expect(THEME_NAMES[0]).toBe(DEFAULT_THEME)
  })

  /**
   * 표시 순서 규약이 바뀌었다([[ADR-104]] 결정 6) — 예전에는 "JSON 키 순서 = 표시 순서"였다.
   * 지금 JSON 이 우연히 카테고리 순으로 적혀 있어 결과가 같아도, 규약은 **카테고리가 먼저**다.
   * 그래서 나열 비교 대신 "카테고리 인덱스가 뒤로 갈수록 줄지 않는다"를 본다 — 새 테마를 JSON
   * 아무 데나 끼워 넣어도 이 성질이 깨지면 실패한다.
   */
  it('카테고리 순서대로 늘어서고, 같은 카테고리 안에서는 JSON 키 순서다', () => {
    const indexOf = (name: ThemeName): number =>
      THEME_CATEGORIES.indexOf(getThemeDefinition(name).category)

    const categoryIndexes = THEME_NAMES.map(indexOf)
    expect([...categoryIndexes]).toEqual([...categoryIndexes].sort((a, b) => a - b))

    for (const category of THEME_CATEGORIES) {
      const inRegistry = THEME_NAMES.filter((name) => getThemeDefinition(name).category === category)
      const inJson = NAMES.filter((name) => getThemeDefinition(name).category === category)
      expect(inRegistry).toEqual(inJson)
    }
  })
})

describe('groupThemesByCategory — 선택 목록의 섹션 ([[ADR-104]] 결정 3)', () => {
  it('카테고리 순서대로 그룹을 낸다', () => {
    const groups = groupThemesByCategory(THEME_NAMES)

    expect(groups.map((group) => group.category)).toEqual(
      THEME_CATEGORIES.filter((category) =>
        THEME_NAMES.some((name) => getThemeDefinition(name).category === category),
      ),
    )
  })

  it('모든 테마가 자기 카테고리 그룹에 정확히 한 번 들어간다', () => {
    const grouped = groupThemesByCategory(THEME_NAMES).flatMap((group) => group.themes)

    expect([...grouped].sort()).toEqual([...THEME_NAMES].sort())
    for (const group of groupThemesByCategory(THEME_NAMES)) {
      for (const name of group.themes) {
        expect(getThemeDefinition(name).category).toBe(group.category)
      }
    }
  })

  // 필터가 걸러낸 뒤 빈 카테고리가 헤더만 남는 것을 막는다 — 감추는 책임은 이 함수에 있다.
  it('항목이 없는 카테고리는 그룹째 나오지 않는다', () => {
    const darkOnly = THEME_NAMES.filter((name) => getThemeDefinition(name).mode === 'dark')
    const groups = groupThemesByCategory(darkOnly)

    expect(groups.every((group) => group.themes.length > 0)).toBe(true)
    expect(groups.flatMap((group) => group.themes)).toEqual(darkOnly)
  })

  it('빈 목록이면 그룹도 없다', () => {
    expect(groupThemesByCategory([])).toEqual([])
  })

  it.each(NAMES)('%s 는 테마 이름이다', (name) => {
    expect(isThemeName(name)).toBe(true)
  })

  it('등록되지 않은 값은 걸러낸다', () => {
    expect(isThemeName('없는테마')).toBe(false)
    expect(isThemeName('')).toBe(false)
  })
})

describe('buildThemeCss', () => {
  it.each(NAMES)('%s: 38개 토큰을 전부 커스텀 프로퍼티로 낸다', (name) => {
    const css = buildThemeCss(getThemeDefinition(name))
    const declared = [...css.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => match[1])
    // :root 와 .media-scope 양쪽에 나오므로 중복을 걷는다.
    expect(new Set(declared).size).toBeGreaterThanOrEqual(38)
  })

  it('camelCase 토큰 이름을 kebab-case 커스텀 프로퍼티로 바꾼다', () => {
    const css = buildThemeCss(getThemeDefinition('머쉬맘'))
    expect(css).toContain('--color-surface-2:')
    expect(css).toContain('--color-border-strong:')
    expect(css).toContain('--color-on-primary:')
    expect(css).toContain('--color-primary-tint:')
    expect(css).toContain('--color-primary-ink:')
    expect(css).toContain('--color-media-ink-muted:')
    expect(css).toContain('--color-shadow-color:')
  })

  it('실제 색 값을 담는다', () => {
    const 머쉬맘 = getThemeDefinition('머쉬맘')
    const css = buildThemeCss(머쉬맘)
    expect(css).toContain(`--color-primary: ${머쉬맘.primary};`)
    expect(css).toContain(`--color-on-primary: ${머쉬맘.onPrimary};`)
  })

  it('mode 는 색이 아니므로 커스텀 프로퍼티로 내지 않는다', () => {
    expect(buildThemeCss(getThemeDefinition('머쉬맘'))).not.toContain('--color-mode')
  })

  /**
   * 배경 이미지는 **선택 필드**다([[ADR-088]] 결정 3). 값을 가진 테마에서만 `--theme-bg-*` 가
   * 나가고, 없는 테마에서는 선언 자체가 없어야 한다 — 그래야 CSS 쪽 기본값(`none`)이 살아
   * 배경 없는 테마의 그림이 한 픽셀도 안 바뀐다.
   */
  describe('배경 이미지', () => {
    const withBackground = NAMES.filter((name) => getThemeDefinition(name).background !== undefined)
    const withoutBackground = NAMES.filter(
      (name) => getThemeDefinition(name).background === undefined,
    )

    it('배경을 가진 테마가 하나는 있다', () => {
      expect(withBackground.length).toBeGreaterThan(0)
    })

    it.each(withBackground)('%s: 이미지·크기·위치·어둡기·페이드를 커스텀 프로퍼티로 낸다', (name) => {
      const theme = getThemeDefinition(name)
      const css = buildThemeCss(theme)

      expect(css).toMatch(/--theme-bg-image: url\(.+\);/)
      expect(css).toContain(`--theme-bg-size: ${theme.background?.size};`)
      expect(css).toContain(`--theme-bg-position: ${theme.background?.position};`)
      expect(css).toContain(`--theme-bg-dim: ${theme.background?.dim};`)
      expect(css).toContain(`--theme-bg-fade-top: ${theme.background?.fadeTop};`)
    })

    it.each(withoutBackground)('%s: 배경 프로퍼티를 아예 내지 않는다', (name) => {
      expect(buildThemeCss(getThemeDefinition(name))).not.toContain('--theme-bg-')
    })

    it('background 는 색이 아니므로 --color-background 로 새지 않는다', () => {
      expect(buildThemeCss(getThemeDefinition(withBackground[0]))).not.toContain('--color-background')
    })

    it('슬러그에 해당하는 파일이 없으면 배경 프로퍼티를 내지 않는다', () => {
      const theme = getThemeDefinition(withBackground[0])
      const broken = { ...theme, background: { ...theme.background!, image: '없는파일' } }

      expect(buildThemeCss(broken)).not.toContain('--theme-bg-')
    })
  })

  // ADR-064 결정 5 — 일러스트 카드 안은 기준 표면이 media-surface 로 바뀐다.
  describe('미디어 스코프', () => {
    it('.media-scope 블록을 함께 낸다', () => {
      expect(buildThemeCss(getThemeDefinition('머쉬맘'))).toContain('.media-scope {')
    })

    it('스코프 안에서 표면·텍스트를 media-* 로 다시 묶는다', () => {
      const theme = getThemeDefinition('머쉬맘')
      const scope = buildThemeCss(theme).split('.media-scope {')[1]

      expect(scope).toContain(`--color-surface: ${theme.mediaSurface};`)
      expect(scope).toContain(`--color-border: ${theme.mediaBorder};`)
      expect(scope).toContain(`--color-text: ${theme.mediaInk};`)
      expect(scope).toContain(`--color-text-muted: ${theme.mediaInkMuted};`)
    })

    // 커스텀 프로퍼티는 선언된 요소에서 var() 가 해석되므로, 스코프 안에서 틴트·잉크를 다시
    // 선언하지 않으면 surface 기준 값이 그대로 상속된다([[ADR-021]] 의 3.88:1 이 그 사고였다).
    /**
     * 카드 안에서 쓰는 토큰을 스코프가 하나라도 빠뜨리면 **페이지 값이 그대로 내려온다**.
     * 실제로 `surface-2`·`track` 을 빠뜨려 어두운 카드 위에 페이지의 밝은 크림색 pill 이
     * 얹혔다("시작 안함" 배지, 사용자 보고 2026-07-30). 카드 안 표면은 전부 카드보다 어둡거나
     * 그에 준해야 한다 — 페이지 표면 쪽으로 튀면 안 된다.
     */
    it.each([...THEME_NAMES])('%s: 카드 안 표면이 페이지 표면으로 새지 않는다', (name) => {
      const theme = getThemeDefinition(name)
      const scope = buildThemeCss(theme).split('.media-scope {')[1]

      for (const token of ['surface', 'surface-2', 'track', 'border', 'text', 'text-muted']) {
        expect(scope, `--color-${token} 재선언 누락`).toContain(`--color-${token}:`)
      }

      // 카드 안 표면들은 카드 배경과 같은 어두운 대역에 있어야 한다.
      const declared = Object.fromEntries(
        [...scope.matchAll(/--color-([a-z0-9-]+): (#[0-9A-F]{6})/gi)].map((m) => [m[1], m[2]]),
      )
      const cardLightness = hexToOklch(theme.mediaSurface).l
      for (const token of ['surface-2', 'track']) {
        expect(hexToOklch(declared[token]).l, `${token} 가 카드보다 너무 밝다`).toBeLessThan(
          cardLightness + 0.2,
        )
      }
    })

    it('accent 틴트·잉크는 스코프가 건드리지 않는다 — 칩은 자기 배경을 갖는다', () => {
      const scope = buildThemeCss(getThemeDefinition('머쉬맘')).split('.media-scope {')[1]

      // secondary 만 예외 — 완료 배지가 카드 안에서만 쓰여 모드별 값을 준다.
      for (const accent of ['primary', 'third', 'error']) {
        expect(scope, `${accent}-tint`).not.toContain(`--color-${accent}-tint:`)
        expect(scope, `${accent}-ink`).not.toContain(`--color-${accent}-ink:`)
      }
    })

    it.each([...THEME_NAMES])('%s: 완료 배지가 카드 안 "시작 안함" 배지와 구분된다', (name) => {
      const scope = buildThemeCss(getThemeDefinition(name)).split('.media-scope {')[1]
      const read = (token: string) =>
        new RegExp(`--color-${token}: (#[0-9A-F]{6})`, 'i').exec(scope)?.[1] ?? ''

      // 알파는 떼고 바탕색만 견준다 — 카드 위에 얹히므로 실제 인상은 이보다 카드 쪽에 가깝다.
      expect(contrastHex(read('secondary-tint'), read('surface-2'))).toBeGreaterThan(1.5)
    })
  })
})
