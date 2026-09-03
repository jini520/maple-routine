/**
 * 앱의 배지는 이것 하나다. 상태·카테고리·난이도가 같은 상자를 쓰고 색만 갈린다.
 *
 * 색·크기·두께를 정하는 표는 `variants.ts` 에 있다. 여기 있는 것은 그 표를
 * 상자와 글자로 푸는 코드다.
 */
import { LinearGradient } from '../../../lib/nativewind-interop'
import { Text, type TextProps } from '../Text/Text'
import {
  BADGE_SIZE,
  BADGE_VARIANT,
  BADGE_WEIGHT,
  type BadgeSize,
  type BadgeVariant,
  type BadgeVariantStyle,
  type BadgeWeight,
} from './variants'

export type { BadgeDifficulty, BadgeSize, BadgeVariant, BadgeWeight } from './variants'

/** `TextProps` 를 그대로 물려받는다. 배지가 평면일 때는 실제로 `Text` 하나이기 때문이다. */
export interface BadgeProps extends TextProps {
  /** 색. 난이도 배지는 난이도 이름을 그대로 넣는다. */
  variant: BadgeVariant
  /** 안 적으면 `default`. 고정칸에 놓는 작은 배지만 `mini` 다. */
  size?: BadgeSize
  /** variant 의 기본 두께를 덮는다. */
  weight?: BadgeWeight
}

/**
 * 배지 하나.
 *
 * 레이아웃(`ml-auto`·`shrink-0` 등)은 호출부가 `className` 으로 소유한다. 여백과 색과 두께는 이
 * 컴포넌트가 쥐므로 `className` 으로 덮으려 하지 말 것. 두께는 `weight` 프롭으로 덮는다.
 *
 * @example
 * // 상태·카테고리
 * <Badge variant="primary">beta</Badge>
 * <Badge variant="outline" className="tabular-nums">v{version}</Badge>
 *
 * // 보스 난이도. variant 키가 난이도 이름 그대로다
 * <Badge variant={boss.difficulty}>{boss.difficulty}</Badge>
 *
 * // 고정칸(today 76px 타일 등)에 놓는 작은 배지. `fixed` 가 자동으로 켜진다
 * <Badge variant={boss.difficulty} size="mini">{DIFFICULTY_SHORT[boss.difficulty]}</Badge>
 *
 * // variant 기본 두께를 덮는다. 같은 색을 다른 두께로 쓰는 자리가 있다
 * <Badge variant="muted" weight="bold">마감</Badge>
 */
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
  const box = BADGE_SIZE[size]
  const textSize = size === 'default' ? (variantStyle.text ?? box.text) : box.text
  const text = `${textSize} ${BADGE_WEIGHT[weight ?? variantStyle.weight ?? 'semibold']}`
  const scaling = fixed === true || box.alwaysFixed

  /**
   * 테두리를 여백 안쪽으로 넣는다. Yoga 가 테두리를 패딩처럼 바깥 크기에 더해서, 빼 주지 않으면
   * 테두리가 있는 배지만 커진다.
   */
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
      /** 방향을 기본값에 기대지 않는다. 뒤집히면 그림이 조용히 달라진다. */
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
