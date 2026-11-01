/**
 * 닫기 버튼을 두르는 남은 시간 링. 꽉 찬 링이 지속시간 동안 12시 쪽으로 줄어드는 부품.
 *
 * 색은 `className` 이 정한다. `stroke="currentColor"` 가 `Svg` 의 `color` 프롭을 읽는다.
 *
 * @example
 * <TimerRing durationMs={2500} className="text-info-ink" />
 */
import { useEffect } from 'react'
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import { Circle } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'

/** 닫기 버튼의 `h-6 w-6` 과 같은 상자. */
const SIZE = 24
const STROKE = 2
/** stroke 는 경로의 가운데에 그려진다. 절반만큼 안으로 들어와야 상자를 안 넘는다. */
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export interface TimerRingProps {
  durationMs: number
  /** 링 색을 정하는 `text-*`. */
  className: string
}

export function TimerRing(props: TimerRingProps): React.JSX.Element {
  const dashOffset = useSharedValue(0)
  const { durationMs } = props

  useEffect(() => {
    dashOffset.value = withTiming(CIRCUMFERENCE, { duration: durationMs, easing: Easing.linear })
  }, [dashOffset, durationMs])

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: dashOffset.value }))

  return (
    <Svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={props.className}
      // SVG 원의 경로는 3시에서 시작한다.
      style={{ transform: [{ rotate: '270deg' }] }}
    >
      <AnimatedCircle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={[CIRCUMFERENCE, CIRCUMFERENCE]}
        animatedProps={animatedProps}
      />
    </Svg>
  )
}
