import { describe, expect, it } from 'vitest'
import jobThemes from '../job-themes.json'

// docs/UI_GUIDE.md "테마 시스템" 표에서 그대로 옮긴 기댓값 — 데이터가 몰래 바뀌는 것을 막기 위한 회귀 테스트.
const EXPECTED = {
  레테: {
    bg: '#0C080F',
    surface: '#1A1720',
    surface2: '#28232E',
    border: '#37323E',
    borderStrong: '#54444E',
    primary: '#9975B3',
    primaryHover: '#85639F',
    primaryText: '#61417B',
    secondary: '#D1C093',
    secondaryText: '#D1C093',
    third: '#D8608F',
    thirdText: '#DA6995',
    infoTint: '#262A3A',
    error: '#D8608F',
    text: '#E8DFEC',
    textMuted: '#B89CBD',
    textDisabled: '#8A758D',
  },
  렌: {
    bg: '#F6F5F5',
    surface: '#FFFFFF',
    surface2: '#E5E6E9',
    border: '#DBD3D6',
    borderStrong: '#C8C1C6',
    primary: '#DC171D',
    primaryHover: '#B33946',
    primaryText: '#803440',
    secondary: '#437B71',
    secondaryText: '#3E7369',
    third: '#C9EEF2',
    thirdText: '#21808A',
    infoTint: '#E4F6F8',
    error: '#A31118',
    text: '#171721',
    textMuted: '#525475',
    textDisabled: '#8A8089',
  },
  머쉬맘: {
    bg: '#F2F0E2',
    surface: '#FDFCF6',
    surface2: '#E4E1CE',
    border: '#CFC9AE',
    borderStrong: '#A3996E',
    primary: '#F58B0F',
    primaryHover: '#C55907',
    primaryText: '#9C4304',
    secondary: '#F7D00D',
    secondaryText: '#7A5E00',
    third: '#CA763A',
    thirdText: '#8F4E1F',
    infoTint: '#FBF3D0',
    error: '#B3200B',
    text: '#241208',
    textMuted: '#645C42',
    textDisabled: '#9A9070',
  },
  혼테일: {
    bg: '#0B0B0B',
    surface: '#241110',
    surface2: '#362120',
    border: '#524344',
    borderStrong: '#695E5F',
    primary: '#E86A16',
    primaryHover: '#C34204',
    primaryText: '#F09A55',
    secondary: '#7B777A',
    secondaryText: '#B8B2B4',
    third: '#936E68',
    thirdText: '#C79A92',
    infoTint: '#3A3235',
    error: '#E85447',
    text: '#E6E1E2',
    textMuted: '#9F9594',
    textDisabled: '#7A6E6F',
  },
} as const

const TOKEN_FIELDS = [
  'bg',
  'surface',
  'surface2',
  'border',
  'borderStrong',
  'primary',
  'primaryHover',
  'primaryText',
  'secondary',
  'secondaryText',
  'third',
  'thirdText',
  'infoTint',
  'error',
  'text',
  'textMuted',
  'textDisabled',
]

describe('job-themes.json', () => {
  it('정확히 레테/렌/머쉬맘/혼테일 네 키만 가진다', () => {
    expect(Object.keys(jobThemes).sort()).toEqual(['레테', '렌', '머쉬맘', '혼테일'].sort())
  })

  it.each(['레테', '렌', '머쉬맘', '혼테일'] as const)(
    '%s 테마가 ThemeTokens의 17개 필드를 전부 가진다',
    (themeName) => {
      const theme = jobThemes[themeName] as Record<string, string>
      expect(Object.keys(theme).sort()).toEqual([...TOKEN_FIELDS].sort())
    },
  )

  it.each(['레테', '렌', '머쉬맘', '혼테일'] as const)(
    '%s 테마의 값이 docs/UI_GUIDE.md 표와 정확히 일치한다',
    (themeName) => {
      expect(jobThemes[themeName]).toEqual(EXPECTED[themeName])
    },
  )
})
