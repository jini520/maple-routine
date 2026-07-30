import { describe, expect, it } from 'vitest'
import jobThemes from '../../data/job-themes.json'
import {
  DEFAULT_THEME,
  THEME_NAMES,
  buildThemeCss,
  getThemeDefinition,
  isThemeName,
} from '../theme-registry'
import type { ThemeName } from '../../types/theme'

const NAMES = Object.keys(jobThemes) as ThemeName[]

describe('THEME_NAMES / isThemeName — JSON 키가 단일 진실 공급원', () => {
  it('등록된 테마 이름을 JSON 에서 그대로 가져온다', () => {
    expect([...THEME_NAMES]).toEqual(NAMES)
  })

  it('기본 테마가 맨 앞이다 — JSON 키 순서가 설정 화면 표시 순서다', () => {
    expect(THEME_NAMES[0]).toBe(DEFAULT_THEME)
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
  it.each(NAMES)('%s: 34개 토큰을 전부 커스텀 프로퍼티로 낸다', (name) => {
    const css = buildThemeCss(getThemeDefinition(name))
    const declared = [...css.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => match[1])
    // :root 와 .media-scope 양쪽에 나오므로 중복을 걷는다.
    expect(new Set(declared).size).toBeGreaterThanOrEqual(34)
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
    it('스코프 안에서 accent 틴트·잉크를 다시 선언한다', () => {
      const scope = buildThemeCss(getThemeDefinition('레테')).split('.media-scope {')[1]

      for (const accent of ['primary', 'secondary', 'third', 'error']) {
        expect(scope, `${accent}-tint`).toContain(`--color-${accent}-tint:`)
        expect(scope, `${accent}-ink`).toContain(`--color-${accent}-ink:`)
      }
    })

    it('스코프의 잉크는 :root 의 잉크와 다른 값이다 — 기준 표면이 다르기 때문', () => {
      const theme = getThemeDefinition('머쉬맘')
      const [root, scope] = buildThemeCss(theme).split('.media-scope {')

      expect(root).toContain(`--color-primary-ink: ${theme.primaryInk};`)
      expect(scope).not.toContain(`--color-primary-ink: ${theme.primaryInk};`)
    })
  })
})
