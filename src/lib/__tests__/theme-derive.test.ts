import { describe, expect, it } from 'vitest'
import jobThemes from '../../data/job-themes.json'
import { contrastHex, hexToOklch, mixOklab } from '../color'
import {
  THEME_TOKEN_KEYS,
  checkThemeContrast,
  deriveMediaScope,
  deriveTheme,
  type ThemeSeed,
} from '../theme-derive'

const LIGHT_SEED: ThemeSeed = { primary: '#F58B0F', secondary: '#F7D00D', third: '#CA763A', mode: 'light' }
const DARK_SEED: ThemeSeed = { primary: '#9975B3', secondary: '#D1C093', third: '#D8608F', mode: 'dark' }

// ADR-064 결정 1의 핵심 요구 — "primary는 충분히 어둡다"를 전제하지 않는다. 아주 밝은 파스텔과
// 아주 어두운 색을 양 극단으로 두고, 두 경우 모두 채움 위 전경이 성립하는지 본다.
const PASTEL_SEED: ThemeSeed = { primary: '#BFE3F5', secondary: '#FBD9E3', third: '#D9F0D1', mode: 'light' }
const DEEP_SEED: ThemeSeed = { primary: '#2B1454', secondary: '#123C2E', third: '#4A1220', mode: 'dark' }

const ALL_SEEDS: Array<[string, ThemeSeed]> = [
  ['라이트(머쉬맘 시드)', LIGHT_SEED],
  ['다크(레테 시드)', DARK_SEED],
  ['밝은 파스텔', PASTEL_SEED],
  ['아주 어두운', DEEP_SEED],
]

describe('deriveTheme — 스키마', () => {
  it.each(ALL_SEEDS)('%s: 34개 토큰을 빠짐없이 만든다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    expect(Object.keys(tokens).sort()).toEqual([...THEME_TOKEN_KEYS].sort())
    expect(THEME_TOKEN_KEYS).toHaveLength(34)
  })

  it('시드로 준 accent 는 그대로 쓴다', () => {
    const tokens = deriveTheme(LIGHT_SEED)
    expect(tokens.primary).toBe('#F58B0F')
    expect(tokens.secondary).toBe('#F7D00D')
    expect(tokens.third).toBe('#CA763A')
  })

  it('overrides 가 파생값을 이긴다', () => {
    const tokens = deriveTheme({ ...LIGHT_SEED, overrides: { bg: '#F2F0E2', text: '#241208' } })
    expect(tokens.bg).toBe('#F2F0E2')
    expect(tokens.text).toBe('#241208')
  })
})

describe('deriveTheme — 대비 요구', () => {
  it.each(ALL_SEEDS)('%s: 모든 대비 요구를 통과한다', (_label, seed) => {
    const report = checkThemeContrast(deriveTheme(seed))
    expect(report.failures).toEqual([])
    expect(report.pass).toBe(true)
  })
})

// ADR-064 결정 1 — text-white/text-bg 고정을 파기한 이유가 실제로 지켜지는지.
describe('on-* — 채움 위 전경색은 어느 쪽도 전제하지 않는다', () => {
  it('밝은 파스텔 primary 위에는 어두운 전경이 온다', () => {
    const tokens = deriveTheme(PASTEL_SEED)
    expect(hexToOklch(tokens.onPrimary).l).toBeLessThan(hexToOklch(tokens.primary).l)
    expect(contrastHex(tokens.onPrimary, tokens.primary)).toBeGreaterThanOrEqual(4.5)
  })

  it('아주 어두운 primary 위에는 밝은 전경이 온다', () => {
    const tokens = deriveTheme(DEEP_SEED)
    expect(hexToOklch(tokens.onPrimary).l).toBeGreaterThan(hexToOklch(tokens.primary).l)
    expect(contrastHex(tokens.onPrimary, tokens.primary)).toBeGreaterThanOrEqual(4.5)
  })

  it('흰색 고정이 아니다 — 파스텔 테마에서는 흰색이 선택되지 않는다', () => {
    expect(deriveTheme(PASTEL_SEED).onPrimary).not.toBe('#FFFFFF')
  })

  it('secondary·third·error 채움에도 같은 규칙이 적용된다', () => {
    const tokens = deriveTheme(PASTEL_SEED)
    expect(contrastHex(tokens.onSecondary, tokens.secondary)).toBeGreaterThanOrEqual(4.5)
    expect(contrastHex(tokens.onThird, tokens.third)).toBeGreaterThanOrEqual(4.5)
    expect(contrastHex(tokens.onError, tokens.error)).toBeGreaterThanOrEqual(4.5)
  })
})

