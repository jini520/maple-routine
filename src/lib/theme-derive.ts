/**
 * 테마 34토큰 파생 ([[ADR-064]] 결정 9).
 *
 * 사람이 정하는 값은 **시드 3색(primary·secondary·third) + mode** 뿐이고 나머지는 여기서 만든다.
 * 34개를 손으로 채우면 테마를 수십 개로 늘릴 수 없기 때문이다. 이미 확정된 값이 있는 테마는
 * `overrides` 로 그대로 승계시켜 회귀를 만들지 않는다.
 *
 * 런타임이 아니라 **생성 도구**에서 부르는 것이 전제다 — 색 값은 도메인 데이터라 [[ADR-006]] 상
 * 사용자 확인을 거쳐 `job-themes.json` 에 커밋해야 하고, 런타임 계산은 그 절차를 없앤다.
 */

import { contrastHex, hexToOklch, mixOklab, oklchToHex, withLightness } from './color'

export type ThemeMode = 'light' | 'dark'

export interface DerivedTheme {
  bg: string
  surface: string
  surface2: string
  track: string
  border: string
  borderStrong: string

  text: string
  textMuted: string
  textDisabled: string

  primary: string
  primaryHover: string
  onPrimary: string
  primaryTint: string
  primaryInk: string

  secondary: string
  onSecondary: string
  secondaryTint: string
  secondaryInk: string

  third: string
  onThird: string
  thirdTint: string
  thirdInk: string

  error: string
  onError: string
  errorTint: string
  errorInk: string

  infoTint: string
  infoInk: string

  mediaSurface: string
  mediaBorder: string
  mediaInk: string
  mediaInkMuted: string

  /** 반투명 — 8자리 hex(#RRGGBBAA) */
  scrim: string
  /** 반투명 — 8자리 hex(#RRGGBBAA) */
  shadowColor: string
}

export const THEME_TOKEN_KEYS = [
  'bg', 'surface', 'surface2', 'track', 'border', 'borderStrong',
  'text', 'textMuted', 'textDisabled',
  'primary', 'primaryHover', 'onPrimary', 'primaryTint', 'primaryInk',
  'secondary', 'onSecondary', 'secondaryTint', 'secondaryInk',
  'third', 'onThird', 'thirdTint', 'thirdInk',
  'error', 'onError', 'errorTint', 'errorInk',
  'infoTint', 'infoInk',
  'mediaSurface', 'mediaBorder', 'mediaInk', 'mediaInkMuted',
  'scrim', 'shadowColor',
] as const satisfies ReadonlyArray<keyof DerivedTheme>

export interface ThemeSeed {
  primary: string
  secondary: string
  third: string
  mode: ThemeMode
  overrides?: Partial<DerivedTheme>
}

/** 본문 텍스트 기준(WCAG AA). */
const AA_TEXT = 4.5
/** 비-텍스트(진행률 채움 등) 기준(WCAG AA). */
const AA_NON_TEXT = 3

/**
 * 채움 위 전경색(`on-*`)의 **필수** 하한 ([[ADR-064]] 결정 1 재정정, 사용자 결정 2026-07-30).
 *
 * 색 있는 채움 위에 아이보리를 얹는 쪽을 택하면서 이 자리만 AA(4.5:1)를 필수에서 내렸다.
 * 대신 3:1 은 지킨다 — 그 아래는 취향이 아니라 글자가 안 보이는 구간이기 때문이다.
 * 4.5:1 은 권고로 계속 재고, 못 지키면 리포트가 말한다.
 */
const ON_FILL_MIN = AA_NON_TEXT

/**
 * 파생할 때만 쓰는 여유분. 기준선에 정확히 붙은 값(4.50:1)이 나오면 검사는 통과하지만
 * 우연히 걸친 것처럼 읽히고, 뒤에 값을 조금만 손봐도 곧바로 미달로 넘어간다.
 * 검사 기준 자체는 그대로 두고 **만들 때만** 조금 넘겨 잡는다.
 */
const DERIVE_MARGIN = 0.1

