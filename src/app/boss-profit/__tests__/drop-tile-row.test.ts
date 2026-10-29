/**
 * 드롭 타일 줄의 카드 바탕이 스크롤을 따라 늘고 주는 정도.
 *
 * 가려진 타일이 남은 쪽만 시트 끝까지 늘어난다. 그쪽 끝 타일까지 넘기면 처음과 끝 16 안에서 손가락을 따라
 * 제자리로 돌아온다.
 */
import { CARD_EDGE_STRETCH, cardEdgeStretch } from '../drop-tile-row'

/** 타일 여섯 개 줄. 보이는 폭보다 100 넓다. */
const 내용 = 482
const 보이는폭 = 382
const 끝 = 내용 - 보이는폭

describe('cardEdgeStretch', () => {
  it('처음에는 오른쪽만 시트 끝까지 늘어나 있다', () => {
    expect(cardEdgeStretch(0, 내용, 보이는폭)).toEqual({ left: 0, right: CARD_EDGE_STRETCH })
  })

  it('끝까지 넘기면 왼쪽만 늘어나 있다', () => {
    expect(cardEdgeStretch(끝, 내용, 보이는폭)).toEqual({ left: CARD_EDGE_STRETCH, right: 0 })
  })

  it('가운데에서는 양쪽이 다 늘어나 있다', () => {
    expect(cardEdgeStretch(끝 / 2, 내용, 보이는폭)).toEqual({ left: CARD_EDGE_STRETCH, right: CARD_EDGE_STRETCH })
  })

  it('처음과 끝의 16 안에서는 넘긴 만큼 늘고 준다', () => {
    expect(cardEdgeStretch(6, 내용, 보이는폭).left).toBe(6)
    expect(cardEdgeStretch(끝 - 6, 내용, 보이는폭).right).toBe(6)
  })

  // 끝에서 더 당기면 바운스로 자리가 범위 밖으로 나간다. 그때도 바탕이 시트 끝을 넘지 않는다.
  it('범위 밖으로 당겨도 0 과 16 사이에 머문다', () => {
    expect(cardEdgeStretch(-40, 내용, 보이는폭)).toEqual({ left: 0, right: CARD_EDGE_STRETCH })
    expect(cardEdgeStretch(끝 + 40, 내용, 보이는폭)).toEqual({ left: CARD_EDGE_STRETCH, right: 0 })
  })

  it('넘칠 것이 없으면 어느 쪽도 늘지 않는다', () => {
    expect(cardEdgeStretch(0, 300, 보이는폭)).toEqual({ left: 0, right: 0 })
    // 폭을 아직 못 쟀을 때도 제자리다.
    expect(cardEdgeStretch(0, 0, 0)).toEqual({ left: 0, right: 0 })
  })
})
