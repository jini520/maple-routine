import jobThemes from '../../data/job-themes.json'
import { contrastHex, hexToOklch } from '../color'
import {
  THEME_TOKEN_KEYS,
  deriveMediaScope,
  deriveTheme,
  measureThemeContrast,
  type ThemeSeed,
} from '../theme/theme-derive'

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
  it.each(ALL_SEEDS)('%s: 38개 토큰을 빠짐없이 만든다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    expect(Object.keys(tokens).sort()).toEqual([...THEME_TOKEN_KEYS].sort())
    expect(THEME_TOKEN_KEYS).toHaveLength(38)
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

// 대비는 관문이 아니지만, **명도를 맞춰서 만드는 토큰**은 그 목표를 실제로 달성해야 한다.
// 본문 텍스트와 accent 잉크가 그렇다(on-* 는 색감 우선이라 여기 없다. 아래 별도 describe).
describe('deriveTheme — 명도를 맞춰 만드는 토큰', () => {
  it.each(ALL_SEEDS)('%s: 본문·보조 텍스트가 배경 대비 AA 를 지킨다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    for (const surface of [tokens.bg, tokens.surface]) {
      expect(contrastHex(tokens.text, surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrastHex(tokens.textMuted, surface)).toBeGreaterThanOrEqual(4.5)
    }
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

  it('secondary·third·error 채움에도 같은 규칙이 적용된다', () => {
    const tokens = deriveTheme(PASTEL_SEED)
    expect(contrastHex(tokens.onSecondary, tokens.secondary)).toBeGreaterThanOrEqual(4.5)
    expect(contrastHex(tokens.onThird, tokens.third)).toBeGreaterThanOrEqual(4.5)
    expect(contrastHex(tokens.onError, tokens.error)).toBeGreaterThanOrEqual(4.5)
  })
})

// ADR-064 결정 1 정정 — 흑/백 둘 중 하나로 퇴화하면 안 된다. 배경색마다 어울리는 전경색이 있다.
describe('on-* — 순수 흑/백이 아니라 채움색의 색조를 물려받는다', () => {
  const ON_KEYS = ['onPrimary', 'onSecondary', 'onThird', 'onError'] as const
  const FILL_OF = {
    onPrimary: 'primary',
    onSecondary: 'secondary',
    onThird: 'third',
    onError: 'error',
  } as const

  it.each(ALL_SEEDS)('%s: 어떤 on-* 도 순수 흑/백이 아니다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    for (const key of ON_KEYS) {
      expect(tokens[key]).not.toBe('#000000')
      expect(tokens[key]).not.toBe('#FFFFFF')
    }
  })

  // 연한 색은 **테마의 것**이다. 채움마다 다른 색조를 만들면 테마가 여러 톤으로 흩어진다.
  it.each(ALL_SEEDS)('%s: 연한 전경은 브랜드 색상(H)을 따르고 채움마다 같다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    const brand = hexToOklch(tokens.primary).h

    const lightOnes = ON_KEYS.map((key) => tokens[key]).filter((hex) => hexToOklch(hex).l > 0.5)
    expect(new Set(lightOnes).size, '연한 전경은 테마당 하나여야 한다').toBeLessThanOrEqual(1)

    for (const hex of lightOnes) {
      const gap = Math.abs(((hexToOklch(hex).h - brand + 540) % 360) - 180)
      expect(gap, '브랜드 색상에서 벗어남').toBeLessThan(10)
    }
  })

  // 연한 색이 글자로 사라지는 채움에서만 짙은 전경으로 넘어가고, 그때는 채움 색조를 따른다.
  it.each(ALL_SEEDS)('%s: 짙은 전경으로 넘어간 자리는 채움 색조를 따른다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    for (const key of ON_KEYS) {
      const foreground = hexToOklch(tokens[key])
      if (foreground.l > 0.5) continue
      const fill = hexToOklch(tokens[FILL_OF[key]])
      const gap = Math.abs(((foreground.h - fill.h + 540) % 360) - 180)
      expect(gap, key).toBeLessThan(10)
    }
  })

  it.each(ALL_SEEDS)('%s: on-* 이 무채색이 아니다(채도가 남아 있다)', (_label, seed) => {
    const tokens = deriveTheme(seed)
    for (const key of ON_KEYS) {
      expect(hexToOklch(tokens[key]).c).toBeGreaterThan(0.004)
    }
  })

  // 사용자 결정(2026-07-30): 색 있는 채움 위에는 아이보리 계열이 기본이다.
  it('주황 채움 위에는 따뜻한 아이보리가 온다', () => {
    const tokens = deriveTheme(LIGHT_SEED)
    const onPrimary = hexToOklch(tokens.onPrimary)

    expect(onPrimary.l).toBeGreaterThan(0.9)
    expect(onPrimary.c).toBeGreaterThan(0.004) // 순수 흰색이 아니라 주황 쪽으로 기운 아이보리
  })

  // 연한 톤이 사라지는 채움에서만 짙은 전경으로 넘어간다. 그때도 검정이 아니라 그 색의 진한 톤이다.
  it('연한 톤이 사라지는 채움 위에서는 그 색의 진한 톤으로 넘어간다', () => {
    // 머쉬맘 secondary(#F7D00D, L≈0.87)에 아이보리를 얹으면 1.46:1로 안 보인다.
    const tokens = deriveTheme(LIGHT_SEED)
    expect(hexToOklch(tokens.secondary).l).toBeGreaterThan(0.75)
    expect(hexToOklch(tokens.onSecondary).l).toBeLessThan(0.5)

    // 파스텔 primary 도 마찬가지.
    const pastel = deriveTheme(PASTEL_SEED)
    expect(hexToOklch(pastel.onPrimary).l).toBeLessThan(0.5)

    // 검정으로 눌러버리지 않는다. 채도가 남아 "그 색의 진한 톤"으로 읽혀야 한다.
    expect(hexToOklch(tokens.onSecondary).l).toBeGreaterThan(0.25)
    expect(hexToOklch(tokens.onSecondary).c).toBeGreaterThan(0.02)
  })
})