/** 틴트 농도 — 자리마다 달랐던 4종(/10·/12·/15·/25)을 하나로 통일했다([[ADR-064]] 결정 2). */
const TINT_RATIO = 0.15

/**
 * 중립 톤 램프. 배경·보더·텍스트를 순수 무채색이 아니라 primary 색상 쪽으로 살짝 기울여
 * 테마마다 고유한 톤을 갖게 한다(기존 4테마가 손으로 하던 것을 규칙화).
 */
const NEUTRAL_RAMP = {
  light: {
    bg: { l: 0.95, c: 0.02 },
    surface: { l: 0.985, c: 0.008 },
    surface2: { l: 0.9, c: 0.025 },
    border: { l: 0.84, c: 0.03 },
    borderStrong: { l: 0.68, c: 0.045 },
    text: { l: 0.2, c: 0.04 },
    textMuted: { l: 0.45, c: 0.03 },
    textDisabled: { l: 0.63, c: 0.025 },
  },
  dark: {
    bg: { l: 0.13, c: 0.015 },
    surface: { l: 0.2, c: 0.02 },
    surface2: { l: 0.27, c: 0.022 },
    border: { l: 0.35, c: 0.025 },
    borderStrong: { l: 0.45, c: 0.03 },
    text: { l: 0.92, c: 0.02 },
    textMuted: { l: 0.72, c: 0.03 },
    textDisabled: { l: 0.56, c: 0.025 },
  },
} as const

/** 일러스트 위 배색은 라이트/다크 무관하게 어두운 쪽이다 — bleed·페이드가 어두운 배경 전제. */
const MEDIA_RAMP = {
  surface: { l: 0.2, c: 0.02 },
  border: { l: 0.33, c: 0.025 },
  ink: { l: 0.92, c: 0.015 },
  inkMuted: { l: 0.72, c: 0.02 },
} as const

/** 에러는 브랜드와 무관하게 항상 빨강 계열이어야 의미가 읽힌다. */
const ERROR_HUE = 27
const ERROR_RAMP = { light: { l: 0.48, c: 0.19 }, dark: { l: 0.63, c: 0.17 } } as const

/** 정보 톤은 브랜드와 구분되도록 차가운 쪽에 둔다. */
const INFO_HUE = 235

/**
 * 스크림·그림자는 반투명이라 8자리 hex(#RRGGBBAA)로 낸다([[ADR-064]] 결정 6).
 * 다크 테마는 이미 배경이 어두워 같은 알파로는 덜 눌리므로 더 어둡고 진하게 잡는다.
 */
const SCRIM_RAMP = { light: { l: 0.15, c: 0.012 }, dark: { l: 0.06, c: 0.01 } } as const
const SCRIM_ALPHA = { light: 0.55, dark: 0.7 } as const
const SHADOW_RAMP = { l: 0.08, c: 0.02 } as const
const SHADOW_ALPHA = 0.35

function tone(hue: number, ramp: { l: number; c: number }): string {
  return oklchToHex({ l: ramp.l, c: ramp.c, h: hue })
}

/**
 * 바탕색 대비가 `required` 이상이 되도록 명도만 조정한다. 색상(H)·채도(C)는 유지한다.
 *
 * 원래 색에서 가장 가까운 명도를 고르므로 accent 의 인상이 최대한 남는다. 밝은 바탕이면
 * 어둡게, 어두운 바탕이면 밝게 미는 방향이 자동으로 정해진다.
 */
function adjustForContrast(hex: string, backgrounds: string[], required: number): string {
  const passes = (candidate: string): boolean =>
    backgrounds.every((bg) => contrastHex(candidate, bg) >= required + DERIVE_MARGIN)

  if (passes(hex)) return hex

  const original = hexToOklch(hex)
  // 바탕이 밝을수록 어두워지는 쪽이 답이다. 여러 바탕이면 가장 밝은 쪽을 기준으로 방향을 잡는다.
  const brightest = Math.max(...backgrounds.map((bg) => hexToOklch(bg).l))
  const direction = brightest > 0.5 ? -1 : 1

  for (let step = 0.005; step <= 1; step += 0.005) {
    const candidate = withLightness(hex, original.l + direction * step)
    if (passes(candidate)) return candidate
  }

  // 한 방향으로 못 찾으면 반대 방향도 본다(중간 명도 바탕에서 생길 수 있다).
  for (let step = 0.005; step <= 1; step += 0.005) {
    const candidate = withLightness(hex, original.l - direction * step)
    if (passes(candidate)) return candidate
  }

  return withLightness(hex, direction > 0 ? 1 : 0)
}

