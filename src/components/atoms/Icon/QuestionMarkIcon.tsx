/**
 * 원 없는 물음표. lucide `circle-question-mark` 에서 원을 빼고 물음표 선 둘만 옮긴 것이다.
 *
 * lucide 에는 원 없는 물음표가 없다. 둥근 배지 안에 놓이는 자리라 lucide 의 원은 배지 테두리와 겹친다.
 *
 * **격자를 물음표에 맞춰 12 로 자른다.** 24 격자 그대로면 물음표가 상자의 절반 폭이라 작은 배지에서
 * 점처럼 보인다. 그만큼 선이 두 배로 굵게 그려지므로 lucide 아이콘과 같은 줄에 세우지 말 것.
 */
import { Path } from 'react-native-svg'

import { SvgFrame, type IconProps, type SvgGrid } from './icon-base'

/** 선 굵기 2 를 더한 물음표의 바깥 상자. 위 6 · 아래 18 이고 가로는 12 를 가운데로 둔다. */
const GLYPH_GRID: SvgGrid = { viewBox: '6 6 12 12', ratio: 1 }

/**
 * 물음표 하나.
 *
 * @example
 * // 보스 드롭 시트의 상자 타일 배지
 * <QuestionMarkIcon className="h-2.5 w-2.5 text-text-muted" aria-hidden />
 */
export function QuestionMarkIcon(props: IconProps): React.JSX.Element {
  return (
    <SvgFrame
      testID="question-mark-icon"
      grid={GLYPH_GRID}
      {...props}
      paint={{
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: props.strokeWidth ?? 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    >
      {/* lucide `circle-question-mark` 의 `d` 를 한 글자도 바꾸지 않고 옮긴 것 */}
      <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <Path d="M12 17h.01" />
    </SvgFrame>
  )
}
