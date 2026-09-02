/**
 * 색 공간·대비 프리미티브.
 *
 * 테마 토큰 파생(`theme-derive.ts`)과 대비 검증 테스트가 함께 쓴다. 외부 색 라이브러리를 들이지
 * 않고 직접 구현하는 이유는 두 가지다. (1) 필요한 연산이 OKLab 변환·WCAG 대비·믹스 셋뿐이고,
 * (2) 브라우저의 `color-mix(in oklab,...)`와 **같은 색 공간**에서 계산해야
 * 검증 결과가 실제 화면과 일치하는데, 그 보장을 남의 구현에 맡기고 싶지 않다.
 *
 * OKLab 변환 행렬은 Björn Ottosson의 공개 정의를 그대로 쓴다(CSS Color 4가 채택한 것과 동일).
 */

export interface Rgb {
  /** 0-255 */
  r: number
  g: number
  b: number
}

export interface Oklch {
  /** 명도 0-1 */
  l: number
  /** 채도 0-약0.4 */
  c: number
  /** 색상 0-360(도). 무채색이면 의미 없음 */
  h: number
}

const HEX_PATTERN = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function parseHex(hex: string): Rgb {
  const match = HEX_PATTERN.exec(hex.trim())
  if (match === null) {
    throw new Error(`색 표기가 올바르지 않습니다: ${hex}`)
  }

  const body = match[1]
  const full = body.length === 3 ? body.replace(/./g, (ch) => ch + ch) : body

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  }
}

export function toHex(rgb: Rgb): string {
  const channel = (value: number): string =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()

  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`
}

/** sRGB 채널(0-1) → 선형 광량. WCAG·OKLab 양쪽이 이 선형화를 전제한다. */
function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function fromLinear(linear: number): number {
  return linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055
}

/** WCAG 2.x 상대 휘도. */
export function relativeLuminance(rgb: Rgb): number {
  const r = toLinear(rgb.r / 255)
  const g = toLinear(rgb.g / 255)
  const b = toLinear(rgb.b / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x 명도 대비비. 항상 1 이상이며 순서와 무관하다. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/** hex 두 개의 대비비 — 호출부 대부분이 hex를 들고 있어 얇게 감싼다. */
export function contrastHex(a: string, b: string): number {
  return contrastRatio(parseHex(a), parseHex(b))
}

interface Oklab {
  l: number
  a: number
  b: number
}

function rgbToOklab(rgb: Rgb): Oklab {
  const r = toLinear(rgb.r / 255)
  const g = toLinear(rgb.g / 255)
  const b = toLinear(rgb.b / 255)

  const lms0 = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const lms1 = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const lms2 = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const l = Math.cbrt(lms0)
  const m = Math.cbrt(lms1)
  const s = Math.cbrt(lms2)

  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

/** OKLab → 선형 sRGB. 표현 범위를 벗어난 값도 그대로 돌려준다(가뭄 판정에 필요). */
function oklabToLinearRgb(lab: Oklab): [number, number, number] {
  const l = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b
  const m = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b
  const s = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b

  const l3 = l ** 3
  const m3 = m ** 3
  const s3 = s ** 3

  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]
}

function oklabToRgb(lab: Oklab): Rgb {
  const [r, g, b] = oklabToLinearRgb(lab)
  return {
    r: Math.min(255, Math.max(0, Math.round(fromLinear(r) * 255))),
    g: Math.min(255, Math.max(0, Math.round(fromLinear(g) * 255))),
    b: Math.min(255, Math.max(0, Math.round(fromLinear(b) * 255))),
  }
}

const GAMUT_EPSILON = 1e-4

function isInGamut(lab: Oklab): boolean {
  return oklabToLinearRgb(lab).every(
    (channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON,
  )
}

function toOklab(oklch: Oklch): Oklab {
  const radians = (oklch.h * Math.PI) / 180
  return {
    l: Math.min(1, Math.max(0, oklch.l)),
    a: Math.max(0, oklch.c) * Math.cos(radians),
    b: Math.max(0, oklch.c) * Math.sin(radians),
  }
}

export function hexToOklch(hex: string): Oklch {
  const lab = rgbToOklab(parseHex(hex))
  const c = Math.hypot(lab.a, lab.b)
  const h = c < 1e-7 ? 0 : ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360
  return { l: lab.l, c, h }
}

/**
 * OKLCH → hex. 표현 범위(sRGB) 밖이면 **채도를 줄여** 안으로 들여보낸다.
 *
 * 채널을 그냥 잘라내면 색상(H)까지 틀어진다. 예를 들어 머쉬맘 primary(`#F58B0F`, H≈60°)를
 * 어둡게 밀면 그 채도로는 sRGB 밖이라 클램프 결과가 H≈47°가 돼 "색상은 유지하고 명도만 조정"이라는
 * `*-ink` 파생 규칙이 깨진다. 명도·색상을 고정하고 채도만 이분 탐색으로
 * 낮추는 것이 CSS Color 4의 가뭄 매핑과 같은 방향이다.
 */
export function oklchToHex(oklch: Oklch): string {
  if (isInGamut(toOklab(oklch))) {
    return toHex(oklabToRgb(toOklab(oklch)))
  }

  let low = 0
  let high = Math.max(0, oklch.c)
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2
    if (isInGamut(toOklab({ ...oklch, c: mid }))) {
      low = mid
    } else {
      high = mid
    }
  }

  return toHex(oklabToRgb(toOklab({ ...oklch, c: low })))
}

/** 색상(H)·채도(C)는 그대로 두고 명도만 바꾼다. `*-ink` 파생의 기본 연산. */
export function withLightness(hex: string, lightness: number): string {
  const oklch = hexToOklch(hex)
  return oklchToHex({ ...oklch, l: lightness })
}

/** 채도만 바꾼다. 명도를 극단으로 밀 때 표현 범위를 벗어나는 것을 완화하는 데 쓴다. */
export function withChroma(hex: string, chroma: number): string {
  const oklch = hexToOklch(hex)
  return oklchToHex({ ...oklch, c: chroma })
}

/**
 * CSS `color-mix(in oklab, base <ratio>%, other)` 와 같은 계산.
 * `ratio` 는 **base 의 비중**(0-1)이다.
 */
export function mixOklab(base: string, other: string, ratio: number): string {
  const t = Math.min(1, Math.max(0, ratio))
  const a = rgbToOklab(parseHex(base))
  const b = rgbToOklab(parseHex(other))

  return toHex(
    oklabToRgb({
      l: a.l * t + b.l * (1 - t),
      a: a.a * t + b.a * (1 - t),
      b: a.b * t + b.b * (1 - t),
    }),
  )
}

/** `#rrggbb` 를 `rgba()` 로. 네이티브 그라데이션은 알파를 값으로 받아야 한다. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex)
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`
}
