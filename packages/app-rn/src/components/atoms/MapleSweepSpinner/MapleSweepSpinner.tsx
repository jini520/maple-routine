// 스윕 스피너 — 흐린 잎 위로 밝은 띠가 아래에서 위로 훑고 지나간다([[ADR-061]] 결정 1).
// 24px 이상 자리 전용이고, 16px 버튼 안에서는 띠가 잎보다 커져 움직임이 안 읽히므로 그 크기에는
// `MapleSpinner`(트레일 링)를 쓴다.
//
// ⚠️ **아직 움직이지 않는다.** 웹은 `animate-maple-sweep`(1.4s ease-in-out infinite, 띠를
// `translateY(-230px)` 까지 올린다)로 돌렸고, RN 에는 `@keyframes` 가 없어 **step 7(animations)**
// 에서 Reanimated 로 다시 만든다. 지금 그리는 것은 **0프레임** — 띠가 `y=140`, 즉 viewBox(높이 130)
// 밖에 있어 화면에는 바탕 잎만 보인다. 이것은 웹에서 모션이 꺼진 환경(`motion-reduce`)이 보여주던
// 그림과 같다. 흉내로 움직이게 하지 않는 이유는 step 7 이 두 벌을 갖게 되기 때문이다.
//
// 차오르는 방향인 것은 의도다 — 폐기된 `MapleWaveProgress`(잎 안에 물이 차오르던 결정형 진행률)의
// 감각을 비결정형 쪽에서 이어받는다([[ADR-061]] 결정 1).
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
// **②** `clipPathUnits="userSpaceOnUse"` 를 뺐다 — `react-native-svg` 의 `ClipPath` 는 그 속성을 받지
// 않고, 받지 않는 이유는 **그것이 이미 유일한 동작**이기 때문이다(웹에서 기본값
// `objectBoundingBox` 를 피하려고 명시하던 값이라 RN 에서는 적을 자리가 없다). 마스크 쪽은 기본값이
// 여전히 `objectBoundingBox` 라 거기서는 명시한다.
//
// **③** `<clipPath>` 의 직접 자식을 도형으로 두는 규칙은 그대로 지킨다 — 웹에서 `<g>` 로 묶으면
// Chrome 이 조용히 빈 클립을 만들어 잎이 통째로 사라졌다(`MapleWaveProgress` 에서 겪은 트랩).
// RN 에서 같은 실패가 나는지는 확인하지 않았지만, 같은 모양을 유지할 이유는 충분하다.
//
// **④** id 에서 영숫자 아닌 문자를 턴다 — `useId()` 가 내는 값에는 구분자가 들어 있고(React 19 는
// `«r0»`), `url(#...)` 를 문자열로 맞춰 보는 `react-native-svg` 의 defs 조회에 그 문자가 어떻게 걸릴지
// 보장이 없다. 숫자 부분이 남으므로 인스턴스마다 다르다는 성질은 그대로다.
import { useId } from 'react'
import { ClipPath, Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'
import { MAPLE_LEAF_PATH } from '../../mapleLeafPath'

// 띠는 잎 아래(y=140, viewBox 밖)에서 시작해 위로 230px 이동하며 잎을 완전히 통과한다.
const BAND_START_Y = 140
const BAND_HEIGHT = 80
const BAND_X = -10
const BAND_WIDTH = 147

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
        <Mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={BAND_X}
          y={BAND_START_Y}
          width={BAND_WIDTH}
          height={BAND_HEIGHT}
        >
          <Rect
            x={BAND_X}
            y={BAND_START_Y}
            width={BAND_WIDTH}
            height={BAND_HEIGHT}
            fill={`url(#${gradientId})`}
          />
        </Mask>
      </Defs>

      {/* 바탕 잎 — 띠가 지나가지 않는 동안에도 형태가 남아 "무엇을 기다리는지"가 보인다. */}
      <Path d={MAPLE_LEAF_PATH} fill="currentColor" opacity={0.32} />

      <G clipPath={`url(#${clipId})`}>
        <Rect
          x={BAND_X}
          y={BAND_START_Y}
          width={BAND_WIDTH}
          height={BAND_HEIGHT}
          fill="currentColor"
          mask={`url(#${maskId})`}
        />
      </G>
    </Svg>
  )
}
