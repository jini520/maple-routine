/**
 * 바텀시트를 끌 때 시트 층이 따라가는 거리와 떠 있는 시트의 아래 간격.
 *
 * 아래로 끄는 것은 라이브러리가 시트를 직접 옮겨 닫는 몸짓이라 층은 따라가지 않는다. 좌우와 위(화면 안쪽)는
 * 상단 시트와 같은 한계까지만 살짝 따라온다.
 */
import { DRAG_AWAY_LIMIT_PX, DRAG_SIDE_LIMIT_PX } from '../../TopSheet/top-sheet-drag'
import { ANIMATION_SOURCE, ANIMATION_STATUS } from '@gorhom/bottom-sheet'

import { bottomSheetDragOffset, floatingLayerHeight, sheetBottomGap, sheetShape } from '../bottom-sheet-drag'

describe('bottomSheetDragOffset', () => {
  it('아래로 끈 것은 따라가지 않는다. 라이브러리가 시트를 옮긴다', () => {
    expect(bottomSheetDragOffset(0, 300).y).toBe(0)
  })

  it('위로는 정말 약간만 따라오고 한계를 넘지 않는다', () => {
    const 조금 = bottomSheetDragOffset(0, -20).y
    const 많이 = bottomSheetDragOffset(0, -2000).y

    expect(조금).toBeLessThan(0)
    expect(Math.abs(조금)).toBeLessThan(20 * 0.1 + 0.001)
    expect(많이).toBeGreaterThan(-DRAG_AWAY_LIMIT_PX)
    expect(많이).toBeLessThan(조금)
  })

  it('좌우로는 양쪽 모두 옆 한계 안에서 따라온다', () => {
    expect(bottomSheetDragOffset(2000, 0).x).toBeLessThan(DRAG_SIDE_LIMIT_PX)
    expect(bottomSheetDragOffset(-2000, 0).x).toBeGreaterThan(-DRAG_SIDE_LIMIT_PX)
    expect(bottomSheetDragOffset(-30, 0).x).toBeLessThan(0)
  })
})

describe('sheetBottomGap', () => {
  it('하단 안전영역만큼 띄우고, 10 보다 작으면 10 을 띄운다', () => {
    expect(sheetBottomGap(34)).toBe(34)
    expect(sheetBottomGap(0)).toBe(10)
    expect(sheetBottomGap(4)).toBe(10)
  })
})

/**
 * 라이브러리는 내용 높이를 바로 바꾸고 시트 자리는 애니메이션으로 따라간다. 그 사이 층의 바닥을 떠 있는 자리에 붙든다.
 * 시트 전체가 미끄러지는 움직임(끌기 · 열기 · 닫기)에서는 붙들지 않는다. 붙들면 시트가 미끄러지지 않고 찌그러진다.
 */
describe('floatingLayerHeight', () => {
  // 라이브러리 컨테이너는 이미 아래 간격만큼 줄어든 상자다(`bottom: bottomInset`). 거기서 간격을 또 빼면 붙든 바닥이 간격만큼
  // 높게 떠서, 단계를 오갈 때 바닥이 흔들리고 갈래 고르기가 폼보다 더 떠 보였다(아이폰 녹화).
  const 컨테이너 = 2000

  it('내용 높이가 바뀌어 자리가 움직이는 동안에는 윗변에서 컨테이너 바닥까지다', () => {
    const 상태 = { source: ANIMATION_SOURCE.SNAP_POINT_CHANGE, status: ANIMATION_STATUS.RUNNING }

    expect(floatingLayerHeight(상태, 컨테이너, 1200)).toBe(800)
  })

  it('끌기 · 열기처럼 시트가 통째로 움직이면 붙들지 않는다', () => {
    for (const source of [ANIMATION_SOURCE.GESTURE, ANIMATION_SOURCE.MOUNT, ANIMATION_SOURCE.USER]) {
      expect(floatingLayerHeight({ source, status: ANIMATION_STATUS.RUNNING }, 컨테이너, 1200)).toBeNull()
    }
  })

  it('높이 변화가 끝났으면 붙들지 않는다', () => {
    const 상태 = { source: ANIMATION_SOURCE.SNAP_POINT_CHANGE, status: ANIMATION_STATUS.STOPPED }

    expect(floatingLayerHeight(상태, 컨테이너, 1200)).toBeNull()
  })
})

/**
 * 화면 모서리가 둥근 기기에서는 시트 아래 모서리를 화면 곡률과 동심원으로 맞춘다. 옆 · 아래 간격이 같아야 동심원이다.
 * 반경을 모르면(표에 없는 기기 · 안드로이드 11 이하) 0 이면(각진 화면) 지금 모양이다.
 */
describe('sheetShape', () => {
  it('화면 반경이 있으면 아래 간격은 옆 간격과 같고, 아래 모서리는 화면 반경에서 그 간격을 뺀다', () => {
    const 모양 = sheetShape(62, 34)

    expect(모양.bottomGap).toBe(10)
    expect(모양.bottomRadius).toBe(52)
  })

  it('홈 막대와 겹치는 만큼 바닥 여백을 비운다. 16 보다 작아지지 않는다', () => {
    expect(sheetShape(55, 34).bottomPadding).toBe(24)
    expect(sheetShape(30, 0).bottomPadding).toBe(16)
  })

  /** 버튼은 모서리를 곡률에 맞출 수 있지만 내용은 그렇지 않다. 내용만 있는 시트는 곡선 위로 내용을 올린다. */
  it('내용만 있는 시트는 아래 모서리 반경만큼 바닥을 비운다', () => {
    expect(sheetShape(62, 34).contentPadding).toBe(52)
    expect(sheetShape(null, 34).contentPadding).toBe(28)
  })

  it('반경을 모르거나 0 이면 아래 간격은 하단 안전영역(최소 10)이고 모서리는 28 이다', () => {
    for (const 반경 of [null, 0]) {
      const 모양 = sheetShape(반경, 34)
      expect(모양.bottomGap).toBe(34)
      expect(모양.bottomRadius).toBe(28)
      expect(모양.bottomPadding).toBe(16)
      expect(모양.contentPadding).toBe(28)
    }
    expect(sheetShape(null, 0).bottomGap).toBe(10)
  })

  it('화면 반경이 작아도 동심원을 지킨다. 아이패드처럼 반경이 18 이면 아래 모서리는 8 이다', () => {
    expect(sheetShape(18, 20).bottomRadius).toBe(8)
  })
})

/**
 * 바닥 줄의 주 버튼(알약 반경 26)이 시트 아래 모서리와 동심원에 가깝게 서는 간격. 정확한 동심원 반경 24 보다 버튼이 8% 커서
 * 곡률을 조금 더 준다. 간격은 내용 여백 16 보다 작아지지 않는다.
 */
describe('sheetShape 의 버튼 간격', () => {
  it('아래 모서리 반경에서 24 를 뺀다. 아이폰 17(시트 아래 52)은 28 이다', () => {
    expect(sheetShape(62, 34).buttonGap).toBe(28)
  })

  it('반경이 작거나 모르면 16 이다', () => {
    expect(sheetShape(38, 24).buttonGap).toBe(16)
    expect(sheetShape(null, 34).buttonGap).toBe(16)
  })

  it('바닥 줄의 바닥 여백은 버튼 간격보다 작지 않다', () => {
    expect(sheetShape(62, 34).bottomPadding).toBe(28)
  })
})