/**
 * 채움 위 전경색의 색조 ([[ADR-064]] 결정 1 정정).
 *
 * 순수 흑/백이 아니라 **채움색의 색상(H)을 물려받은** 짙은 색·옅은 색을 쓴다. 주황 채움 위에는
 * 짙은 갈색이, 보라 채움 위에는 짙은 보라가 온다. 이 프로젝트의 옛 기본 팔레트가 쓰던
 * `#2B1206`(주황 채움 위 짙은 갈색)이 같은 발상이었다 — 값을 하나로 고정한 것이 문제였지
 * 색조를 주는 것 자체는 맞았다.
 *
 * 채도는 원 색상보다 크게 낮춘다. 명도를 극단으로 밀면 높은 채도를 표현 범위가 감당하지 못하고,
 * 전경은 배경이 아니라 글자라 색이 튀면 읽기 방해가 된다.
 */
const FOREGROUND_DARK = { lightness: 0.18, chromaScale: 0.35, chromaMax: 0.06 } as const
const FOREGROUND_LIGHT = { lightness: 0.96, chromaScale: 0.25, chromaMax: 0.04 } as const

/**
 * 채움이 이보다 밝으면 밝은 전경을 포기하고 어두운 전경으로 간다([[ADR-064]] 결정 1 재정정).
 *
 * 사용자 결정(2026-07-30): 색 있는 채움 위에는 **아이보리 계열이 기본**이다. 대비 최댓값을
 * 따르면 밝은 주황(`#F58B0F`) 위에 짙은 갈색이 오는데 그 그림이 별로라는 판단이다.
 *
 * 다만 채움이 아주 밝으면 아이보리가 **글자로서 사라진다** — 실측으로 파스텔 하늘(L≈0.90)에
 * 1.32:1, 렌 `third`(L≈0.92)에 1.20:1, 머쉬맘 `secondary`(L≈0.87)에 1.46:1이다. 그건 취향
 * 문제가 아니라 글자가 안 보이는 문제라 그 구간은 어두운 전경으로 넘긴다.
 *
 * 경계값 0.75 는 **3:1 이 나오는 밝기가 아니다**. 실측상 아이보리가 3:1 을 내주는 한계는
 * L≈0.70 부근이고(혼테일 primary L=0.667 → 3.14:1), 머쉬맘 primary 는 L=0.736 으로 그 위라
 * 2.38:1 이다. 사용자가 그 그림을 택했으므로 경계를 0.736 이 들어오도록 잡았고, 대신
 * **L 0.70~0.75 구간은 하한 미달이라 테마별 면제를 명시해야** 지나간다.
 */
const LIGHT_FOREGROUND_MAX_FILL_LIGHTNESS = 0.75

/**
 * 채움 위 전경색 ([[ADR-064]] 결정 1).
 *
 * 흰색도 검정도 기본으로 두지 않는다 — 채움색의 색상(H)을 물려받은 아이보리 또는 짙은 색을
 * 만든다. 어느 쪽으로 갈지는 **채움의 밝기**가 정한다.
 */
