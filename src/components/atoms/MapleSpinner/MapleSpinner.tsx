// 트레일 링 스피너 — 잎 외곽선 둘레의 70% 구간만 남긴 comet 형태([[ADR-061]] 결정 1).
// 16px 버튼 안처럼 작은 자리에 쓰고, 24px 이상은 `MapleSweepSpinner` 다.
//
// ── RN 으로 옮기며 바뀐 것 ────────────────────────────────────────────────────────
//
// `pathLength={300}` 이 사라졌다. `react-native-svg` 는 그 속성을 네이티브에서 안 받는다(웹 빌드
// 전용 통과 목록에만 있다). 웹은 둘레를 300 으로 정규화해 `strokeDasharray="210 90"`(= 70/30)을
// 썼으므로, 여기서는 **실측 둘레에 같은 비율**을 곱한다(`MAPLE_LEAF_PATH_LENGTH`). 그림은 같고
// 숫자만 정규화 전 값이다.
//
// `stroke="currentColor"` 는 그대로 남는다 — `react-native-svg` 에도 `currentColor` 가 있고, 그 값은
// `Svg` 의 `color` 프롭에서 온다. 호출부가 웹처럼 `className="text-primary"` 로 색을 정할 수 있게
// `lib/nativewind-interop` 이 `style.color` → `color` 프롭 배선을 걸어 둔다.
//
// ── 모션: `maple-trail` (step 7) ─────────────────────────────────────────────────
//
// 웹은 `animation: maple-trail 0.9s linear infinite` 로 `stroke-dashoffset` 을 0 → −300(정규화 둘레)
// 까지 굴렸다. RN 은 **정규화가 없으므로 −(실측 둘레)** 까지 굴린다 — 대시 주기가 정확히 둘레라
// 0 과 −둘레가 같은 그림이고, 그래서 반복이 이어붙는 자리에서 튀지 않는다(웹과 같은 성질).
//
// **CSS 애니메이션 API 가 아니라 `useAnimatedProps` 다.** Reanimated 4 는 `@keyframes` 를 그대로 옮길
// 수 있는 CSS API 를 갖고 있고 SVG 속성 지원도 안에 들어 있지만(`css/svg` 의 `initSvgCssSupport`),
// **패키지 진입점에서 내보내지 않아 내부 경로를 직접 파고들어야 닿는다**(실측 — `react-native-reanimated
// /css/svg` 는 해석되지 않는다). 사설 경로에 기대는 대신, SVG 속성에는 문서화된 `useAnimatedProps` 를
// 쓴다. 그래서 이 저장소의 모션은 **두 갈래**다: View 스타일 = CSS API · SVG 속성 = `useAnimatedProps`.
//
// 모션 줄이기(`motion-reduce:animate-none`)는 `useReducedMotion()` 이 잇는다 — 켜져 있으면 애니메이션을
// 아예 걸지 않아 오프셋이 0 에 머문다(웹에서 `animation: none` 이 남기던 그림 그대로).
import { useEffect } from 'react'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Path } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'
import { MAPLE_LEAF_PATH, MAPLE_LEAF_PATH_LENGTH } from '../../mapleLeafPath'

/** 웹의 `strokeDasharray="210 90"` (정규화 둘레 300 기준 70% / 30%). */
const TRAIL_RATIO = 0.7

const TRAIL_DASH: readonly number[] = [
  MAPLE_LEAF_PATH_LENGTH * TRAIL_RATIO,
  MAPLE_LEAF_PATH_LENGTH * (1 - TRAIL_RATIO),
]

/** `index.css` 의 `animate-maple-trail` — `maple-trail 0.9s linear infinite`. */
export const MAPLE_TRAIL_DURATION_MS = 900

/**
 * 한 주기의 끝. 웹은 정규화된 `-300` 이었고 여기는 **실측 둘레**라 숫자가 다르다 — 같아야 하는 것은
 * *"한 주기 = 둘레 한 바퀴"* 라는 성질이고, 그게 깨지면 반복이 이어붙는 자리에서 트레일이 튄다.
 * `-300` 을 그대로 베끼는 실수를 `src/__tests__/keyframes-parity.test.ts` 가 잡는다.
 */
export const MAPLE_TRAIL_TO_DASH_OFFSET = -MAPLE_LEAF_PATH_LENGTH

const AnimatedPath = Animated.createAnimatedComponent(Path)

export interface MapleSpinnerProps {
  size?: number
  className?: string
}

export function MapleSpinner(props: MapleSpinnerProps): React.JSX.Element {
  const size = props.size ?? 20
  const reduceMotion = useReducedMotion()
  const dashOffset = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return

    dashOffset.value = withRepeat(
      withTiming(MAPLE_TRAIL_TO_DASH_OFFSET, {
        duration: MAPLE_TRAIL_DURATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    )

    return () => {
      cancelAnimation(dashOffset)
      dashOffset.value = 0
    }
  }, [dashOffset, reduceMotion])

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: dashOffset.value }))

  return (
    <Svg
      testID="maple-spinner"
      aria-hidden
      width={size}
      height={size * (130 / 127)}
      viewBox="0 0 127 130"
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
    </Svg>
  )
}
