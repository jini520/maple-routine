// 앱의 배지는 이것 하나다([[ADR-195]]). 상태·카테고리·난이도가 같은 상자를 쓰고 색만 갈린다.
//
// 쓰는 법: `<Badge variant="primary">완료</Badge>`. `size` 는 `default`·`mini` 둘이고, 레이아웃
// (`ml-auto`·`shrink-0` 등)은 호출부가 `className` 으로 소유한다.
import type { BossDifficulty } from '../../../types'
import { type TextStyle, type ViewStyle } from 'react-native'

import { LinearGradient } from '../../../lib/nativewind-interop'
import { Text, type TextProps } from '../Text/Text'

interface BadgeVariantStyle {
  /** 평면 배경과 글자색. 테마 토큰이거나 리터럴 hex 다. */
  className?: string
  /** 위에서 아래로 흐르는 두 색. 있으면 상자가 `LinearGradient` 가 된다. */
  gradient?: readonly [string, string]
  border?: Pick<ViewStyle, 'borderWidth' | 'borderColor'>
  /** 클래스로 못 주는 글자색·그림자. 그라디언트 배지만 쓴다. */
  textStyle?: TextStyle
  /** 테두리를 클래스로 그리는 variant 가 여백에서 뺄 폭. 색이 테마 토큰이라 값으로 못 준다. */
  borderWidth?: number
  /** `default` 의 글자 크기를 덮는다. `mini` 는 안 먹는다([[ADR-195]] 정정 4). */
  text?: string
  /** 안 적으면 `semibold` 다. */
  weight?: BadgeWeight
}

/** `0 1px 1px rgba(0,0,0,α)`. 난이도 셋의 그림자가 색만 다르고 오프셋·번짐이 같다. */
function dropShadow(color: string): TextStyle {
  return { textShadowColor: color, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }
}

/** 난이도 다섯은 그라디언트·테두리·그림자를 함께 갖고 글자가 한 단 작다([[ADR-195]] 정정 4). */
function difficulty(
  gradient: readonly [string, string],
  borderColor: string,
  textStyle: TextStyle,
  borderWidth = 1,
): BadgeVariantStyle {
  return { gradient, border: { borderWidth, borderColor }, textStyle, weight: 'extrabold', text: 'text-chip-sm' }
}

/** 색·테두리·그림자 17종([[ADR-195]] 결정 2). 난이도 색은 게임 안의 값이다([[ADR-147]] 정정 40). */
const BADGE_VARIANT = {
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
 * 높이를 안 못박는다. 여백이 높이를 만든다([[ADR-195]] 정정 3). 여백을 클래스가 아니라 값으로 쥐는
 * 것은 테두리 폭을 빼야 해서다(정정 2). 글자는 칩 계단을 쓴다([[ADR-196]] 결정 4).
 *
 * `mini` 는 고정칸에만 놓여서 글자 배수를 안 따른다([[ADR-152]] 결정 5).
 */
const SIZE = {
  default: { padX: 8, padY: 3, text: 'text-chip', alwaysFixed: false },
  mini: { padX: 6, padY: 2, text: 'text-chip-xs', alwaysFixed: true },
} as const

/** 클래스로는 못 덮는다. NativeWind 가 두께 충돌을 문자열 순서로 안 푼다([[ADR-195]] 결정 3). */
const WEIGHT = {
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
} as const

export type BadgeVariant = keyof typeof BADGE_VARIANT
export type BadgeSize = keyof typeof SIZE
export type BadgeWeight = keyof typeof WEIGHT
/** `variant` 로 바로 쓸 수 있게 난이도 이름이 그대로 키다. */
export type BadgeDifficulty = BossDifficulty & BadgeVariant

export interface BadgeProps extends TextProps {
  variant: BadgeVariant
  size?: BadgeSize
  /** variant 의 기본 두께를 덮는다. */
  weight?: BadgeWeight
}

export function Badge({
  variant,
  size = 'default',
  weight,
  className,
  fixed,
  style: styleProp,
  ...rest
}: BadgeProps): React.JSX.Element {
  const variantStyle: BadgeVariantStyle = BADGE_VARIANT[variant]
  const box = SIZE[size]
  const textSize = size === 'default' ? (variantStyle.text ?? box.text) : box.text
  const text = `${textSize} ${WEIGHT[weight ?? variantStyle.weight ?? 'semibold']}`
  const scaling = fixed === true || box.alwaysFixed

  // 테두리를 여백 안쪽으로 넣는다. Yoga 가 테두리를 패딩처럼 바깥 크기에 더해서, 빼 주지 않으면
  // 테두리가 있는 배지만 커진다([[ADR-195]] 정정 2).
  const inset = variantStyle.border?.borderWidth ?? variantStyle.borderWidth ?? 0
  const boxStyle = {
    paddingHorizontal: box.padX - inset,
    paddingVertical: box.padY - inset,
  }

  if (variantStyle.gradient === undefined) {
    const base = `rounded-full ${variantStyle.className ?? ''} ${text}`
    return (
      <Text
        fixed={scaling}
        className={className === undefined ? base : `${base} ${className}`}
        style={[boxStyle, styleProp]}
        {...rest}
      />
    )
  }

  return (
    <LinearGradient
      colors={variantStyle.gradient}
      // 방향을 기본값에 기대지 않는다. 뒤집히면 그림이 조용히 달라진다.
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      className={`flex-row items-center rounded-full${className === undefined ? '' : ` ${className}`}`}
      style={{ ...variantStyle.border, ...boxStyle }}
    >
      <Text
        fixed={scaling}
        className={`${text} tracking-[.03em]`}
        style={[variantStyle.textStyle, styleProp]}
        {...rest}
      />
    </LinearGradient>
  )
}