// ADR-064 판단 순서 — 잉크는 accent 원색을 그대로 쓰고, 정말 안 보일 때만 보정한다.
// AA 를 겨냥하던 시절엔 머쉬맘 브랜드 주황이 짙은 갈색으로 눌려 탭·배지 53곳이 통째로 바뀌었다.
describe('*-ink — accent 원색을 지킨다', () => {
  it('머쉬맘 브랜드 주황은 글자로 쓸 때도 그대로다', () => {
    const tokens = deriveTheme(LIGHT_SEED)
    expect(tokens.primaryInk).toBe(tokens.primary)
    expect(tokens.thirdInk).toBe(tokens.third)
  })

  it.each(ALL_SEEDS)('%s: 두 바탕에서 다 보이는 accent 는 건드리지 않는다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    for (const accent of ['primary', 'secondary', 'third'] as const) {
      const backgrounds = [tokens.surface, tokens[`${accent}Tint`]]
      if (backgrounds.every((bg) => contrastHex(tokens[accent], bg) >= 2)) {
        expect(tokens[`${accent}Ink`], accent).toBe(tokens[accent])
      }
    }
  })

  // 이 토큰을 만든 이유였던 사고 — 렌의 창백한 하늘색은 글자로 1.24:1이라 아예 안 보였다.
  it('아예 안 보이는 색만 보정한다', () => {
    const pale = deriveTheme({ ...LIGHT_SEED, third: '#C9EEF2' })
    expect(contrastHex(pale.third, pale.surface)).toBeLessThan(1.5)
    expect(pale.thirdInk).not.toBe(pale.third)
    expect(contrastHex(pale.thirdInk, pale.surface)).toBeGreaterThanOrEqual(2)
  })

  it('보정할 때도 색상(H)은 원래 accent 를 따라간다', () => {
    const pale = deriveTheme({ ...LIGHT_SEED, third: '#C9EEF2' })
    expect(hexToOklch(pale.thirdInk).h).toBeCloseTo(hexToOklch(pale.third).h, -1)
  })
})

