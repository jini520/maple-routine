import { describe, expect, it } from 'vitest'
import jobThemesData from '../job-themes.json'
import { contrastHex, hexToOklch } from '../../lib/color'
import { THEME_TOKEN_KEYS, measureThemeContrast } from '../../lib/theme-derive'
import type { JobThemes, ThemeName } from '../../types/theme'

const JOB_THEMES = jobThemesData as JobThemes
const NAMES = Object.keys(JOB_THEMES) as ThemeName[]

/**
 * 값을 나열해 비교하던 회귀 테스트를 **스키마 + 파생 규칙** 검증으로 바꿨다([[ADR-064]] 결정 11).
 * 예전 방식은 4테마 × 17값을 하드코딩해 비교했는데, 테마를 수십 개로 늘리면 테스트가 같은 속도로
 * 늘어난다. 아래 검사들은 테마가 몇 개든 항목 수가 그대로다.
 *
 * 대비비는 **관문이 아니다**([[ADR-064]] 판단 순서) — 전체 색감과 캐릭터의 컬러 컨셉이 최우선이라,
 * 여기서도 특정 대비선을 강제하지 않는다. 다만 "이 색을 글자로 쓸 수 있게 만든 값"인 토큰
 * (`text`·`text-muted`·`*-ink`)은 그 목적을 실제로 달성해야 하므로 그것만 확인한다.
 */
