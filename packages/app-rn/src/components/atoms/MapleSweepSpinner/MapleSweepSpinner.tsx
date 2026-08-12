// 스윕 스피너 — 흐린 잎 위로 밝은 띠가 아래에서 위로 훑고 지나간다([[ADR-061]] 결정 1).
// 24px 이상 자리 전용이고, 16px 버튼 안에서는 띠가 잎보다 커져 움직임이 안 읽히므로 그 크기에는
// `MapleSpinner`(트레일 링)를 쓴다.
//
// 차오르는 방향인 것은 의도다 — 폐기된 `MapleWaveProgress`(잎 안에 물이 차오르던 결정형 진행률)의
// 감각을 비결정형 쪽에서 이어받는다([[ADR-061]] 결정 1).
//
// ── 모션: `maple-sweep` (step 7) ─────────────────────────────────────────────────
//
// 웹은 `animation: maple-sweep 1.4s ease-in-out infinite` 으로 띠에 `translateY(0 → −230px)` 를
// 걸었다. RN 은 **띠 `<Rect>` 의 `y` 속성 자체를 굴린다**(140 → −90, 이동량 230 동일) — `Rect` 는
// `y` 를 손대지 않고 네이티브 노드로 흘려보내므로(`react-native-svg` 의 `Rect.js`) `useAnimatedProps`
// 가 UI 스레드에서 곧장 갱신할 수 있다. 반대로 `<G>` 의 transform 은 JS 에서 matrix 로 접혀 나가
// UI 스레드 갱신이 그 접기를 건너뛴다 — 그래서 옮길 대상을 transform 이 아니라 좌표로 골랐다.
// 왜 CSS API 가 아니라 `useAnimatedProps` 인지는 `MapleSpinner` 파일 머리에 적었다(SVG 속성).
//
// 모션 줄이기(`motion-reduce:animate-none`)면 띠는 `y=140`(viewBox 밖)에 머물러 **바탕 잎만** 남는다 —
// 웹에서 `animation: none` 이 보여주던 그림 그대로다.
//
// ── RN 으로 옮기며 바뀐 것 ────────────────────────────────────────────────────────
//
// **① 띠의 페이드를 그라디언트 색이 아니라 마스크로 만든다 — `react-native-svg` 의 그라디언트
// 정지점은 `currentColor` 를 못 받는다.** 웹은 `<stop stopColor="currentColor" stopOpacity="0→1→0">`
// 로 "지금 글자색이 흐려졌다 진해지는 띠"를 그렸는데, RN 에서 같은 코드를 쓰면 콘솔에
// *"currentColor is not a valid color"* 가 찍히고 **그라디언트가 통째로 빈다**(실측 — 렌더 트리의
// `gradient: []`). 색 없는 띠는 조용한 실패라 더 나쁘다.
//
// 그래서 역할을 나눈다 — **색은 `fill="currentColor"` 가**(도형 채움에서는 `currentColor` 가 정상
// 동작한다) **모양은 흰색 알파 램프 마스크가** 맡는다. 흰색은 구체적인 색이라 정지점에 넣을 수 있고,
// 루미넌스 마스크에서 흰색의 루미넌스는 1이라 결국 `stopOpacity` 가 그대로 알파가 된다 —
// **웹과 같은 램프**다. 호출부 API 는 웹 그대로 유지된다(`className="text-*"` 하나로 색이 정해진다).
//
// **①-b 그래서 마스크는 띠의 바운딩 박스에 매인다(step 7 에서 고쳤다).** 처음 옮길 때는 마스크를
// `userSpaceOnUse` 로 두고 띠와 같은 좌표를 손으로 적었는데, 띠가 **움직이는 순간 그 방식은 깨진다** —
// 램프는 제자리에 서 있고 띠만 그 아래를 지나가 "고정된 창으로 내다보는" 그림이 된다. `maskUnits` 와
// `maskContentUnits` 를 **둘 다 `objectBoundingBox`** 로 두면 마스크 영역과 내용이 참조하는 도형의
// 바운딩 박스 비율로 표현되므로, 띠가 어디로 가든 램프가 **딸려 간다**(움직이는 프롭이 하나로 줄고,
// `<Defs>` 안의 노드를 애니메이션하지 않아도 된다). 웹이 `objectBoundingBox` 그라디언트를 띠의
// `fill` 에 직접 걸어 공짜로 얻던 성질을, 마스크 쪽에서 같은 방식으로 얻는 것이다.
//
// **②** `clipPathUnits="userSpaceOnUse"` 를 뺐다 — `react-native-svg` 의 `ClipPath` 는 그 속성을 받지
// 않고, 받지 않는 이유는 **그것이 이미 유일한 동작**이기 때문이다(웹에서 기본값
// `objectBoundingBox` 를 피하려고 명시하던 값이라 RN 에서는 적을 자리가 없다).
//
// **③** `<clipPath>` 의 직접 자식을 도형으로 두는 규칙은 그대로 지킨다 — 웹에서 `<g>` 로 묶으면
// Chrome 이 조용히 빈 클립을 만들어 잎이 통째로 사라졌다(`MapleWaveProgress` 에서 겪은 트랩).
// RN 에서 같은 실패가 나는지는 확인하지 않았지만, 같은 모양을 유지할 이유는 충분하다.
//
// **④** id 에서 영숫자 아닌 문자를 턴다 — `useId()` 가 내는 값에는 구분자가 들어 있고(React 19 는
// `«r0»`), `url(#...)` 를 문자열로 맞춰 보는 `react-native-svg` 의 defs 조회에 그 문자가 어떻게 걸릴지
// 보장이 없다. 숫자 부분이 남으므로 인스턴스마다 다르다는 성질은 그대로다.
import { useEffect, useId } from 'react'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { ClipPath, Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'
import { MAPLE_LEAF_PATH } from '../../mapleLeafPath'

// 띠는 잎 아래(y=140, viewBox 밖)에서 시작해 위로 230px 이동하며 잎을 완전히 통과한다.
const BAND_START_Y = 140
const BAND_HEIGHT = 80
const BAND_X = -10
const BAND_WIDTH = 147
/**
 * 웹의 `@keyframes maple-sweep { to { transform: translateY(-230px) } }` 의 **이동 거리**.
 *
 * 부호가 없는 것은 RN 이 transform 이 아니라 `<Rect>` 의 `y` 를 굴리기 때문이다 — 좌표는 아래로
 * 갈수록 커지므로 위로 올리려면 **빼야** 한다(웹의 음수 translateY 와 방향은 같고 부호만 반대).
 */
export const MAPLE_SWEEP_TRAVEL = 230

/** `index.css` 의 `animate-maple-sweep` — `maple-sweep 1.4s ease-in-out infinite`. */
export const MAPLE_SWEEP_DURATION_MS = 1400

/** CSS `ease-in-out` = `cubic-bezier(0.42, 0, 0.58, 1)`. `Easing.inOut(Easing.ease)` 는 다른 곡선이다. */
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)

