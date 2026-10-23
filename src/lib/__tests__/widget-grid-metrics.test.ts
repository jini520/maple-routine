// today 위젯 격자의 **치수**. 격자를 렌더하지 않고 볼 수 있어서 따로 있다.
// `bottom-bar-metrics.test.ts` 와 같은 판단이다.

import { GRID_COLUMNS, GRID_SIDE_PADDING, resolveWidgetGridMetrics, tileWidthPx } from '../today/widget-grid-metrics'

describe('열 폭은 창 폭에서 나온다', () => {
  // 열 폭을 반올림하지 않는 이유가 이것이다. 4칸 타일의 좌우가 화면 여백과 **정확히** 맞아야
  // 한다. 반올림하면 폭에 따라 오른쪽이 최대 3px 어긋난 채로 조용히 산다.
  it('4칸 타일은 좌우 여백을 뺀 폭을 정확히 채운다', () => {
    for (const 창폭 of [320, 360, 390, 402, 430, 674, 834]) {
      const metrics = resolveWidgetGridMetrics(창폭)

      expect(tileWidthPx(GRID_COLUMNS, metrics)).toBeCloseTo(창폭 - GRID_SIDE_PADDING * 2, 10)
    }
  })
})
