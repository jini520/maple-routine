/**
 * 한 값을 무한 반복시키는 훅. 스피너 둘과 today · 보스 수익 버튼의 드럼이 쓴다.
 */
import { useEffect } from 'react'
import {
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
} from 'react-native-reanimated'

import { useScreenFocused } from './useScreenFocused'

interface Loop {
  /** 멈춰 있을 때의 값. 모션을 끄면 여기 머문다. */
  from: number
  to: number
  durationMs: number
  easing: EasingFunction | EasingFunctionFactory
}

/**
 * 한 값을 `from` 에서 `to` 로 무한 반복시키는 훅. 스피너 둘이 이걸로 SVG 속성을 굴린다.
 *
 * **CSS 애니메이션 API 가 아니라 `useAnimatedProps` 를 쓰는 이유**는 대상이 SVG 속성이라서다.
 * Reanimated 의 CSS API 는 SVG 지원을 갖고 있지만 패키지 진입점에서 안 내보내 내부 경로를 직접
 * 파고들어야 닿는다. 사설 경로에 기대는 대신 문서화된 훅을 쓴다. 그래서 이 저장소의 모션은
 * 두 갈래다. View 스타일은 CSS API, SVG 속성은 `useAnimatedProps`.
 *
 * 모션 줄이기(`useReducedMotion`)면 애니메이션을 아예 안 건다. 값이 `from` 에 머물러
 * `animation: none` 이 남기던 그림이 그대로 나온다.
 *
 * 자기 화면이 안 보이면 멈추고, 다시 보이면 `from` 에서 돈다. 탭 화면은 떠나도 마운트된 채라
 * 안 멈추면 그리지도 않을 뷰를 매 프레임 커밋한다.
 *
 * @param loop 시작·끝 값과 주기. 곡선은 CSS 와 같은 것을 쓸 것. `Easing.inOut(Easing.ease)` 는
 *   `ease-in-out`(`cubic-bezier(.42,0,.58,1)`)과 다른 곡선이다
 * @returns 애니메이션이 걸린 shared value. 호출부가 `useAnimatedProps` 로 속성에 잇는다
 */
export function useLoopedValue(loop: Loop): SharedValue<number> {
  const reduceMotion = useReducedMotion()
  const focused = useScreenFocused()
  const value = useSharedValue(loop.from)

  useEffect(() => {
    if (reduceMotion) {
      value.value = loop.from
      return
    }
    // 멈춘 값은 그 자리에 둔다. 되돌리면 push 로 밀려 나가는 화면에서 그림이 첫 칸으로 튄다.
    if (!focused) return

    value.value = loop.from
    value.value = withRepeat(
      withTiming(loop.to, { duration: loop.durationMs, easing: loop.easing }),
      -1,
      false,
    )

    return () => cancelAnimation(value)
  }, [value, reduceMotion, focused, loop.from, loop.to, loop.durationMs, loop.easing])

  return value
}