// ADR-064 결정 3 — *-ink 는 표면과 틴트 양쪽에서 읽혀야 한다(두 역할을 겸하던 *-text 의 후속).
describe('*-ink — 표면과 틴트 양쪽에서 AA', () => {
  it.each(ALL_SEEDS)('%s: primary-ink 가 surface·primary-tint 모두 4.5:1 이상', (_label, seed) => {
    const tokens = deriveTheme(seed)
    expect(contrastHex(tokens.primaryInk, tokens.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastHex(tokens.primaryInk, tokens.primaryTint)).toBeGreaterThanOrEqual(4.5)
  })

  it('색상(H)은 원래 accent 를 따라간다', () => {
    const tokens = deriveTheme(LIGHT_SEED)
    expect(hexToOklch(tokens.primaryInk).h).toBeCloseTo(hexToOklch(tokens.primary).h, -1)
  })
})

// ADR-064 결정 4 — 텍스트가 없는 채움(진행률 바)의 대비를 보증하는 주체.
describe('track — 진행률 채움 대비', () => {
  it.each(ALL_SEEDS)('%s: track 대 primary 가 3:1 이상', (_label, seed) => {
    const tokens = deriveTheme(seed)
    expect(contrastHex(tokens.track, tokens.primary)).toBeGreaterThanOrEqual(3)
  })
})

// ADR-064 결정 5 — 일러스트 카드 안은 기준 표면이 media-surface 로 바뀐다.
describe('deriveMediaScope — 미디어 기준 두 번째 벌', () => {
  it.each(ALL_SEEDS)('%s: 미디어 기준에서도 ink 가 AA 를 만족한다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    const scope = deriveMediaScope(tokens)

    expect(contrastHex(scope.primaryInk, tokens.mediaSurface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastHex(scope.primaryInk, scope.primaryTint)).toBeGreaterThanOrEqual(4.5)
    expect(contrastHex(scope.thirdInk, scope.thirdTint)).toBeGreaterThanOrEqual(4.5)
  })

  it('스코프의 표면·텍스트는 media-* 를 가리킨다', () => {
    const tokens = deriveTheme(LIGHT_SEED)
    const scope = deriveMediaScope(tokens)
    expect(scope.surface).toBe(tokens.mediaSurface)
    expect(scope.border).toBe(tokens.mediaBorder)
    expect(scope.text).toBe(tokens.mediaInk)
    expect(scope.textMuted).toBe(tokens.mediaInkMuted)
  })

  // ADR-021 에 미해결로 남아 있던 사고 — 레테 카드 안 점수 배지가 3.88:1 이었다.
  it('레테 third 가 미디어 기준에서 AA 를 넘는다 (ADR-021 미해결 건)', () => {
    const lete = jobThemes['레테']
    const tokens = deriveTheme({
      primary: lete.primary,
      secondary: lete.secondary,
      third: lete.third,
      mode: 'dark',
      overrides: { mediaSurface: '#1A1720', mediaBorder: '#37323E', mediaInk: '#E8DFEC' },
    })
    const scope = deriveMediaScope(tokens)

    // 옛 방식은 `bg-third/20 text-third` — 배경이 카드 표면이 아니라 third 20% 틴트였고, 거기서
    // 미달이 났다(ADR-021 기록 3.88:1, 여기 계산 약 3.98:1 — 혼합 색공간 차이).
    const legacyTint = mixOklab('#D8608F', '#1A1720', 0.2)
    expect(contrastHex('#D8608F', legacyTint)).toBeLessThan(4.5)

    expect(contrastHex(scope.thirdInk, scope.thirdTint)).toBeGreaterThanOrEqual(4.5)
  })
})

// 기존 4테마는 값을 그대로 승계한다(회귀 없음). 생성 도구의 역할은 신규 토큰을 채우는 것이고,
// 채워진 값이 기존 값들과 함께 대비 요구를 만족해야 한다.
describe('기존 4테마 승계', () => {
  const MODES = { 레테: 'dark', 렌: 'light', 머쉬맘: 'light', 혼테일: 'dark' } as const

  it.each(Object.keys(MODES) as Array<keyof typeof MODES>)(
    '%s: 기존 17토큰이 보존되고 신규 토큰이 대비를 통과한다',
    (name) => {
      const existing = jobThemes[name]
      const tokens = deriveTheme({
        primary: existing.primary,
        secondary: existing.secondary,
        third: existing.third,
        mode: MODES[name],
        overrides: {
          bg: existing.bg,
          surface: existing.surface,
          surface2: existing.surface2,
          border: existing.border,
          borderStrong: existing.borderStrong,
          primaryHover: existing.primaryHover,
          error: existing.error,
          infoTint: existing.infoTint,
          text: existing.text,
          textMuted: existing.textMuted,
          textDisabled: existing.textDisabled,
        },
      })

      expect(tokens.bg).toBe(existing.bg)
      expect(tokens.surface).toBe(existing.surface)
      expect(tokens.text).toBe(existing.text)
      expect(tokens.primary).toBe(existing.primary)

      expect(checkThemeContrast(tokens).failures).toEqual([])
    },
  )
})