describe('job-themes.json — 스키마', () => {
  it('테마가 하나 이상 있다', () => {
    expect(NAMES.length).toBeGreaterThan(0)
  })

  it.each(NAMES)('%s: 34개 토큰을 빠짐없이 갖는다', (name) => {
    const tokens = JOB_THEMES[name] as unknown as Record<string, string>
    for (const key of THEME_TOKEN_KEYS) {
      expect(tokens[key], `${name}.${key}`).toBeDefined()
    }
  })

  // 색이 아닌 필드는 셋뿐이다 — 필수 `mode`·`category`([[ADR-104]] 결정 1)와 선택
  // `background`([[ADR-088]] 결정 3).
  it.each(NAMES)('%s: 토큰 외에 mode·category 와 선택 background 만 더 갖는다', (name) => {
    const extra = Object.keys(JOB_THEMES[name]).filter(
      (key) => !(THEME_TOKEN_KEYS as readonly string[]).includes(key),
    )
    expect(extra).toContain('mode')
    expect(extra).toContain('category')
    expect(
      extra.filter((key) => key !== 'mode' && key !== 'category' && key !== 'background'),
    ).toEqual([])
  })

  // 소속은 게임 도메인이라 사람이 정한다([[ADR-006]]) — 테스트는 값이 셋 중 하나인지만 본다.
  it.each(NAMES)('%s: category 가 기본·직업·보스 중 하나다', (name) => {
    expect(['기본', '직업', '보스']).toContain(JOB_THEMES[name].category)
  })

  /**
   * 배경 이미지는 **그림을 고치는 대신 값을 고치는** 구조라(크기·위치·어둡기·페이드),
   * 필드가 빠지면 CSS 폴백으로 조용히 흘러 조절이 안 먹는 것처럼 보인다. 다섯 필드를 다 요구한다.
   */
  it.each(NAMES)('%s: background 가 있으면 다섯 필드를 다 갖는다', (name) => {
    const background = JOB_THEMES[name].background
    if (background === undefined) return

    expect(typeof background.image).toBe('string')
    expect(typeof background.size).toBe('string')
    expect(typeof background.position).toBe('string')
    expect(typeof background.fadeTop).toBe('string')
    expect(background.dim).toBeGreaterThanOrEqual(0)
    expect(background.dim).toBeLessThanOrEqual(1)
  })

  it.each(NAMES)('%s: mode 가 light 또는 dark 다', (name) => {
    expect(['light', 'dark']).toContain(JOB_THEMES[name].mode)
  })

  it.each(NAMES)('%s: 모든 색 값이 hex 표기다', (name) => {
    const tokens = JOB_THEMES[name] as unknown as Record<string, string>
    for (const key of THEME_TOKEN_KEYS) {
      // scrim·shadowColor 는 반투명이라 8자리다.
      expect(tokens[key], `${name}.${key}`).toMatch(/^#[0-9A-F]{6}([0-9A-F]{2})?$/)
    }
  })
})

describe('job-themes.json — 파생 규칙', () => {
  const ACCENTS = ['primary', 'secondary', 'third', 'error'] as const

  // "이 색을 글자로 쓸 수 있게 만든 값"은 그 목적을 달성해야 한다.
  it.each(NAMES)('%s: 본문·보조 텍스트가 배경 대비 AA 를 지킨다', (name) => {
    const theme = JOB_THEMES[name]
    for (const surface of [theme.bg, theme.surface]) {
      expect(contrastHex(theme.text, surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrastHex(theme.textMuted, surface)).toBeGreaterThanOrEqual(4.5)
    }
  })

  // 잉크는 accent 원색을 지킨다 — 보이는 색은 건드리지 않고, 안 보이는 색만 보정한다.
  // 잉크가 놓이는 바탕은 표면과 틴트 배지 **양쪽**이라 둘 다 봐야 한다.
  it.each(NAMES)('%s: 두 바탕에서 다 보이는 accent 는 잉크에서도 원색 그대로다', (name) => {
    const theme = JOB_THEMES[name] as unknown as Record<string, string>
    for (const accent of ACCENTS) {
      const backgrounds = [theme.surface, theme[`${accent}Tint`]]
      const ink = theme[`${accent}Ink`]

      if (backgrounds.every((bg) => contrastHex(theme[accent], bg) >= 2)) {
        expect(ink, `${name}.${accent}Ink`).toBe(theme[accent])
      } else {
        for (const bg of backgrounds) {
          expect(contrastHex(ink, bg), `${name}.${accent}Ink`).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it.each(NAMES)('%s: 일러스트 위 텍스트가 미디어 표면 대비 AA 를 지킨다', (name) => {
    const theme = JOB_THEMES[name]
    expect(contrastHex(theme.mediaInk, theme.mediaSurface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastHex(theme.mediaInkMuted, theme.mediaSurface)).toBeGreaterThanOrEqual(4.5)
  })

  // 채움 위 전경은 색감이 정한다 — 대비는 강제하지 않되, 흑백 이지선다로 퇴화하지는 않아야 한다.
  // 연한 전경은 **테마의 색 하나**이고(브랜드 색상), 그게 사라지는 채움에서만 짙은 색으로 넘어간다.
  it.each(NAMES)('%s: on-* 이 순수 흑/백이 아니다', (name) => {
    const theme = JOB_THEMES[name] as unknown as Record<string, string>
    for (const accent of ACCENTS) {
      const on = theme[`on${accent[0].toUpperCase()}${accent.slice(1)}`]
      expect(on, `${name}.on-${accent}`).not.toBe('#000000')
      expect(on, `${name}.on-${accent}`).not.toBe('#FFFFFF')
    }
  })

  it.each(NAMES)('%s: 연한 전경은 테마당 하나이고 브랜드 색상을 따른다', (name) => {
    const theme = JOB_THEMES[name] as unknown as Record<string, string>
    const brand = hexToOklch(theme.primary).h

    const light = ACCENTS
      .map((accent) => theme[`on${accent[0].toUpperCase()}${accent.slice(1)}`])
      .filter((hex) => hexToOklch(hex).l > 0.5)

    expect(new Set(light).size, `${name}: 연한 전경이 여러 톤으로 흩어짐`).toBeLessThanOrEqual(1)
    for (const hex of light) {
      const gap = Math.abs(((hexToOklch(hex).h - brand + 540) % 360) - 180)
      expect(gap, `${name}: 브랜드 색상에서 벗어남`).toBeLessThan(10)
    }
  })

  it.each(NAMES)('%s: track 이 표면 톤(surface-2)을 따른다', (name) => {
    expect(JOB_THEMES[name].track).toBe(JOB_THEMES[name].surface2)
  })

  it.each(NAMES)('%s: 다크 테마는 배경이 어둡고, 라이트 테마는 밝다', (name) => {
    const theme = JOB_THEMES[name]
    const lightness = hexToOklch(theme.bg).l
    expect(theme.mode === 'dark' ? lightness < 0.4 : lightness > 0.6, `${name}.bg L=${lightness}`).toBe(true)
  })
})

describe('job-themes.json — 대비 계측', () => {
  // 관문이 아니라 기록이다. 기준선 아래 항목이 있어도 실패시키지 않되, 계측 자체는 동작해야 한다.
  it.each(NAMES)('%s: 모든 색 쌍의 대비를 잴 수 있다', (name) => {
    const report = measureThemeContrast(JOB_THEMES[name])
    expect(report.measurements.length).toBeGreaterThan(10)
    expect(report.measurements.every((entry) => Number.isFinite(entry.ratio) && entry.ratio >= 1)).toBe(true)
  })
})
