// 트레일 링 스피너 — 잎 외곽선 둘레의 70% 구간만 남긴 comet 형태([[ADR-061]] 결정 1 · [[ADR-074]]).
// 16px 버튼 안처럼 작은 자리에 쓰고, 24px 이상은 `MapleSweepSpinner` 다.
//
// ⚠️ **아직 움직이지 않는다.** 웹은 `animate-maple-trail`(0.9s linear infinite, `stroke-dashoffset`
// 을 0 → −300 으로 굴린다)로 돌렸고, RN 에는 `@keyframes` 가 없어 **step 7(animations)** 에서
// Reanimated 로 다시 만든다. 지금 이 컴포넌트가 그리는 것은 **그 애니메이션의 0프레임**이다 —
// 여기서 흉내를 내면 step 7 이 두 벌을 갖게 된다.
//
// (이 phase 의 지시는 움직이지 않는 것을 `MapleSweepSpinner`·`AnimatedMeso` 둘로 적었지만, 실제로는
//  이쪽도 `@keyframes` 에 걸려 있다 — `index.css` 의 8종 중 `maple-trail` 이 이 파일 것이다.
//  거꾸로 `AnimatedMeso` 는 CSS 가 아니라 JS 훅이라 그대로 돈다. 결과적으로 정지 상태로 남는 atom 은
//  **`MapleSpinner` 와 `MapleSweepSpinner` 둘**이다.)
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
import { Path } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'
import { MAPLE_LEAF_PATH, MAPLE_LEAF_PATH_LENGTH } from '../../mapleLeafPath'

/** 웹의 `strokeDasharray="210 90"` (정규화 둘레 300 기준 70% / 30%). */
const TRAIL_RATIO = 0.7

const TRAIL_DASH: readonly number[] = [
  MAPLE_LEAF_PATH_LENGTH * TRAIL_RATIO,
  MAPLE_LEAF_PATH_LENGTH * (1 - TRAIL_RATIO),
]

export interface MapleSpinnerProps {
  size?: number
  className?: string
}

export function MapleSpinner(props: MapleSpinnerProps): React.JSX.Element {
  const size = props.size ?? 20

  return (
    <Svg
      testID="maple-spinner"
      aria-hidden
      width={size}
      height={size * (130 / 127)}
      viewBox="0 0 127 130"
      className={props.className}
    >
      <Path
        d={MAPLE_LEAF_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={TRAIL_DASH}
      />
    </Svg>
  )
}