function deriveForeground(fill: string): string {
  const base = hexToOklch(fill)
  const goDark = base.l > LIGHT_FOREGROUND_MAX_FILL_LIGHTNESS
  const spec = goDark ? FOREGROUND_DARK : FOREGROUND_LIGHT
  const chroma = Math.min(base.c * spec.chromaScale, spec.chromaMax)

  const tinted = oklchToHex({ l: spec.lightness, c: chroma, h: base.h })

  // 기본 명도에서 모자라면 극단 쪽으로 조금씩 더 민다 — 필요한 만큼만 밀어야 색조가 남는다.
  for (let step = 0; step <= 1; step += 0.01) {
    const lightness = goDark ? spec.lightness - step : spec.lightness + step
    if (lightness < 0 || lightness > 1) break

    const candidate = oklchToHex({ l: lightness, c: chroma, h: base.h })
    if (contrastHex(candidate, fill) >= ON_FILL_MIN + DERIVE_MARGIN) return candidate
  }

  // 끝내 못 맞추면 **흑/백으로 달아나지 않고** 색조를 띤 기본값을 그대로 둔다. 밝은 쪽에서
  // 명도를 끝까지 밀어봐야 대비는 거의 안 오르고(머쉬맘 primary 기준 2.38→2.45) 색조만 씻긴다.
  // 미달 사실은 대비 검사가 보고하고, 받아들일 값이면 테마가 면제를 명시한다.
  return tinted
}

/**
 * 진행률 트랙 — 채움(primary)과 3:1이 나올 때까지 명도를 벌린다([[ADR-064]] 결정 4).
 *
 * 방향을 미리 정하지 않고 **양쪽을 가까운 명도부터** 훑는다. primary 가 밝으면(파스텔) 트랙을
 * 더 밝게 밀어도 대비가 안 나오고 오히려 어두워져야 하는데, 한 방향만 보면 그 경우를 놓친다.
 */
function deriveTrack(surface2: string, primary: string): string {
  if (contrastHex(surface2, primary) >= AA_NON_TEXT) return surface2

  const base = hexToOklch(surface2).l
  for (let step = 0.01; step <= 1; step += 0.01) {
    for (const lightness of [base + step, base - step]) {
      if (lightness < 0 || lightness > 1) continue
      const candidate = withLightness(surface2, lightness)
      if (contrastHex(candidate, primary) >= AA_NON_TEXT) return candidate
    }
  }
  return surface2
}

function withAlpha(hex: string, alpha: number): string {
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()
  return `${hex}${byte}`
}

export function deriveTheme(seed: ThemeSeed): DerivedTheme {
  const { primary, secondary, third, mode } = seed
  const hue = hexToOklch(primary).h
  const ramp = NEUTRAL_RAMP[mode]
  const overrides = seed.overrides ?? {}

  const pick = <K extends keyof DerivedTheme>(key: K, derived: string): string =>
    overrides[key] ?? derived

  const bg = pick('bg', tone(hue, ramp.bg))
  const surface = pick('surface', tone(hue, ramp.surface))
  const surface2 = pick('surface2', tone(hue, ramp.surface2))
  const border = pick('border', tone(hue, ramp.border))
  const borderStrong = pick('borderStrong', tone(hue, ramp.borderStrong))

  const text = pick('text', adjustForContrast(tone(hue, ramp.text), [bg, surface], AA_TEXT))
  const textMuted = pick('textMuted', adjustForContrast(tone(hue, ramp.textMuted), [bg, surface], AA_TEXT))
  const textDisabled = pick(
    'textDisabled',
    adjustForContrast(tone(hue, ramp.textDisabled), [bg, surface], AA_NON_TEXT),
  )

  const error = pick('error', tone(ERROR_HUE, ERROR_RAMP[mode]))

  // accent 4종은 규칙이 완전히 같다 — 채움 / 채움 위 전경 / 틴트 / 잉크.
  const accent = (key: 'primary' | 'secondary' | 'third' | 'error', fill: string) => {
    const tint = pick(`${key}Tint`, mixOklab(fill, surface, TINT_RATIO))
    return {
      on: pick(`on${key[0].toUpperCase()}${key.slice(1)}` as keyof DerivedTheme, deriveForeground(fill)),
      tint,
      ink: pick(`${key}Ink`, adjustForContrast(fill, [surface, tint], AA_TEXT)),
    }
  }

  const primaryParts = accent('primary', primary)
  const secondaryParts = accent('secondary', secondary)
  const thirdParts = accent('third', third)
  const errorParts = accent('error', error)

  const infoTint = pick('infoTint', mixOklab(tone(INFO_HUE, { l: 0.6, c: 0.12 }), surface, TINT_RATIO))

  return {
    bg,
    surface,
    surface2,
    track: pick('track', deriveTrack(surface2, primary)),
    border,
    borderStrong,

    text,
    textMuted,
    textDisabled,

    primary,
    primaryHover: pick('primaryHover', withLightness(primary, hexToOklch(primary).l - 0.1)),
    onPrimary: primaryParts.on,
    primaryTint: primaryParts.tint,
    primaryInk: primaryParts.ink,

    secondary,
    onSecondary: secondaryParts.on,
    secondaryTint: secondaryParts.tint,
    secondaryInk: secondaryParts.ink,

    third,
    onThird: thirdParts.on,
    thirdTint: thirdParts.tint,
    thirdInk: thirdParts.ink,

    error,
    onError: errorParts.on,
    errorTint: errorParts.tint,
    errorInk: errorParts.ink,

    infoTint,
    infoInk: pick('infoInk', adjustForContrast(text, [infoTint], AA_TEXT)),

    mediaSurface: pick('mediaSurface', tone(hue, MEDIA_RAMP.surface)),
    mediaBorder: pick('mediaBorder', tone(hue, MEDIA_RAMP.border)),
    mediaInk: pick('mediaInk', tone(hue, MEDIA_RAMP.ink)),
    mediaInkMuted: pick('mediaInkMuted', tone(hue, MEDIA_RAMP.inkMuted)),

    scrim: pick('scrim', withAlpha(tone(hue, SCRIM_RAMP[mode]), SCRIM_ALPHA[mode])),
    shadowColor: pick('shadowColor', withAlpha(tone(hue, SHADOW_RAMP), SHADOW_ALPHA)),
  }
}

