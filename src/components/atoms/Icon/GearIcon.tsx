/**
 * lucide `settings` 를 한 패스로 다시 그린 톱니. **채우면 가운데가 구멍으로 남는다**
 *
 * lucide 의 `Settings` 는 톱니 패스와 안쪽 원 두 요소라 `fill` 이 둘 다에 상속돼 가운데가 메워진다.
 * 그래서 두 모양을 한 패스의 두 서브패스로 합치고 `fillRule="evenodd"` 를 준다.
 *
 * **하단바에서만 쓴다.** 설정 화면들은 lucide `Settings` 를 그대로 쓰므로 좌표가 갈리면 같은 앱
 * 안에서 톱니가 두 가지가 된다.
 */
import { Path } from 'react-native-svg'

import { IconSvg, type IconProps } from './icon-base'

/** lucide `settings` 의 톱니 곡선. 원본 `d` 를 한 글자도 바꾸지 않고 옮긴 것이다. */
const GEAR =
  'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915'

/**
 * 가운데 원을 서브패스로 적는다. `evenodd` 가 여기를 구멍으로 만든다.
 *
 * @param radius 구멍 반지름. 상태마다 다르다
 */
function hole(radius: number): string {
  const [x, r2] = [12 + radius, radius * 2]
  return `M${x} 12a${radius} ${radius} 0 1 1-${r2} 0 ${radius} ${radius} 0 1 1 ${r2} 0`
}

/** lucide 의 `circle(12, 12, r 3)` 그대로. 선일 때는 설정 화면의 톱니와 같은 그림이어야 한다. */
const HOLE_STROKE = 3
/** 채웠을 때. 둘레의 획이 구멍 안쪽을 먹어서, r3 그대로 두면 덩어리 속 점으로 보인다. */
const HOLE_FILLED = 4.5

/**
 * 하단바의 설정 톱니.
 *
 * `fill` 을 주면 **톱니 몸통만** 면이 되고 가운데는 빈다. 안 주면 lucide `Settings` 와 같은 선
 * 그림이다.
 *
 * @example
 * // 하단바. 활성일 때만 채우고, 안 채울 때도 문자열 `'none'` 을 넘긴다
 * <GearIcon color={color} size={22} fill={active ? color : 'none'} />
 */
export function GearIcon(props: IconProps): React.JSX.Element {
  // 판정은 프롭이 있나가 아니라 **칠이 들어가나** 다. 하단바가 안 채울 때 `undefined` 가 아니라
  // 문자열 `'none'` 을 넘기는데, 그것을 채움으로 세면 선 상태인데도 구멍이 커진다.
  const filled = props.fill !== undefined && props.fill !== 'none'

  return (
    <IconSvg testID="gear-icon" {...props}>
      {/* `fill` 을 명시로 `'none'` 까지 내려 준다. `undefined` 를 그대로 넘기면 `react-native-svg`
          가 뿌리의 `fill="none"` 을 상속하지 않고 **검정**으로 떨어뜨린다. */}
      <Path
        d={`${GEAR} ${hole(filled ? HOLE_FILLED : HOLE_STROKE)}`}
        fill={props.fill ?? 'none'}
        fillRule="evenodd"
      />
    </IconSvg>
  )
}
