/**
 * 앱이 직접 그리는 SVG 들이 함께 쓰는 프롭과 뿌리 배선.
 *
 * 세 겹이다. `IconProps` 는 호출부가 보는 프롭, `SvgFrame` 은 뿌리 배선과 격자, `IconSvg` 는 그
 * 위에 lucide 칠 프리셋을 얹은 것이다(정정 1). 새 아이콘은 좌표만 갖고 `IconSvg` 를 쓴다.
 */
import type { ReactNode } from 'react'
import type { SvgProps } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'

/**
 * lucide 아이콘과 **같은 프롭 모양**이다.
 *
 * 하단바가 lucide 셋과 커스텀 둘을 같은 자리에 바꿔 끼운다. react-navigation 이 `tabBarIcon` 에
 * 색과 크기를 클래스가 아니라 값으로 넘기므로, 프롭 이름이 같아야 그 자리에서 통한다.
 */
export interface IconProps {
  /** 색과 크기는 여기서 온다. `text-primary` 는 `color` 프롭이 되고 `h-5 w-5` 는 상자가 된다. */
  className?: string
  /** 클래스를 못 쓰는 자리(하단바)가 색을 값으로 줄 때. `className` 과 겹치면 클래스가 이긴다. */
  color?: string
  /**
   * 면으로 채울 색. 안 주면 lucide 규격대로 선만 그린다.
   *
   * **채워지는 자리는 그림마다 다르다.** 뿌리를 통째로 채우면 안쪽 선이 면에 묻혀 그림이
   * 뭉개져서, 각자 도형마다 고른다. 각 파일의 설명을 볼 것.
   */
  fill?: string
  /** `className` 이 크기를 안 줄 때의 폴백. lucide 와 같은 24 다. */
  size?: number
  /** lucide 와 같은 기본 2. 작게 그리는 자리가 올려 쓴다. */
  strokeWidth?: number
  'aria-hidden'?: boolean
}

/**
 * 그림이 사는 좌표계. `ratio` 는 높이를 폭에서 내는 비율이다.
 *
 * 두 격자를 쓴다. lucide 는 24 정사각(`LUCIDE_GRID`), 단풍잎은 127×130 이라 정사각이 아니다
 * (`maple-leaf.ts` 의 `LEAF_GRID`).
 */
export interface SvgGrid {
  viewBox: string
  ratio: number
}

/** lucide 규격의 격자. 24 그리드 정사각이다. */
export const LUCIDE_GRID: SvgGrid = { viewBox: '0 0 24 24', ratio: 1 }

/** 뿌리에 얹는 칠. `stroke` 계열은 SVG 상속 속성이라 자식이 전부 받는다. */
type SvgPaint = Pick<
  SvgProps,
  'fill' | 'stroke' | 'strokeWidth' | 'strokeLinecap' | 'strokeLinejoin'
>

interface SvgFrameProps extends IconProps {
  /** 테스트가 그림을 지목하는 이름. lucide 와 달리 우리 그림은 `testID` 가 통한다. */
  testID: string
  /** 안 주면 lucide 24 그리드다. */
  grid?: SvgGrid
  /** 안 주면 뿌리가 칠을 안 정한다 — 자식이 각자 고른다. */
  paint?: SvgPaint
  children: ReactNode
}

/**
 * SVG 뿌리 하나. **칠에는 의견이 없다**.
 *
 * 하는 일은 배선뿐이다. `size` 를 격자 비율에 맞춰 `width`·`height` 로 풀고, `className` 을
 * `lib/nativewind-interop` 이 배선한 `color` 로 잇는다.
 *
 * 칠을 기본값으로 안 두는 이유는 `stroke` 가 **상속 속성**이라서다. 뿌리에 두면 자식이 전부 받아,
 * 채운 그림(`MapleLeaf`·스윕 스피너)에 2px 윤곽선이 생긴다(실측).
 *
 * @example
 * // 잎 격자로 부른다. 칠은 자식이 정한다
 * <SvgFrame testID="maple-leaf" grid={LEAF_GRID} {...props}>
 *   <Path d={MAPLE_LEAF_PATH} fill="currentColor" />
 * </SvgFrame>
 */
export function SvgFrame({
  testID,
  grid = LUCIDE_GRID,
  paint,
  children,
  ...props
}: SvgFrameProps): React.JSX.Element {
  const size = props.size ?? 24

  return (
    <Svg
      testID={testID}
      color={props.color}
      width={size}
      height={size * grid.ratio}
      viewBox={grid.viewBox}
      className={props.className}
      aria-hidden={props['aria-hidden']}
      {...paint}
    >
      {children}
    </Svg>
  )
}

/**
 * lucide 규격으로 선 SVG 뿌리. `SvgFrame` 에 칠 프리셋을 얹은 것이다.
 *
 * 24 그리드 · 면 없음 · `currentColor` 선 · 라운드 캡과 조인 · 굵기 기본 2. 이 규격을 벗어나면
 * 같은 줄에 선 lucide 아이콘과 선 굵기·광학 크기가 어긋난다.
 *
 * **`fill` 프롭은 뿌리에 안 내려간다.** 뿌리를 채우면 자식 전부가 상속받아 안쪽 선이 사라진다.
 * 채우는 자리는 아이콘이 도형마다 고른다.
 *
 * @example
 * <IconSvg testID="gear-icon" {...props}>
 *   <Path d={GEAR} fill={props.fill ?? 'none'} fillRule="evenodd" />
 * </IconSvg>
 */
export function IconSvg({
  children,
  ...props
}: Omit<SvgFrameProps, 'grid' | 'paint'>): React.JSX.Element {
  return (
    <SvgFrame
      {...props}
      paint={{
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: props.strokeWidth ?? 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    >
      {children}
    </SvgFrame>
  )
}
