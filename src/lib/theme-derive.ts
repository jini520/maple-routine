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

import type { ThemeMode, ThemeTokens } from '../types/theme'
import { contrastHex, hexToOklch, mixOklab, oklchToHex, withLightness } from './color'

/**
 * 34토큰 스키마는 `types/theme.ts` 가 단일 진실 공급원이다(프로젝트 규칙: 타입은 `types/`).
 * 여기서는 파생 규칙만 다루고, `DerivedTheme` 은 그 스키마의 별칭으로 남겨 호출부 문맥을 살린다.
 */
export type { ThemeMode } from '../types/theme'
export type DerivedTheme = ThemeTokens

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

/**
 * 대비비는 **참고 수치**다 ([[ADR-064]] 결정 1·4·11 재정정, 사용자 결정 2026-07-30).
 *
 * 이 모듈은 대비를 관문으로 쓰지 않는다. 판단의 최우선은 **전체 색감과 캐릭터의 컬러 컨셉**이고,
 * 대비는 그다음에 참고한다. 앞서 대비를 필수 기준으로 세웠더니 아름다운 선택이 번번이 "면제"로
 * 밀려났는데, 그건 틀이 뒤집힌 것이었다 — 예외로 다뤄야 할 쪽은 아름다움이 아니다.
 *
 * 그래서 면제(waiver) 장치를 걷어냈다. 통과/실패가 없으니 면제할 것도 없다.
 * `measureThemeContrast` 가 수치를 재서 보여주고, 판단은 사람이 한다.
 */
const AA_TEXT = 4.5
const AA_NON_TEXT = 3

/**
 * 색을 만들 때만 쓰는 여유분. 참고선에 정확히 붙은 값(4.50:1)은 우연히 걸친 것처럼 읽히고
 * 값을 조금만 손봐도 넘어가므로, 만들 때는 조금 넘겨 잡는다.
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
 * 다만 채움이 아주 밝으면 아이보리가 **글자로서 사라진다** — 파스텔 하늘(L≈0.90) 위 아이보리는
 * 흰 종이에 흰 글씨다. 그건 취향의 문제가 아니라 글자가 없어지는 문제라 그 구간만 짙은 전경으로
 * 넘긴다. 경계는 대비 수치가 아니라 **밝기**로 잡는다 — 색을 색으로 판단한다는 뜻이고,
 * 어느 대비선을 넘느냐로 그림이 바뀌지 않게 하려는 것이다.
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

  // 대비를 맞추려고 명도를 더 밀지 않는다. 밝은 쪽에서 끝까지 밀어봐야 대비는 거의 안 오르고
  // (머쉬맘 primary 기준 2.38→2.45) 색조만 씻겨 흰색에 가까워진다 — 색감이 우선이므로
  // 채움색에서 온 색조를 그대로 둔다. 실제 수치는 `measureThemeContrast` 가 보고한다.
  return oklchToHex({ l: spec.lightness, c: chroma, h: base.h })
}

/**
 * 진행률 트랙 ([[ADR-064]] 결정 4 재정정, 사용자 결정 2026-07-30).
 *
 * **표면 톤(`surface-2`)을 그대로 쓴다.** 앞서 채움과 3:1 이 나올 때까지 명도를 벌리게 했더니
 * 머쉬맘에서 크림색 트랙이 어두운 올리브로 밀려 카드 인상이 망가졌고, 그걸 되돌리려면 "면제"가
 * 필요했다. 색감이 우선이므로 트랙은 표면 톤을 따르고, 채움과의 대비는 리포트가 수치로 알려준다.
 *
 * 토큰을 따로 두는 이유는 값이 달라서가 아니라 **역할이 달라서**다 — 특정 테마에서 진행률이
 * 안 읽히면 그 테마만 `track` 을 덮으면 되고, `surface-2` 를 쓰는 다른 자리는 안 건드린다.
 */
function deriveTrack(surface2: string): string {
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
    track: pick('track', deriveTrack(surface2)),
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

export type MediaScopeTokens = {
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

export interface ContrastMeasurement {
  token: string
  against: string
  ratio: number
  /** 참고선(WCAG AA) — 넘어야 하는 선이 아니라 견줘보는 눈금이다. */
  reference: number
  meets: boolean
}

export interface ContrastReport {
  measurements: ContrastMeasurement[]
  /** 참고선 아래인 항목. 통과/실패가 아니라 **사람이 볼 목록**이다. */
  below: ContrastMeasurement[]
}

/**
 * 테마의 주요 색 쌍 대비를 **재서 보여준다**([[ADR-064]] 결정 11 재정정).
 *
 * 통과/실패를 매기지 않는다. 판단의 최우선은 전체 색감과 캐릭터의 컬러 컨셉이고 대비는 참고
 * 수치라, 이 함수의 일은 "이 조합은 몇 대 일이다"를 정확히 말해주는 것까지다. 어느 값을 받아들일지는
 * 수치와 실제 그림을 함께 보고 사람이 정한다.
 */
export function measureThemeContrast(tokens: DerivedTheme): ContrastReport {
  const measurements: ContrastMeasurement[] = []

  const measure = (
    token: keyof DerivedTheme,
    against: keyof DerivedTheme,
    reference: number,
  ): void => {
    const ratio = contrastHex(tokens[token], tokens[against])
    measurements.push({ token, against, ratio, reference, meets: ratio >= reference })
  }

  for (const surfaceKey of ['bg', 'surface'] as const) {
    measure('text', surfaceKey, AA_TEXT)
    measure('textMuted', surfaceKey, AA_TEXT)
    measure('textDisabled', surfaceKey, AA_NON_TEXT)
  }

  const accents = ['primary', 'secondary', 'third', 'error'] as const
  for (const key of accents) {
    const capitalized = `${key[0].toUpperCase()}${key.slice(1)}` as Capitalize<typeof key>
    measure(`on${capitalized}` as keyof DerivedTheme, key, AA_TEXT)
    measure(`${key}Ink` as keyof DerivedTheme, 'surface', AA_TEXT)
    measure(`${key}Ink` as keyof DerivedTheme, `${key}Tint` as keyof DerivedTheme, AA_TEXT)
  }

  measure('infoInk', 'infoTint', AA_TEXT)
  measure('track', 'primary', AA_NON_TEXT)
  measure('mediaInk', 'mediaSurface', AA_TEXT)
  measure('mediaInkMuted', 'mediaSurface', AA_TEXT)

  return { measurements, below: measurements.filter((entry) => !entry.meets) }
}