export interface MediaScopeTokens {
  surface: string
  border: string
  text: string
  textMuted: string
  primaryTint: string
  primaryInk: string
  secondaryTint: string
  secondaryInk: string
  thirdTint: string
  thirdInk: string
  errorTint: string
  errorInk: string
}

/**
 * 미디어 스코프 ([[ADR-064]] 결정 5).
 *
 * 일러스트 카드 안은 바탕이 `surface` 가 아니라 `mediaSurface` 라서 틴트·잉크를 **다시 계산**해야
 * 한다. [[ADR-021]] 에 미해결로 남아 있던 카드 내부 배지 AA 미달(레테 3.88:1)이 정확히 이 문제였다.
 * 커스텀 프로퍼티는 선언된 요소에서 `var()` 가 해석되므로, CSS 쪽에서도 스코프 안에 다시 선언해야
 * 새 기준이 반영된다.
 */
export function deriveMediaScope(tokens: DerivedTheme): MediaScopeTokens {
  const surface = tokens.mediaSurface

  const accent = (fill: string): { tint: string; ink: string } => {
    const tint = mixOklab(fill, surface, TINT_RATIO)
    return { tint, ink: adjustForContrast(fill, [surface, tint], AA_TEXT) }
  }

  const primary = accent(tokens.primary)
  const secondary = accent(tokens.secondary)
  const third = accent(tokens.third)
  const error = accent(tokens.error)

  return {
    surface,
    border: tokens.mediaBorder,
    text: tokens.mediaInk,
    textMuted: tokens.mediaInkMuted,
    primaryTint: primary.tint,
    primaryInk: primary.ink,
    secondaryTint: secondary.tint,
    secondaryInk: secondary.ink,
    thirdTint: third.tint,
    thirdInk: third.ink,
    errorTint: error.tint,
    errorInk: error.ink,
  }
}

export interface ContrastCheck {
  token: string
  against: string
  ratio: number
  required: number
  pass: boolean
  /**
   * `required` 는 반드시 통과해야 한다. `advisory` 는 통과를 권하지만 못 지켜도 실패로 세지 않는다 —
   * 비활성 텍스트는 WCAG 1.4.3이 명시적으로 대비 요구에서 제외하는 대상이라, 기존 테마의
   * 사용자 확정 값(예: 머쉬맘 `text-disabled` 2.78:1)을 실패로 몰아 억지로 바꾸게 하지 않는다.
   */
  severity: 'required' | 'advisory'
}

