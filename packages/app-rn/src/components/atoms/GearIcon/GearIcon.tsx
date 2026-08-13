// lucide `settings` 를 **한 패스로 다시 그린** 톱니 — 채웠을 때 가운데가 «구멍» 으로 남는다.
//
// ## 왜 새로 그렸나
//
// 하단바의 활성 아이콘을 면으로 채우기로 했는데([[ADR-132]] 정정 25), lucide 의 `Settings` 는
// «바깥 톱니 패스 + 안쪽 원» **두 요소**다. `fill` 은 Svg 뿌리에서 상속되므로 둘 다 채워지고,
// 그러면 가운데 원이 메워져 덩어리가 된다. 프롭으로는 하위 요소를 골라 채울 수 없다.
//
// 반투명으로 얹어 선을 살리는 판을 한 번 만들었다가 반려됐다(사용자 지시 — *"반투명이 아니라
// 안쪽 원은 비우고 바깥쪽만 채워야지. 안되면 새로 만들어."*). 그래서 두 모양을 **한 패스의 두
// 서브패스**로 합치고 `fillRule="evenodd"` 를 준다 — 겹치는 안쪽이 칠에서 빠져 구멍이 된다.
//
// ## 좌표는 lucide 그대로다
//
// 톱니 곡선은 `lucide-react-native/icons/settings` 의 `d` 를 **한 글자도 바꾸지 않고** 옮겼고,
// 안쪽 원은 같은 `circle(12, 12, r 3)` 을 호 두 개로 적은 것뿐이다. 같은 그림이어야 하는 이유는
// 이 톱니가 바에서만 쓰이고 **설정 화면들은 여전히 lucide `Settings` 를 쓰기** 때문이다 —
// 좌표가 갈리면 같은 앱 안에서 톱니가 두 가지가 된다([[ADR-066]] 결정 3 이 규격을 못 박은 이유).
//
// 채우지 않을 때(`fill` 없음)의 그림도 lucide 와 같다. `<circle>` 을 호로 적은 것은 획 모양을
// 바꾸지 않는다 — 비활성 상태에서 바의 톱니와 설정 화면의 톱니가 같아야 하므로 이 점이 중요하다.
import { Path } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'

/** lucide `settings` 의 톱니 곡선 — 원본 `d` 그대로다. */
const GEAR =
  'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915'

/**
 * 가운데 원을 서브패스로 적는다 — `evenodd` 가 여기를 구멍으로 만든다.
 *
 * **반지름이 상태마다 다르다.** 선으로 그릴 때는 lucide 의 `circle(12, 12, r 3)` 그대로여야 한다
 * (설정 화면의 톱니와 같은 그림이어야 하므로). 채울 때는 그 크기가 **덩어리 속 점처럼 작아 보인다**
 * — 둘레의 획이 구멍 안쪽을 1.5 만큼 더 먹기 때문이다(사용자 판정 — *"안쪽 구멍이 너무 작아"*).
 */
function hole(radius: number): string {
  const [x, r2] = [12 + radius, radius * 2]
  return `M${x} 12a${radius} ${radius} 0 1 1-${r2} 0 ${radius} ${radius} 0 1 1 ${r2} 0`
}

/** lucide 그대로 — 선으로만 그릴 때 쓴다. */
const HOLE_STROKE = 3
/** 채웠을 때. 획이 먹는 만큼을 되돌려 주고도 «구멍» 으로 읽히는 크기다. */
const HOLE_FILLED = 4.5

/** 프롭 모양은 lucide 아이콘·`ProfitIcon` 과 같다 — 하단바가 셋을 바꿔 끼운다. */
interface GearIconProps {
  className?: string
  color?: string
  /** 채우면 톱니 몸통만 면이 되고 **가운데는 비는다**(`fillRule="evenodd"`). */
  fill?: string
  size?: number
  strokeWidth?: number
  'aria-hidden'?: boolean
}

export function GearIcon(props: GearIconProps): React.JSX.Element {
  const filled = props.fill !== undefined && props.fill !== 'none'

  return (
    <Svg
      testID="gear-icon"
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
      {/* `fill` 을 **명시로 `none`** 까지 내려 준다. `undefined` 를 그대로 넘기면
          `react-native-svg` 가 뿌리의 `fill="none"` 을 상속하지 않고 **검정**으로 떨어뜨려,
          비활성 톱니가 새까만 덩어리가 된다(테스트가 잡았다 — lucide 는 `null`, 우리는 불투명 검정). */}
      <Path
        // 판정은 «프롭이 있나» 가 아니라 **«칠이 들어가나»** 다. 호출부는 안 채울 때 `undefined`
        // 가 아니라 문자열 `'none'` 을 넘기고(하단바가 그렇다), 그것을 «채움» 으로 세면 선 상태인데도
        // 구멍이 커져 설정 화면의 톱니와 갈린다 — 실제로 그렇게 났고 사용자가 잡았다.
        d={`${GEAR} ${hole(filled ? HOLE_FILLED : HOLE_STROKE)}`}
        fill={props.fill ?? 'none'}
        fillRule="evenodd"
      />
    </Svg>
  )
}
