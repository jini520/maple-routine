// 화면 크기 구간. 콘텐츠 폭 · 세로 막대 · 위아래 여백이 모두 이 판정 하나를 따르므로, 판정이 갈리면 화면마다 다른 배치가 선다.

import { resolveScreenLayout } from '../screen-layout'

/** iOS 27.1 시뮬레이터에서 잰 값(2026-11-10). */
const 듀오_외부 = { windowWidthPx: 466, windowHeightPx: 678, insetRightPx: 84 }

describe('오른쪽 안전영역이 있으면 화면 크기와 상관없이 오른쪽 레일 화면이다', () => {
  it('아이폰 듀오 외부 화면은 side-rail 이고 콘텐츠 폭은 오른쪽 안전영역을 뺀 382 다', () => {
    const layout = resolveScreenLayout(듀오_외부)

    expect(layout.kind).toBe('side-rail')
    expect(layout.contentWidthPx).toBe(382)
    expect(layout.railWidthPx).toBe(84)
  })

  // 안쪽 화면은 짧은 변이 600 을 넘지만 외부 화면과 같은 레일이 있다. 레일을 무시하면 오른쪽 위가 OS 의 시계에 가린다.
  it('아이폰 듀오 안쪽 화면(가로 951×669, 오른쪽 84)도 side-rail 이고 콘텐츠 폭은 867 이다', () => {
    const layout = resolveScreenLayout({ windowWidthPx: 951, windowHeightPx: 669, insetRightPx: 84 })

    expect(layout.kind).toBe('side-rail')
    expect(layout.contentWidthPx).toBe(867)
  })

  // 폭이 바형 폰보다 넓다는 것만으로는 레일 화면이 아니다. 폴드8 외부 화면과 태블릿은 바형 폰 배치를 그대로 쓴다.
  it('오른쪽 안전영역이 없으면 폭과 상관없이 phone 이고 콘텐츠 폭은 창 폭이다', () => {
    for (const window of [
      { windowWidthPx: 447, windowHeightPx: 706, insetRightPx: 0 },
      { windowWidthPx: 1194, windowHeightPx: 834, insetRightPx: 0 },
    ]) {
      const layout = resolveScreenLayout(window)
      expect(layout.kind).toBe('phone')
      expect(layout.contentWidthPx).toBe(window.windowWidthPx)
      expect(layout.railWidthPx).toBe(0)
    }
  })
})

describe('위아래 여백', () => {
  it('side-rail 에서만 24 이고 phone 은 0 이다', () => {
    expect(resolveScreenLayout(듀오_외부).edgeGapPx).toBe(24)
    expect(resolveScreenLayout({ ...듀오_외부, insetRightPx: 0 }).edgeGapPx).toBe(0)
  })
})
