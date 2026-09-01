/**
 * 커스텀 아이콘들이 함께 쓰는 `Svg` 껍데기와 프롭 모양([[ADR-199]]).
 *
 * lucide 규격을 여기가 쥔다([[ADR-066]] 결정 3). 새 아이콘은 좌표만 갖고 이 껍데기를 쓴다.
 */
import type { ReactNode } from 'react'

import { Svg } from '../../../lib/nativewind-interop'

/**
 * lucide 아이콘과 **같은 프롭 모양**이다([[ADR-199]] 결정 3).
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
   * **채워지는 자리는 아이콘마다 다르다.** 뿌리를 통째로 채우면 안쪽 선이 면에 묻혀 그림이
   * 뭉개져서, 아이콘이 도형마다 고른다([[ADR-132]] 정정 25). 각 아이콘의 설명을 볼 것.
   */
  fill?: string
  /** `className` 이 크기를 안 줄 때의 폴백. lucide 와 같은 24 다. */
  size?: number
  /** lucide 와 같은 기본 2. 작게 그리는 자리가 올려 쓴다. */
  strokeWidth?: number
  'aria-hidden'?: boolean
}

interface IconSvgProps extends IconProps {
  /** 테스트가 아이콘을 지목하는 이름. lucide 와 달리 커스텀 아이콘은 `testID` 가 통한다. */
  testID: string
  /** 좌표를 그리는 자식 도형. `react-native-svg` 에서 직접 가져와도 된다([[ADR-197]] 결정 1). */
  children: ReactNode
}

/**
 * lucide 규격으로 선 `Svg` 뿌리([[ADR-199]] 결정 2). 24 그리드 · 면 없음 · `currentColor` 선 ·
 * 라운드 캡과 조인이다.
 *
 * **`fill` 은 뿌리에 안 내려간다.** 뿌리를 채우면 `react-native-svg` 가 자식 전부에 상속시켜
 * 안쪽 선이 사라진다. 채우는 자리는 아이콘이 도형마다 고른다.
 *
 * @example
 * <IconSvg testID="gear-icon" {...props}>
 *   <Path d={GEAR} fill={props.fill ?? 'none'} fillRule="evenodd" />
 * </IconSvg>
 */
export function IconSvg({ testID, children, ...props }: IconSvgProps): React.JSX.Element {
  return (
    <Svg
      testID={testID}
      color={props.color}
      width={props.size ?? 24}
      height={props.size ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden={props['aria-hidden']}
    >
      {children}
    </Svg>
  )
}
