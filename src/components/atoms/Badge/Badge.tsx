/**
 * 앱의 배지는 이것 하나다. 상태·카테고리·난이도가 같은 상자를 쓰고 색만 갈린다.
 *
 * 색·크기·두께를 정하는 표는 `variants.ts` 에 있다. 여기 있는 것은 그 표를
 * 상자와 글자로 푸는 코드다.
 */
import type { ReactNode } from 'react'
import { View } from 'react-native'

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

/** `TextProps` 를 그대로 물려받는 프롭. 배지가 평면일 때는 실제로 `Text` 하나이기 때문이다. */
export interface BadgeProps extends TextProps {
  /** 색. 난이도 배지는 난이도 key 를 그대로 넣는다. */
  variant: BadgeVariant
  /** 안 적으면 `md`. 좁은 칸에 놓는 작은 배지는 `xs` 다. */
  size?: BadgeSize
  /** variant 의 기본 두께를 덮는다. */
  weight?: BadgeWeight
  /** 글자 앞에 서는 아이콘. 색은 호출부가 variant 의 글자색으로 준다 */
  icon?: ReactNode
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
 * <Badge variant="third" className="tabular-nums">v{version}</Badge>
 *
 * // 보스 난이도. variant 키가 난이도 key 그대로이고 글자는 한글 이름이다
 * <Badge variant={boss.difficulty}>{DIFFICULTY_NAME[boss.difficulty]}</Badge>
 *
 * // today 타일처럼 좁은 칸에 놓는 작은 배지
 * <Badge variant={boss.difficulty} size="xs">{DIFFICULTY_SHORT[boss.difficulty]}</Badge>
 *
 * // variant 기본 두께를 덮는다. 같은 색을 다른 두께로 쓰는 자리가 있다
 * <Badge variant="muted" weight="bold">마감</Badge>
 */
export function Badge({
  variant,
  size = 'md',
  weight,
  className,
  style: styleProp,
  icon,
  ...rest
}: BadgeProps): React.JSX.Element {
  const variantStyle: BadgeVariantStyle = BADGE_VARIANT[variant]
  const box = BADGE_SIZE[size]
  const textSize = size === 'md' ? (variantStyle.text ?? box.text) : box.text
  const text = `${textSize} ${BADGE_WEIGHT[weight ?? variantStyle.weight ?? 'semibold']}`

  /**
   * 테두리를 여백 안쪽으로 넣는다. Yoga 가 테두리를 패딩처럼 바깥 크기에 더해서, 빼 주지 않으면
   * 테두리가 있는 배지만 커진다.
   */
  const inset = variantStyle.border?.borderWidth ?? 0
  const boxStyle = {
    paddingHorizontal: box.padX - inset,
    paddingVertical: box.padY - inset,
  }

  if (variantStyle.gradient === undefined && icon !== undefined) {
    // 아이콘을 글자 안에 끼우면 기준선을 따라 위아래로 어긋난다. 상자를 글자 밖으로 꺼내 둘을 한 줄에 세운다.
    // 글자에는 글자색만 남긴다. 배경 · 테두리까지 남기면 안쪽에 상자가 하나 더 생긴다.
    const classes = (variantStyle.className ?? '').split(' ')
    const inkClass = classes.filter((name) => name.startsWith('text-')).join(' ')
    const boxClass = classes.filter((name) => !name.startsWith('text-')).join(' ')
    const base = `flex-row items-center ${size === 'xs' ? 'gap-0.5' : 'gap-1'} rounded-full ${boxClass}`
    return (
      <View className={className === undefined ? base : `${base} ${className}`} style={boxStyle}>
        {icon}
        <Text className={`${inkClass} ${text}`} style={styleProp} {...rest} />
      </View>
    )
  }

  if (variantStyle.gradient === undefined) {
    const base = `rounded-full ${variantStyle.className ?? ''} ${text}`
    return (
      <Text
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
      className={`flex-row items-center rounded-full${icon === undefined ? '' : size === 'xs' ? ' gap-0.5' : ' gap-1'}${className === undefined ? '' : ` ${className}`}`}
      style={{ ...variantStyle.border, ...boxStyle }}
    >
      {icon}
      <Text
        className={`${text} tracking-[.03em]`}
        style={[variantStyle.textStyle, styleProp]}
        {...rest}
      />
    </LinearGradient>
  )
}
