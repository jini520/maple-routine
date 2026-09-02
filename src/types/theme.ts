/**
 * 등록된 테마 이름. `job-themes.json` 의 키에서 추론한다.
 *
 * 유니온을 손으로 적지 않는 이유는 테마를 수십 개로 늘릴 계획이기 때문이다. 값 목록·타입 가드·
 * 선택 UI·라이트/다크 판정이 모두 그 JSON 하나를 따라가므로, 테마 추가는 **JSON 한 블록**이다.
 * (`typeof import(...)` 는 타입 자리에서만 쓰여 런타임 import 를 만들지 않는다.)
 */
export type ThemeName = keyof typeof import('../data/job-themes.json')

export type ThemeMode = 'light' | 'dark'

/**
 * 테마가 속한 분류.
 *
 * **한 테마는 하나만 갖는다**. 머쉬맘·혼테일은 보스이기도 하지만 "앱의 기본 라이트/다크"라는
 * 역할이 우선이라 `기본` 에만 둔다. 겹침을 허용하면 배열이 되고 같은 테마가 목록에 두 번 나온다.
 * 소속은 색에서 유도할 수 없는 **게임 도메인**이라 사람이 확인해 넣는다.
 *
 * 표시 순서는 이 유니온이 아니라 `theme-registry` 의 `THEME_CATEGORIES` 가 정한다.
 */
export type ThemeCategory = '기본' | '직업' | '보스'

/**
 * 테마 38토큰 (`rise`/`fall` 2쌍은).
 *
 * 이름 규칙. `on-X` 는 X 채움 **위**의 전경, `X-ink` 는 X 계열 **텍스트/아이콘**,
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

  /** 값이 **오른** 것을 말하는 칩 배경 */
  riseTint: string
  /** `riseTint` 위 텍스트·아이콘 */
  riseInk: string
  /** 값이 **내린** 것을 말하는 칩 배경 */
  fallTint: string
  /** `fallTint` 위 텍스트·아이콘 */
  fallInk: string

  /** 일러스트 카드 배경 */
  mediaSurface: string
  /** 일러스트 카드 보더 */
  mediaBorder: string
  /** 일러스트 위 이름 텍스트 */
  mediaInk: string
  /** 일러스트 위 보조 텍스트 */
  mediaInkMuted: string

  /** 모달·바텀시트 오버레이. 반투명이라 8자리 hex(#RRGGBBAA) */
  scrim: string
  /** 그림자·text-shadow 색. 반투명이라 8자리 hex(#RRGGBBAA) */
  shadowColor: string
}

/**
 * 테마 배경 이미지.
 *
 * 크기·위치·어둡기·페이드를 **값으로** 갖는 이유는 그림을 고치는 대신 JSON 한 줄로 조절하기
 * 위해서다. "더 어둡게"는 `dim`, "아래쪽이 보이게"는 `position` 이다. 코드를 건드릴 일이
 * 없어야 다른 테마에도 값 한 블록으로 붙는다.
 */
export interface ThemeBackground {
  /** `src/assets/themes/<slug>.webp` 의 슬러그. 번들 경로가 아니다 */
  image: string
  /** `background-size` (예: `cover`) */
  size: string
  /** `background-position` (예: `center`) */
  position: string
  /** 이미지 위에 덮는 검정 불투명도 0~1. 그림 위에서 텍스트가 읽히게 한다 */
  dim: number
  /**
   * 위쪽에서 `--color-bg` 로 페이드되는 높이.
   *
   * 헤더가 같은 그림을 이어 그리게 되면서(결정 5-1) 이음매가 사라져 혼테일은 `0px` 다.
   * 다른 테마가 상단을 눌러 쓰고 싶으면 값으로 남아 있다.
   */
  fadeTop: string
}

/**
 * `job-themes.json` 한 항목. 38토큰 + `mode` + 선택 `background`.
 *
 * `mode` 는 색이 아니라 **의도**다. 상태바(`native/status-bar.ts`)·하단 내비 글리프
 * (`native/system-bars.ts`) 명암을 정한다. 자동 계산하지 않고 테마마다 사람이 명시한다
 * 파스텔처럼 경계가 애매한 테마에서 오분류를 막기 위해서다.
 */
export interface ThemeDefinition extends ThemeTokens {
  mode: ThemeMode
  /** 선택 목록의 섹션을 정한다 */
  category: ThemeCategory
  /** 없으면 배경은 `bg` 단색이다. 지금은 **어느 테마도 갖지 않는다**(둘 다 뗌) */
  background?: ThemeBackground
}

export type JobThemes = Record<ThemeName, ThemeDefinition>
