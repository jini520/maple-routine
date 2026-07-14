export type ThemeName = '레테' | '렌' | '머쉬맘' | '혼테일'

export interface ThemeTokens {
  bg: string
  surface: string
  surface2: string
  border: string
  borderStrong: string
  primary: string
  primaryHover: string
  primaryText: string
  secondary: string
  secondaryText: string
  third: string
  thirdText: string
  infoTint: string
  error: string
  text: string
  textMuted: string
  textDisabled: string
}

export type JobThemes = Record<ThemeName, ThemeTokens>