const AnimatedRect = Animated.createAnimatedComponent(Rect)

export interface MapleSweepSpinnerProps {
  size?: number
  className?: string
}

export function MapleSweepSpinner(props: MapleSweepSpinnerProps): React.JSX.Element {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const size = props.size ?? 32
  const clipId = `maple-sweep-clip-${uid}`
  const gradientId = `maple-sweep-gradient-${uid}`
  const maskId = `maple-sweep-mask-${uid}`

  const reduceMotion = useReducedMotion()
  const bandY = useSharedValue(BAND_START_Y)

  useEffect(() => {
    if (reduceMotion) return

    bandY.value = withRepeat(
      withTiming(BAND_START_Y - MAPLE_SWEEP_TRAVEL, {
        duration: MAPLE_SWEEP_DURATION_MS,
        easing: EASE_IN_OUT,
      }),
      -1,
      false,
    )

    return () => {
      cancelAnimation(bandY)
      bandY.value = BAND_START_Y
    }
  }, [bandY, reduceMotion])

  const bandProps = useAnimatedProps(() => ({ y: bandY.value }))

  return (
    <Svg
      testID="maple-sweep-spinner"
      aria-hidden
      width={size}
      height={size * (130 / 127)}
      viewBox="0 0 127 130"
      className={props.className}
    >
      <Defs>
        <ClipPath id={clipId}>
          <Path d={MAPLE_LEAF_PATH} />
        </ClipPath>
        {/* 알파 램프. 색이 아니라 **모양**이라 흰색으로 고정한다(위 ①). */}
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <Stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </LinearGradient>
        {/* 좌표가 아니라 **비율**이다(위 ①-b) — 0~1 은 마스크를 참조하는 도형(= 띠)의 바운딩 박스라,
            띠가 위로 올라가면 램프도 함께 올라간다. */}
        <Mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
          <Rect x={0} y={0} width={1} height={1} fill={`url(#${gradientId})`} />
        </Mask>
      </Defs>

      {/* 바탕 잎 — 띠가 지나가지 않는 동안에도 형태가 남아 "무엇을 기다리는지"가 보인다. */}
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
    </Svg>
  )
}
