/**
 * 앱의 대기 표시. 옅은 트랙 위에서 호 하나가 돈다.
 *
 * 모양은 하나이고 쓰는 곳마다 크기만 고른다(버튼 안 16 · 모달 18~20 · 영역과 화면 24~32). 모양이 둘 이상이면 같은 기다림이 다른 뜻으로 읽힌다.
 *
 * @example
 * // 버튼 안. 색은 버튼이 라벨 색으로 맞춰 준다
 * <Spinner size={16} className="text-on-primary" inButton />
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
/** 버튼 안에서 트랙을 흐리는 정도. 트랙이 호와 같은 라벨 색이라 흐려야 호가 보인다. */
const IN_BUTTON_TRACK_OPACITY = 0.3

export interface SpinnerProps {
  size: number
  /** 호의 색. `text-*`. 주지 않으면 `text-primary` */
  className?: string
  /** 버튼 안의 스피너. 트랙을 `track` 대신 호와 같은 색으로 칠하고 30% 로 흐린다 */
  inButton?: boolean
}

export function Spinner(props: SpinnerProps): React.JSX.Element {
  const turn = useLoopedValue({ from: 0, to: 360, durationMs: ROTATION_MS, easing: Easing.linear })
  const rotating = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  const arcClassName = props.className ?? 'text-primary'

  return (
    <View testID="spinner" aria-hidden style={{ width: props.size, height: props.size }}>
      <Svg
        width={props.size}
        height={props.size}
        viewBox="0 0 24 24"
        className={props.inButton === true ? arcClassName : 'text-track'}
      >
        <Circle
          cx={12}
          cy={12}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeOpacity={props.inButton === true ? IN_BUTTON_TRACK_OPACITY : undefined}
        />
      </Svg>
      <Rotating style={[{ position: 'absolute', inset: 0 }, rotating]}>
        <Svg width={props.size} height={props.size} viewBox="0 0 24 24" className={arcClassName}>
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
