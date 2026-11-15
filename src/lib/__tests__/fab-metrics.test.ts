// ＋ 의 자리. 바 · 안전영역 · 레일 세 값이 물려 있어, 하나만 어긋나도 ＋ 가 바에 가리거나 레일로 넘어간다.

import { resolveBottomBarSpace } from '../bottom-bar-metrics'
import { FAB_LIFT_PX, resolveFabPlacement } from '../fab-metrics'
import { resolveScreenLayout } from '../screen-layout'

const 아래_안전영역 = 34

function placementOf(window: { windowWidthPx: number; windowHeightPx: number; insetRightPx: number }) {
  const layout = resolveScreenLayout(window)
  return resolveFabPlacement({
    layout,
    bottomSafeAreaPx: 아래_안전영역,
    barSpacePx: resolveBottomBarSpace(layout, false).spacePx,
  })
}

describe('오른쪽 레일 화면의 ＋ 는 콘텐츠 오른쪽 아래에 뜬다', () => {
  const placement = placementOf({ windowWidthPx: 466, windowHeightPx: 678, insetRightPx: 84 })

  // 가로 바가 아래에 없으니 바의 몫이 빠지고, 아래쪽 안전영역 위로 12 만 띄운다.
  it('아래는 아래쪽 안전영역 + 12 다', () => {
    expect(placement.bottomPx).toBe(아래_안전영역 + FAB_LIFT_PX)
  })

  it('오른쪽은 콘텐츠 오른쪽 끝에서 16 이다. 레일 안으로 들어가지 않는다', () => {
    expect(placement.rightPx).toBe(84 + 16)
  })
})

describe('바형 폰은 지금 자리 그대로다', () => {
  const window = { windowWidthPx: 402, windowHeightPx: 874, insetRightPx: 0 }
  const placement = placementOf(window)
  const layout = resolveScreenLayout(window)

  it('가로 바 위로 12 띄우고 창 오른쪽 끝에서 16 이다', () => {
    expect(placement.bottomPx).toBe(아래_안전영역 + resolveBottomBarSpace(layout, false).spacePx + FAB_LIFT_PX)
    expect(placement.rightPx).toBe(16)
  })
})
