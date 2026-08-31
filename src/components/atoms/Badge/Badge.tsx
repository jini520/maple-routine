// 앱의 배지는 이것 하나다 ([[ADR-195]] 결정 1). 상태·카테고리·난이도가 같은 상자를 쓰고 색만
// 갈린다. 스타일을 아는 파일이 하나라 같은 자리에 서는 배지의 크기가 어긋날 수 없다.
//
// 그라디언트 배지만 상자가 `LinearGradient` 고 나머지는 `Text` 하나다. RN 에 배경 그라디언트가
// 없어서 상자를 뷰로 만들어야 하고, 뷰는 글자 스타일을 자식에게 안 물려준다.
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
  /** `default` 의 글자 크기를 덮는다. `mini` 는 더 좁은 자리를 위한 것이라 이 값이 안 먹는다. */
  text?: string
  /** 안 적으면 `semibold` 다. */
  weight?: BadgeWeight
}

/** `0 1px 1px rgba(0,0,0,α)` — 난이도 셋의 그림자가 색만 다르고 오프셋·번짐이 같다. */
function dropShadow(color: string): TextStyle {
  return { textShadowColor: color, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }
}

/** 난이도 다섯은 그라디언트·테두리·그림자를 함께 갖는다. 값은 게임 안의 색이다 ([[ADR-147]] 정정 40). */
function difficulty(
  gradient: readonly [string, string],
  borderColor: string,
  textStyle: TextStyle,
  borderWidth = 1,
): BadgeVariantStyle {
  // 글자만 10px 다(사용자 지정 2026-09-01). 난이도 이름이 최대 넉 자라 12px 로는 배지가 넓어져
  // 보스 이름을 밀어낸다. `chip-sm` 은 `chip` 과 **줄 높이가 같아** 배지 높이는 안 갈린다.
  return { gradient, border: { borderWidth, borderColor }, textStyle, weight: 'extrabold', text: 'text-chip-sm' }
}

const BADGE_VARIANT = {
  primary: { className: 'bg-primary-tint text-primary-ink' },
  third: { className: 'bg-third-tint text-third-ink' },
  // 완료 배지. 두께가 기본값과 달라 variant 가 두께까지 쥔다 ([[ADR-195]] 결정 3).
  secondary: { className: 'bg-secondary-tint text-secondary-ink', weight: 'bold' },
  // 눌린 회색 둘. 실패도 경고도 아니라 강조색을 안 쓴다 ([[ADR-162]] 결정 3).
  muted: { className: 'bg-surface-2 text-text-muted' },
  neutral: { className: 'bg-surface-2 text-text' },
  // 배경 없이 테두리만. 설정의 현재값과 업데이트 모달의 버전이 쓴다.
  outline: { className: 'border border-border text-text-muted', borderWidth: 1 },
  // 아직 손대지 않은 것. 드롭 가격 화면의 «기록 안함»·«미입력» 이 쓴다.
  disabled: { className: 'bg-surface-2 text-text-disabled' },
  dashed: { className: 'border border-dashed border-border text-text-disabled', borderWidth: 1 },
  // 실패. today 위젯의 «미완료» 가 쓴다.
  error: { className: 'bg-error-tint text-error-ink' },
  // 컨텐츠 카테고리. 테마 토큰이 아니라 리터럴 hex 라 `/20` 알파가 빌드 시점에 `rgba()` 로 접힌다.
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
 * 난이도 배지도 `default` 를 쓴다([[ADR-195]] 정정 1). 그라디언트 배지만 혼자 작으면 같은 줄에
 * 선 배지들과 높이가 어긋난다.
 *
 * `mini` 는 높이가 `h-4` 로 못박혀 글자만 커지면 잘리므로 `fixed` 를 스스로 켠다([[ADR-152]]
 * 결정 5). `default` 는 패딩이 높이를 만들어 상자가 글자를 따라 커지므로 호출부가 정한다.
 */
/**
 * **높이를 못박지 않는다**([[ADR-195]] 정정 3). 여백이 높이를 만든다. 상자에 `height` 를 주면
 * 평면 배지는 글자 요소 하나라 글자가 위로 쏠린다(`justify-center` 는 Text 가 자기 글자에 못 쓴다).
 *
 * 여백은 클래스가 아니라 값으로 쥔다. 테두리가 있는 variant 가 여기서 테두리 폭을 빼기 때문이다.
 *
 * 줄 높이는 `typography.cjs` 의 **칩 계단**이 쥔다(`chip`·`chip-sm`·`chip-xs`) — 본문 계단은
 * 읽기용이라 배지엔 헐렁하다. 클래스로 주므로 두 플랫폼이 같은 값을 본다([[ADR-196]]).
 *
 * `mini` 가 글자 배수를 안 따르는 것은 자기 높이 때문이 아니라 **놓이는 자리** 때문이다. today
 * 위젯의 76px 타일과 가계부의 56px 처치 타일이 고정칸이라 글자가 커지면 넘친다([[ADR-152]] 결정 5).
 */
const SIZE = {
  default: { padX: 8, padY: 3, text: 'text-chip', alwaysFixed: false },
  mini: { padX: 6, padY: 2, text: 'text-chip-xs', alwaysFixed: true },
} as const

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
  /** variant 의 기본 두께를 덮는다. 같은 색을 다른 두께로 쓰는 자리가 있다. */
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
  // 라운딩이 pill 로 고정인 것은 디자인 원칙 2 다. 카드 14px, 배지 pill 로 성격을 가른다.
  // 레이아웃(`ml-auto` `shrink-0` 등)은 Button·Card 와 같은 기준으로 호출부가 소유한다.
  // variant 의 글자 크기는 `default` 에서만 쓴다. `mini` 는 더 좁은 자리를 위한 것이라 그쪽이 이긴다.
  const textSize = size === 'default' ? (variantStyle.text ?? box.text) : box.text
  const text = `${textSize} ${WEIGHT[weight ?? variantStyle.weight ?? 'semibold']}`
  const scaling = fixed === true || box.alwaysFixed

  // 테두리를 여백 안쪽으로 넣는다. RN 의 Yoga 는 **테두리를 패딩과 똑같이 바깥 크기에 더하므로**,
  // 빼 주지 않으면 테두리가 있는 배지만 커진다(실측 2026-08-31 — 테두리 1.5px 인 익스트림 65px ·
  // 1px 인 카오스 63px · 테두리 없는 완료 58px).
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
