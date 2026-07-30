export type ThemeName = '레테' | '렌' | '머쉬맘' | '혼테일'

export type ThemeMode = 'light' | 'dark'

/**
 * 테마 34토큰 ([[ADR-064]]).
 *
 * 이름 규칙 — `on-X` 는 X 채움 **위**의 전경, `X-ink` 는 X 계열 **텍스트/아이콘**,
 * `X-tint` 는 X 계열 **옅은 배경**이다. 자세한 용도·파생 규칙은 `docs/features/theme.md`.
 */
export interface ThemeTokens {
  /** 페이지 배경 */
  bg: string
  /** 카드/표면 */
  surface: string
  /** 2단계 표면 */
  surface2: string
  /** 진행률 바·토글 트랙 (표면 톤을 따른다) */
  track: string
  /** 기본 보더 */
  border: string
  /** 강조 보더 */
  borderStrong: string

  /** 기본 텍스트 */
  text: string
  /** 보조 텍스트 */
  textMuted: string
  /** 비활성 텍스트 */
  textDisabled: string

  /** 브랜드 채움 배경 */
  primary: string
  /** hover/눌림 배경 */
  primaryHover: string
  /** primary 채움 위 전경 */
  onPrimary: string
  /** 배지·활성 탭·선택 카드 배경 */
  primaryTint: string
  /** primary 계열 텍스트·아이콘·링크 */
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

  /** 정보성 배경 틴트 */
  infoTint: string
  /** `infoTint` 위 텍스트·아이콘 */
  infoInk: string

  /** 일러스트 카드 배경 */
  mediaSurface: string
  /** 일러스트 카드 보더 */
  mediaBorder: string
  /** 일러스트 위 이름 텍스트 */
  mediaInk: string
  /** 일러스트 위 보조 텍스트 */
  mediaInkMuted: string

  /** 모달·바텀시트 오버레이 — 반투명이라 8자리 hex(#RRGGBBAA) */
  scrim: string
  /** 그림자·text-shadow 색 — 반투명이라 8자리 hex(#RRGGBBAA) */
  shadowColor: string
}

/**
 * `job-themes.json` 한 항목. 34토큰 + `mode`.
 *
 * `mode` 는 색이 아니라 **의도**다 — 상태바(`native/status-bar.ts`)·하단 내비 글리프
 * (`native/system-bars.ts`) 명암을 정한다. 자동 계산하지 않고 테마마다 사람이 명시한다
 * ([[ADR-064]] 결정 8) — 파스텔처럼 경계가 애매한 테마에서 오분류를 막기 위해서다.
 */
export interface ThemeDefinition extends ThemeTokens {
  mode: ThemeMode
}

export type JobThemes = Record<ThemeName, ThemeDefinition>
