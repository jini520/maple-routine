/**
 * 스윕 스피너. 흐린 잎 위로 밝은 띠가 아래에서 위로 훑고 지나간다
 *
 *
 * **24px 이상 자리 전용이다.** 16px 버튼 안에서는 띠가 잎보다 커져 움직임이 안 읽히므로 그 크기에는
 * `MapleSpinner`(트레일 링)를 쓴다.
 *
 * 마스크가 `userSpaceOnUse` 여야 하는 이유는 `design-system.md` 의 로딩 표현 절에 있다
 *. `maskContentUnits="objectBoundingBox"` 로 두면 **띠가 통째로 사라진다.**
 */
import { useId } from 'react'
import Animated, { Easing, useAnimatedProps } from 'react-native-reanimated'
import { ClipPath, Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg'

import { useLoopedValue } from '../../../hooks/useLoopedValue'
import { SvgFrame } from '../Icon/icon-base'
import { LEAF_GRID, MAPLE_LEAF_PATH } from '../Icon/maple-leaf'
import type { SpinnerProps } from './spinner-base'

// 띠는 잎 아래(y=140, viewBox 밖)에서 시작해 위로 230 이동하며 잎을 완전히 통과한다.
const BAND_START_Y = 140
const BAND_HEIGHT = 80
const BAND_X = -10
const BAND_WIDTH = 147

/**
 * `translateY(-230px)` 의 **이동 거리**.
 *
 * 부호가 없는 것은 RN 이 transform 이 아니라 `<Rect>` 의 `y` 를 굴리기 때문이다. `<G>` 의 transform
 * 은 JS 에서 matrix 로 접혀 나가 UI 스레드 갱신이 그 접기를 건너뛰는데, `Rect` 는 `y` 를 손대지 않고
 * 네이티브 노드로 흘려보낸다. 그래서 옮길 대상을 transform 이 아니라 좌표로 골랐다.
 */
export const MAPLE_SWEEP_TRAVEL = 230

/** `index.css` 의 `animate-maple-sweep`. `maple-sweep 1.4s ease-in-out infinite`. */
export const MAPLE_SWEEP_DURATION_MS = 1400

/** CSS `ease-in-out` = `cubic-bezier(0.42, 0, 0.58, 1)`. `Easing.inOut(Easing.ease)` 는 다른 곡선이다. */
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)

const AnimatedRect = Animated.createAnimatedComponent(Rect)

/**
 * 훑고 지나가는 단풍잎 하나.
 *
 * 색은 `className` 이 정한다. **띠의 페이드는 색이 아니라 마스크로 만든다**. `react-native-svg` 의
 * 그라디언트 정지점은 `currentColor` 를 못 받아서 색을 넣으면 그라디언트가 통째로 빈다(실측).
 * 그래서 색은 `fill="currentColor"` 가, 모양은 흰색 알파 램프 마스크가 맡는다.
 *
 * @example
 * // 화면 전체 대기. 카드 껍데기는 `LoadingState` 가 씌운다
 * <MapleSweepSpinner size={32} className="text-primary" />
 */
export function MapleSweepSpinner(props: SpinnerProps): React.JSX.Element {
  // `useId()` 가 내는 값에는 구분자가 들어 있다(React 19 는 `r0`). `url(#...)` 를 문자열로 맞춰
  // 보는 `react-native-svg` 의 defs 조회에 그 문자가 어떻게 걸릴지 보장이 없어 영숫자만 남긴다.
  // 숫자 부분이 남으므로 인스턴스마다 다르다는 성질은 그대로다.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const clipId = `maple-sweep-clip-${uid}`
  const gradientId = `maple-sweep-gradient-${uid}`
  const maskId = `maple-sweep-mask-${uid}`

  const bandY = useLoopedValue({
    from: BAND_START_Y,
    to: BAND_START_Y - MAPLE_SWEEP_TRAVEL,
    durationMs: MAPLE_SWEEP_DURATION_MS,
    easing: EASE_IN_OUT,
  })
  const bandProps = useAnimatedProps(() => ({ y: bandY.value }))

  return (
    <SvgFrame
      testID="maple-sweep-spinner"
      aria-hidden
      grid={LEAF_GRID}
      size={props.size ?? 32}
      className={props.className}
    >
      <Defs>
        {/* `<clipPath>` 의 직접 자식은 도형이어야 한다. `<g>` 로 묶으면 브라우저가 조용히 빈 클립을
            만들어 잎이 통째로 사라졌다(`MapleWaveProgress` 에서 겪은 트랩). */}
        <ClipPath id={clipId}>
          <Path d={MAPLE_LEAF_PATH} />
        </ClipPath>
        {/* 알파 램프. 색이 아니라 **모양**이라 흰색으로 고정한다. 루미넌스 마스크에서 흰색의
            루미넌스는 1이라 `stopOpacity` 가 그대로 알파가 된다. */}
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <Stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </LinearGradient>
        {/* 범위는 띠의 **여정 전체**를 덮는 정적 상자다(범위까지 굴리면 `<Defs>` 안의 노드를
            애니메이션해야 한다). 램프는 띠와 같은 크기로 **같은 `bandY`** 를 따라간다. 그래야
            램프가 띠에 딸려 간다. `maskContentUnits` 도 적어 둔다: 지금 라이브러리는 안 읽지만
            언젠가 읽게 되어도 좌표의 뜻이 바뀌지 않아야 한다. */}
        <Mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
          x={BAND_X}
          y={BAND_START_Y - MAPLE_SWEEP_TRAVEL}
          width={BAND_WIDTH}
          height={MAPLE_SWEEP_TRAVEL + BAND_HEIGHT}
        >
          <AnimatedRect
            x={BAND_X}
            y={BAND_START_Y}
            width={BAND_WIDTH}
            height={BAND_HEIGHT}
            fill={`url(#${gradientId})`}
            animatedProps={bandProps}
          />
        </Mask>
      </Defs>

      {/* 바탕 잎. 띠가 지나가지 않는 동안에도 형태가 남아 무엇을 기다리는지가 보인다. */}
      <Path d={MAPLE_LEAF_PATH} fill="currentColor" opacity={0.32} />

      <G clipPath={`url(#${clipId})`}>
        <AnimatedRect
          x={BAND_X}
          y={BAND_START_Y}
          width={BAND_WIDTH}
          height={BAND_HEIGHT}
          fill="currentColor"
          mask={`url(#${maskId})`}
          animatedProps={bandProps}
        />
      </G>
    </SvgFrame>
  )
}
