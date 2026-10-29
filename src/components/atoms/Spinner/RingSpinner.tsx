/**
 * 링 스피너. 옅은 원 위에서 호 하나가 돈다.
 *
 * 가운데 모달과 게임 데이터 잠금 화면의 대기 표시. 영역 · 화면의 대기는 아직 단풍잎이다.
 */
import { View } from 'react-native'
import Animated, { Easing, useAnimatedStyle } from 'react-native-reanimated'
import { Circle } from 'react-native-svg'

import { useLoopedValue } from '../../../hooks/useLoopedValue'
import { Svg } from '../../../lib/nativewind-interop'

/** NativeWind 가 reanimated `Animated.View` 의 정적 스타일을 버리므로, 감싼 `View` 를 애니메이션 부품으로 만든다. */
const Rotating = Animated.createAnimatedComponent(View)

const ROTATION_MS = 800
/** 24 격자에서의 반지름 · 두께. 호는 둘레의 4분의 1 이다. */
const RADIUS = 9.5
const STROKE = 3
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export interface RingSpinnerProps {
  size?: number
  /** 호의 색. `text-*` */
  className?: string
  /** 트랙의 색. `text-*` */
  trackClassName?: string
}

export function RingSpinner(props: RingSpinnerProps): React.JSX.Element {
  const size = props.size ?? 18
  const turn = useLoopedValue({ from: 0, to: 360, durationMs: ROTATION_MS, easing: Easing.linear })
  const rotating = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))

  return (
    <View testID="ring-spinner" aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" className={props.trackClassName ?? 'text-track'}>
        <Circle cx={12} cy={12} r={RADIUS} fill="none" stroke="currentColor" strokeWidth={STROKE} />
      </Svg>
      <Rotating style={[{ position: 'absolute', inset: 0 }, rotating]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" className={props.className ?? 'text-primary'}>
          <Circle
            cx={12}
            cy={12}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={[CIRCUMFERENCE / 4, CIRCUMFERENCE]}
          />
        </Svg>
      </Rotating>
    </View>
  )
}
