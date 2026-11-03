import { useEffect } from 'react'
import {
  cancelAnimation,
  Easing,
  interpolate,
  type SharedValue,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { useScreenSettled } from '../../../hooks/useScreenSettled'

/** 저절로 도는 경로. 처음과 끝이 같아 이음매 없이 반복된다. */
const PATH_X = [-1, 0.3, 1, -0.2, -1]
const PATH_Y = [-0.4, -1, 0.4, 1, -0.4]
const PATH_STEPS = PATH_X.map((_, step) => step)
const SEGMENTS = PATH_X.length - 1
const LOOP_MS = 5000
/** 경로가 가는 끝. 띠가 미끄러지는 거리와 세기가 이 값을 넘지 않는다. 효과 층의 여유 폭이 이 값에서 계산된다. */
export const HOLO_REACH = 0.7
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
 * 화면이 자리 잡았을 때만 돈다. 효과 층은 프레임마다 오프스크린 합성을 만들어, 화면 전환과 겹치면 전환이 끊긴다.
 * 떠나면 멈춘 자리에 두고, 돌아오면 그 자리에서 이어 돈다.
 *
 * @example
 * const motion = useHoloMotion(hasValuable)
 * <HologramSheen variant="card" motion={motion} />
 */
export function useHoloMotion(enabled = true): HoloMotion {
  const reduceMotion = useReducedMotion()
  const settled = useScreenSettled()
  const active = enabled && !reduceMotion && settled
  const progress = useSharedValue(0)

  useEffect(() => {
    if (!active) return
    // 반복은 시작한 값으로 되돌아가므로 끝을 시작한 값 더하기 한 바퀴로 건다. 효과는 나머지로 읽어 어디서 출발해도 이음매가 없다.
    const from = progress.value % SEGMENTS
    progress.value = from
    progress.value = withRepeat(withTiming(from + SEGMENTS, { duration: LOOP_MS, easing: Easing.linear }), -1)
    return () => cancelAnimation(progress)
  }, [active, progress])

  // 곡선은 구간마다 건다. 시간 전체에 걸면 경로의 꺾이는 자리마다 멈칫해 끊겨 보인다.
  const eased = useDerivedValue(() => {
    const at = progress.value % SEGMENTS
    const segment = Math.floor(at)
    return segment + EASE_IN_OUT(at - segment)
  })
  const x = useDerivedValue(() => interpolate(eased.value, PATH_STEPS, PATH_X) * HOLO_REACH)
  const y = useDerivedValue(() => interpolate(eased.value, PATH_STEPS, PATH_Y) * HOLO_REACH)
  return { x, y }
}