// ADR-064 결정 4 재정정 — 트랙은 표면 톤을 따른다. 대비를 맞추려고 색을 밀지 않는다.
// ADR-087 결정 5. 이 색이 지켜야 하는 것은 "빨강 = 늘었다"가 **모든 테마에서 같은 뜻**이라는 것과,
// 라이트·다크 어느 쪽에서도 읽힌다는 것 둘이다. 고정 hex 한 쌍으로는 후자가 깨진다.
describe('rise/fall — 증감 신호색은 시드와 무관하게 휴가 고정된다', () => {
  it.each(ALL_SEEDS)('%s: rise 는 빨강, fall 은 파랑 계열이다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    // 휴는 원형이라 빨강(≈26)은 0 부근에서 감싸 돈다. 좁은 구간으로 못 박아 시드가 새는 것을 막는다.
    expect(hexToOklch(tokens.riseInk).h).toBeGreaterThan(15)
    expect(hexToOklch(tokens.riseInk).h).toBeLessThan(40)
    expect(hexToOklch(tokens.fallInk).h).toBeGreaterThan(250)
    expect(hexToOklch(tokens.fallInk).h).toBeLessThan(275)
  })

  it('다크 모드의 잉크가 라이트 모드보다 밝다', () => {
    const light = deriveTheme(LIGHT_SEED)
    const dark = deriveTheme(DARK_SEED)
    expect(hexToOklch(dark.riseInk).l).toBeGreaterThan(hexToOklch(light.riseInk).l)
    expect(hexToOklch(dark.fallInk).l).toBeGreaterThan(hexToOklch(light.fallInk).l)
  })

  it.each(ALL_SEEDS)('%s: 잉크가 표면과 자기 틴트 위에서 모두 AA(4.5:1) 이상이다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    expect(contrastHex(tokens.riseInk, tokens.riseTint)).toBeGreaterThanOrEqual(4.5)
    expect(contrastHex(tokens.riseInk, tokens.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastHex(tokens.fallInk, tokens.fallTint)).toBeGreaterThanOrEqual(4.5)
    expect(contrastHex(tokens.fallInk, tokens.surface)).toBeGreaterThanOrEqual(4.5)
  })

  it('rise 와 fall 은 서로 확실히 구분된다', () => {
    const tokens = deriveTheme(LIGHT_SEED)
    expect(Math.abs(hexToOklch(tokens.riseInk).h - hexToOklch(tokens.fallInk).h)).toBeGreaterThan(180)
  })
})

describe('track — 표면 톤을 따른다', () => {
  it.each(ALL_SEEDS)('%s: track 이 surface-2 와 같다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    expect(tokens.track).toBe(tokens.surface2)
  })

  it('특정 테마만 덮을 수 있다 — surface-2 를 쓰는 다른 자리는 안 건드린다', () => {
    const tokens = deriveTheme({ ...LIGHT_SEED, overrides: { track: '#585545' } })
    expect(tokens.track).toBe('#585545')
    expect(tokens.surface2).not.toBe('#585545')
  })
})

// ADR-064 결정 11 재정정 — 대비는 재서 보여줄 뿐 통과/실패를 매기지 않는다.
describe('measureThemeContrast — 관문이 아니라 계측', () => {
  it('기준선 아래여도 던지거나 실패로 표시하지 않는다', () => {
    const report = measureThemeContrast(deriveTheme(LIGHT_SEED))
    expect(report.measurements.length).toBeGreaterThan(10)
    expect(report).not.toHaveProperty('pass')
    expect(report).not.toHaveProperty('failures')
  })

  it('기준선 아래인 항목을 숨기지 않고 목록으로 준다', () => {
    // 머쉬맘 주황 위 아이보리는 2.16:1 — 받아들이기로 한 값이지만 수치는 그대로 보고한다.
    const report = measureThemeContrast(deriveTheme(LIGHT_SEED))
    const onPrimary = report.measurements.find(
      (entry) => entry.token === 'onPrimary' && entry.against === 'primary',
    )

    expect(onPrimary?.meets).toBe(false)
    expect(onPrimary?.ratio).toBeLessThan(3)
    expect(report.below).toContain(onPrimary)
  })
})

