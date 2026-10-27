import { useEffect } from 'react'
import {
  Easing,
  interpolate,
  type SharedValue,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

/** 저절로 도는 경로. 처음과 끝이 같아 이음매 없이 반복된다. */
const PATH_X = [-1, 0.3, 1, -0.2, -1]
const PATH_Y = [-0.4, -1, 0.4, 1, -0.4]
const PATH_STEPS = PATH_X.map((_, step) => step)
const SEGMENTS = PATH_X.length - 1
const LOOP_MS = 5000
/** 경로가 가는 끝. 띠가 미끄러지는 거리와 세기가 이 값을 넘지 않는다. */
const REACH = 0.7
/** CSS `ease-in-out` 과 같은 곡선. 경로의 구간마다 건다. */
const EASE_IN_OUT = Easing.bezierFn(0.42, 0, 0.58, 1)

/** 효과가 읽는 좌우 · 위아래 값(−0.7~0.7). */
export interface HoloMotion {
  x: SharedValue<number>
  y: SharedValue<number>
}

/**
 * 홀로그램 효과를 5초에 한 바퀴 돌리는 훅.
 *
 * `enabled` 가 거짓이면 돌지 않는다. 고가 드롭이 없는 카드까지 애니메이션을 돌리지 않게 한다.
 *
 * @example
 * const motion = useHoloMotion(hasValuable)
 * <HologramSheen variant="card" motion={motion} />
 */
export function useHoloMotion(enabled = true): HoloMotion {
  const reduceMotion = useReducedMotion()
  const active = enabled && !reduceMotion
  const progress = useSharedValue(0)

  useEffect(() => {
    if (!active) return
    // 반복은 시작한 값으로 되돌아가므로 0 에서 출발시킨다. 중간 값에서 다시 시작하면 바퀴마다 경로 중간으로 튄다.
    progress.value = 0
    progress.value = withRepeat(withTiming(SEGMENTS, { duration: LOOP_MS, easing: Easing.linear }), -1)
  }, [active, progress])

  // 곡선은 구간마다 건다. 시간 전체에 걸면 경로의 꺾이는 자리마다 멈칫해 끊겨 보인다.
  const eased = useDerivedValue(() => {
    const at = progress.value % SEGMENTS
    const segment = Math.floor(at)
    return segment + EASE_IN_OUT(at - segment)
  })
  const x = useDerivedValue(() => interpolate(eased.value, PATH_STEPS, PATH_X) * REACH)
  const y = useDerivedValue(() => interpolate(eased.value, PATH_STEPS, PATH_Y) * REACH)
  return { x, y }
}
