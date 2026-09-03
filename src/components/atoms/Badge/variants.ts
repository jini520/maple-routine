/**
 * 배지의 **외형 표** 17종과 크기·두께 계단. 난이도 색은 게임 안의 값이다.
 *
 * `Badge.tsx` 와 파일이 나뉘어 있다. 스타일 표와 컴포넌트 코드를 섞지 않는다.
 * 표가 한 곳이라 같은 자리에 서는 배지의 크기가 어긋날 수 없다.
 */
import { type TextStyle, type ViewStyle } from 'react-native'

import type { BossDifficulty } from '../../../types'

/** variant 하나가 쥐는 것. 평면 배지는 `className` 만 쓰고, 그라디언트 배지가 나머지를 쓴다. */
export interface BadgeVariantStyle {
  /** 평면 배경과 글자색. 테마 토큰이거나 리터럴 hex 다. */
  className?: string
  /** 위에서 아래로 흐르는 두 색. 있으면 상자가 `LinearGradient` 가 된다. */
  gradient?: readonly [string, string]
  /** 그라디언트 배지의 테두리. 색이 게임 값이라 클래스가 아니라 값으로 준다. */
  border?: Pick<ViewStyle, 'borderWidth' | 'borderColor'>
  /** 클래스로 못 주는 글자색·그림자. 그라디언트 배지만 쓴다. */
  textStyle?: TextStyle
  /** 테두리를 클래스로 그리는 variant 가 여백에서 뺄 폭. 색이 테마 토큰이라 값으로 못 준다. */
  borderWidth?: number
  /** `default` 의 글자 크기를 덮는다. `mini` 는 안 먹는다. */
  text?: string
  /** 안 적으면 `semibold` 다. */
  weight?: BadgeWeight
}

/**
 * `0 1px 1px rgba(0,0,0,α)`. 난이도 셋의 그림자가 색만 다르고 오프셋·번짐이 같다.
 *
 * @param color 알파를 포함한 그림자 색. 진하기를 여기서 정한다(`rgba(0,0,0,0.3)`).
 */
function dropShadow(color: string): TextStyle {
  return { textShadowColor: color, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }
}

/**
 * 난이도 다섯은 그라디언트·테두리·그림자를 함께 갖고 글자가 한 단 작다.
 *
 * 넷 다 위치 인자라 호출부만 보면 무엇이 무엇인지 안 보인다. 그래서 여기 적는다.
 *
 * @param gradient 위에서 아래로 흐르는 두 색. 상자가 `LinearGradient` 가 된다
 * @param borderColor 테두리 색. 그라디언트보다 밝게 둬 상자 경계를 세운다
 * @param textStyle 글자색과 그림자. `dropShadow` 를 펼쳐 넣는다
 * @param borderWidth 테두리 폭(기본 1). 익스트림만 1.5 다. 이 값만큼 여백에서 뺀다
 *
 * @example
 * 노멀: difficulty(['#5cc2dd', '#2b93b0'], '#1f7690', { color: '#ffffff' })
 */
function difficulty(
  gradient: readonly [string, string],
  borderColor: string,
  textStyle: TextStyle,
  borderWidth = 1,
): BadgeVariantStyle {
  return { gradient, border: { borderWidth, borderColor }, textStyle, weight: 'extrabold', text: 'text-chip-sm' }
}

/** 색·테두리·그림자 17종. 난이도 이름이 그대로 키라 `variant={boss.difficulty}` 로 쓴다. */
export const BADGE_VARIANT = {
  primary: { className: 'bg-primary-tint text-primary-ink' },
  third: { className: 'bg-third-tint text-third-ink' },
  secondary: { className: 'bg-secondary-tint text-secondary-ink', weight: 'bold' },
  muted: { className: 'bg-surface-2 text-text-muted' },
  neutral: { className: 'bg-surface-2 text-text' },
  outline: { className: 'border border-border text-text-muted', borderWidth: 1 },
  disabled: { className: 'bg-surface-2 text-text-disabled' },
  dashed: { className: 'border border-dashed border-border text-text-disabled', borderWidth: 1 },
  error: { className: 'bg-error-tint text-error-ink' },
  epicDungeon: { className: 'bg-[#4DD2FF]/20 text-[#4DD2FF]' },
  mapleUnion: { className: 'bg-[#FFC93C]/20 text-[#FFC93C]' },
  guild: { className: 'bg-[#FF5C5C]/20 text-[#FF5C5C]' },
  이지: difficulty(['#aab4bc', '#7d8891'], '#67717a', { color: '#f5f6f7', ...dropShadow('rgba(0,0,0,0.3)') }),
  노멀: difficulty(['#5cc2dd', '#2b93b0'], '#1f7690', { color: '#ffffff', ...dropShadow('rgba(0,0,0,0.25)') }),
  하드: difficulty(['#e784a6', '#c04b74'], '#9c3a5c', { color: '#ffffff', ...dropShadow('rgba(0,0,0,0.25)') }),
  카오스: difficulty(['#3c3c3c', '#221f1f'], '#caa87f', { color: '#f0d8b8' }),
  익스트림: difficulty(['#3c3c3c', '#1c1414'], '#ef5d78', { color: '#f4794f' }, 1.5),
} as const satisfies Record<string, BadgeVariantStyle>

/**
 * 높이를 안 못박는다. 여백이 높이를 만든다. 여백을 클래스가 아니라 값으로 쥐는 것은 테두리
 * 폭을 빼야 해서다. 글자는 칩 계단을 쓴다.
 *
 * `mini` 는 고정칸에만 놓여서 글자 배수를 안 따른다.
 */
export const BADGE_SIZE = {
  default: { padX: 8, padY: 3, text: 'text-chip', alwaysFixed: false },
  mini: { padX: 6, padY: 2, text: 'text-chip-xs', alwaysFixed: true },
} as const

/** 클래스로는 못 덮는다. NativeWind 가 두께 충돌을 문자열 순서로 안 푼다. */
export const BADGE_WEIGHT = {
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
} as const

/** 색 이름. 난이도는 `이지`·`노멀`·`하드`·`카오스`·`익스트림` 이 그대로 키다. */
export type BadgeVariant = keyof typeof BADGE_VARIANT
/** `default` 아니면 `mini`. 높이가 아니라 여백과 글자 크기가 갈린다. */
export type BadgeSize = keyof typeof BADGE_SIZE
/** variant 의 기본 두께를 덮는 값. */
export type BadgeWeight = keyof typeof BADGE_WEIGHT
/** `variant` 로 바로 쓸 수 있게 난이도 이름이 그대로 키다. */
export type BadgeDifficulty = BossDifficulty & BadgeVariant
