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
    infoTint: '#C9D6F2',
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
    infoTint: '#C9EEF2',
    error: '#B91C1C',
    text: '#171721',
    textMuted: '#525475',
    textDisabled: '#8A8089',
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
  'infoTint',
  'error',
  'text',
  'textMuted',
  'textDisabled',
]

describe('job-themes.json', () => {
  it('정확히 레테/렌 두 키만 가진다', () => {
    expect(Object.keys(jobThemes).sort()).toEqual(['레테', '렌'].sort())
  })

  it.each(['레테', '렌'] as const)('%s 테마가 ThemeTokens의 14개 필드를 전부 가진다', (themeName) => {
    const theme = jobThemes[themeName] as Record<string, string>
    expect(Object.keys(theme).sort()).toEqual([...TOKEN_FIELDS].sort())
  })

  it.each(['레테', '렌'] as const)('%s 테마의 값이 docs/UI_GUIDE.md 표와 정확히 일치한다', (themeName) => {
    expect(jobThemes[themeName]).toEqual(EXPECTED[themeName])
  })
})