export interface ContrastReport {
  checks: ContrastCheck[]
  /** `required` 중 통과 못 했고 면제되지도 않은 것. 비면 테마를 커밋해도 된다. */
  failures: ContrastCheck[]
  /** `advisory` 중 통과 못 한 것. 사람이 보고 판단한다. */
  warnings: ContrastCheck[]
  /** `required` 를 못 지켰지만 명시적으로 면제한 것. 숨기지 않고 계속 보고한다. */
  waived: ContrastCheck[]
  pass: boolean
}

/**
 * 면제 항목의 식별자 — `"토큰/바탕"` 형식(예: `"track/primary"`).
 *
 * 규칙을 통째로 완화하는 대신 **테마별로 아는 예외만** 빼는 장치다. 이렇게 두면 머쉬맘이
 * 진행률 트랙 대비를 포기해도 뒤에 올 파스텔 primary 테마는 계속 규칙의 보호를 받는다.
 * [[ADR-021]] 의 미달값이 코드 어디에도 표시 없이 방치됐던 전례를 반복하지 않으려는 것이라,
 * 면제한 항목도 리포트에서 사라지지 않고 `waived` 로 계속 나온다.
 */
export type ContrastWaiver = string

/**
 * 테마가 문서화된 대비 요구를 만족하는지 검사한다(`docs/features/theme.md` 34토큰 표).
 * 값을 나열해 비교하는 회귀 테스트를 대체하는 것이 목적이라([[ADR-064]] 결정 11),
 * 테마가 늘어도 검사 항목은 늘지 않는다.
 */
export function checkThemeContrast(
  tokens: DerivedTheme,
  waivers: readonly ContrastWaiver[] = [],
): ContrastReport {
  const checks: ContrastCheck[] = []

  const check = (
    token: keyof DerivedTheme,
    against: keyof DerivedTheme,
    required: number,
    severity: ContrastCheck['severity'] = 'required',
  ): void => {
    const ratio = contrastHex(tokens[token], tokens[against])
    checks.push({ token, against, ratio, required, pass: ratio >= required, severity })
  }

  for (const surfaceKey of ['bg', 'surface'] as const) {
    check('text', surfaceKey, AA_TEXT)
    check('textMuted', surfaceKey, AA_TEXT)
    check('textDisabled', surfaceKey, AA_NON_TEXT, 'advisory')
  }

  const accents = ['primary', 'secondary', 'third', 'error'] as const
  for (const key of accents) {
    const capitalized = `${key[0].toUpperCase()}${key.slice(1)}` as Capitalize<typeof key>
    // 채움 위 전경만 필수 하한이 3:1 이고 AA(4.5:1)는 권고다 — 아이보리를 쓰기로 한 결정의 대가.
    check(`on${capitalized}` as keyof DerivedTheme, key, ON_FILL_MIN)
    check(`on${capitalized}` as keyof DerivedTheme, key, AA_TEXT, 'advisory')
    check(`${key}Ink` as keyof DerivedTheme, 'surface', AA_TEXT)
    check(`${key}Ink` as keyof DerivedTheme, `${key}Tint` as keyof DerivedTheme, AA_TEXT)
  }

  check('infoInk', 'infoTint', AA_TEXT)
  check('track', 'primary', AA_NON_TEXT)
  check('mediaInk', 'mediaSurface', AA_TEXT)
  check('mediaInkMuted', 'mediaSurface', AA_TEXT)

  const waiverSet = new Set(waivers)
  const isWaived = (entry: ContrastCheck): boolean => waiverSet.has(`${entry.token}/${entry.against}`)

  const unmet = checks.filter((entry) => !entry.pass)
  const required = unmet.filter((entry) => entry.severity === 'required')

  const failures = required.filter((entry) => !isWaived(entry))
  const waived = required.filter(isWaived)
  const warnings = unmet.filter((entry) => entry.severity === 'advisory')

  return { checks, failures, warnings, waived, pass: failures.length === 0 }
}