// 완료 배지는 카드 안에서만 쓰이므로 스코프가 모드별로 값을 준다(정정).
describe('완료 배지 — 모드별로 다르게', () => {
  it('라이트: 페이지 틴트를 그대로 쓴다 — 어두운 카드 위 옅은 칩이 잘 보인다', () => {
    const tokens = deriveTheme(LIGHT_SEED)
    const scope = deriveMediaScope(tokens, 'light')

    expect(scope.secondaryTint).toBe(tokens.secondaryTint)
    expect(scope.secondaryInk).toBe(tokens.secondaryInk)
    expect(contrastHex(scope.secondaryTint, tokens.mediaSurface)).toBeGreaterThan(4)
  })

  it('다크: 옅은 틴트는 "시작 안함" 배지와 구분이 안 돼 진한 채움을 쓴다', () => {
    const tokens = deriveTheme(DARK_SEED)
    const scope = deriveMediaScope(tokens, 'dark')

    expect(scope.secondaryTint).toBe(tokens.secondary)
    expect(scope.secondaryInk).toBe(tokens.onSecondary)

    // 카드 안 "시작 안함" 배지(surface-2)와 확실히 갈려야 한다.
    expect(contrastHex(scope.secondaryTint, scope.surface2)).toBeGreaterThan(2)
  })
})

// ADR-064 결정 5 — 일러스트 카드 안은 카드 **위에 직접 놓이는** 것들만 기준을 바꾼다.
describe('deriveMediaScope — 카드 위에 직접 놓이는 것만 다시 묶는다', () => {
  it('표면·텍스트·보더가 media-* 를 가리킨다', () => {
    const tokens = deriveTheme(LIGHT_SEED)
    const scope = deriveMediaScope(tokens, 'light')

    expect(scope.surface).toBe(tokens.mediaSurface)
    expect(scope.border).toBe(tokens.mediaBorder)
    expect(scope.text).toBe(tokens.mediaInk)
    expect(scope.textMuted).toBe(tokens.mediaInkMuted)
  })

  it.each(ALL_SEEDS)('%s: 카드 안 표면이 카드 톤 안에 머문다', (_label, seed) => {
    const tokens = deriveTheme(seed)
    const scope = deriveMediaScope(tokens, seed.mode)

    expect(scope.track).toBe(scope.surface2)
    expect(hexToOklch(scope.surface2).l).toBeGreaterThan(hexToOklch(scope.surface).l)
    expect(hexToOklch(scope.surface2).l).toBeLessThan(hexToOklch(scope.surface).l + 0.2)
  })

  /**
   * accent 틴트·잉크는 **다시 묶지 않는다**. 틴트 칩은 자기 배경을 갖고 있어서 뒤의 카드 색과
   * 무관하고, 카드 기준으로 다시 계산하면 옅은 칩이 어두운 칩으로 바뀌어 카드에 묻힌다
   * (머쉬맘 완료 배지가 `#FCF6DD` 옅은 크림에서 `#382C14` 어두운 올리브가 됐던 문제,
   * 사용자 보고 2026-07-30).
   */
  it('accent 틴트·잉크는 카드 안에서도 페이지 값을 쓴다', () => {
    const scope = deriveMediaScope(deriveTheme(LIGHT_SEED), 'light') as Record<string, string>

    // secondary 는 완료 배지 전용으로 예외다(아래 별도 describe).
    for (const key of ['primaryTint', 'primaryInk', 'thirdTint', 'thirdInk']) {
      expect(scope[key], `${key} 는 스코프가 건드리지 않는다`).toBeUndefined()
    }
  })
})

// 기존 4테마는 값을 그대로 승계한다(회귀 없음). 생성 도구의 역할은 신규 토큰을 채우는 것이고,
// 채워진 값이 기존 값들과 함께 대비 요구를 만족해야 한다.
describe('기존 4테마 승계', () => {
  const MODES = { 레테: 'dark', 렌: 'light', 머쉬맘: 'light', 혼테일: 'dark' } as const

  it.each(Object.keys(MODES) as Array<keyof typeof MODES>)(
    '%s: 기존 17토큰이 보존되고 신규 토큰이 채워진다',
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

      // 신규 토큰이 기존 값들과 어울려 실제로 만들어지는지만 본다. 대비는 관문이 아니다.
      expect(Object.keys(tokens).sort()).toEqual([...THEME_TOKEN_KEYS].sort())
      expect(measureThemeContrast(tokens).measurements.every((entry) => entry.ratio > 1)).toBe(true)
    },
  )
})
