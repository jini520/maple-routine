/**
 * 트레일 링 스피너. 잎 외곽선 둘레의 70% 구간만 남긴 comet 이 한 바퀴를 돈다
 *
 *
 * **16px 버튼 안 전용이다.** 24px 이상은 `MapleSweepSpinner` 를 쓴다. 트레일 링은 큰 자리를 못
 * 채우고 스윕은 작은 자리에서 안 읽힌다. 지금 호출부는 `atoms/Button` 하나이고, 그 버튼이
 * 대기 중에 라벨 위로 겹쳐 그린다.
 */
import Animated, { Easing, useAnimatedProps } from 'react-native-reanimated'
import { Path } from 'react-native-svg'

import { useLoopedValue } from '../../../hooks/useLoopedValue'
import { SvgFrame } from '../Icon/icon-base'
import { LEAF_GRID, MAPLE_LEAF_PATH, MAPLE_LEAF_PATH_LENGTH } from '../Icon/maple-leaf'
import type { SpinnerProps } from './spinner-base'

/** 웹의 `strokeDasharray="210 90"`. 정규화 둘레 300 기준 70% / 30% 다. */
const TRAIL_RATIO = 0.7

/**
 * 대시 길이 둘. **웹의 `pathLength={300}` 정규화가 RN 에 없다.**
 *
 * `react-native-svg` 는 그 속성을 네이티브에서 안 받는다. 그래서
 * 정규화된 300 대신 **실측 둘레**에 같은 비율을 곱한다. 그림은 같고 숫자만 정규화 전 값이다.
 */
const TRAIL_DASH: readonly number[] = [
  MAPLE_LEAF_PATH_LENGTH * TRAIL_RATIO,
  MAPLE_LEAF_PATH_LENGTH * (1 - TRAIL_RATIO),
]

/** `index.css` 의 `animate-maple-trail`. `maple-trail 0.9s linear infinite`. */
export const MAPLE_TRAIL_DURATION_MS = 900

/**
 * 한 주기의 끝. 웹은 정규화된 `-300` 이었고 여기는 실측 둘레라 숫자가 다르다.
 *
 * 같아야 하는 것은 **한 주기가 둘레 한 바퀴**라는 성질이다. 그게 깨지면 반복이 이어붙는 자리에서
 * 트레일이 튄다. `-300` 을 그대로 베끼는 실수를 잡던 `keyframes-parity.test.ts` 는 웹 소스와 함께
 * 지워졌다. 지금 이 값을 지키는 것은 바로 위 한 줄뿐이다.
 */
export const MAPLE_TRAIL_TO_DASH_OFFSET = -MAPLE_LEAF_PATH_LENGTH

const AnimatedPath = Animated.createAnimatedComponent(Path)

/**
 * 도는 단풍잎 하나.
 *
 * 색은 `className` 이 정한다. `stroke="currentColor"` 의 값이 `Svg` 의 `color` 프롭에서 오고,
 * 그 프롭을 `lib/nativewind-interop` 이 `text-*` 에 잇는다.
 *
 * @example
 * // 버튼 안. 색은 버튼이 라벨 색으로 맞춰 준다
 * <MapleSpinner size={16} className="text-on-primary" />
 */
export function MapleSpinner(props: SpinnerProps): React.JSX.Element {
  const dashOffset = useLoopedValue({
    from: 0,
    to: MAPLE_TRAIL_TO_DASH_OFFSET,
    durationMs: MAPLE_TRAIL_DURATION_MS,
    easing: Easing.linear,
  })
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: dashOffset.value }))

  return (
    <SvgFrame
      testID="maple-spinner"
      aria-hidden
      grid={LEAF_GRID}
      size={props.size ?? 20}
      className={props.className}
    >
      <AnimatedPath
        d={MAPLE_LEAF_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={TRAIL_DASH}
        animatedProps={animatedProps}
      />
    </SvgFrame>
  )
}
