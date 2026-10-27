import {
  CLOSE_DISTANCE_PX,
  CLOSE_VELOCITY,
  DRAG_AWAY_LIMIT_PX,
  DRAG_SIDE_LIMIT_PX,
  dragOffset,
  scrimOpacityFor,
  shouldCloseOnRelease,
  topSheetMaxHeight,
} from '../top-sheet-drag'

describe('dragOffset', () => {
  it('좌우로는 화면 옆 여백(10)보다 덜 움직여 옆 가장자리를 넘지 않는다', () => {
    expect(dragOffset(10_000, 0).x).toBeLessThan(DRAG_SIDE_LIMIT_PX)
    expect(dragOffset(-10_000, 0).x).toBeGreaterThan(-DRAG_SIDE_LIMIT_PX)
    expect(DRAG_SIDE_LIMIT_PX).toBeLessThan(10)
  })

  it('위로는 움직이지 않는다. 상단 안전영역을 침범하지 않는다', () => {
    expect(dragOffset(0, -500).y).toBe(0)
  })

  it('아래로는 아주 조금만 움직이고, 멀리 끌수록 덜 따라온다', () => {
    expect(dragOffset(0, 10_000).y).toBeLessThan(DRAG_AWAY_LIMIT_PX)
    expect(dragOffset(0, 200).y / 200).toBeLessThan(dragOffset(0, 20).y / 20)
  })
})

describe('shouldCloseOnRelease', () => {
  it('위로 충분히 밀었거나 빠르게 밀어 올렸을 때만 닫는다', () => {
    expect(shouldCloseOnRelease(-CLOSE_DISTANCE_PX, 0)).toBe(true)
    expect(shouldCloseOnRelease(-10, -CLOSE_VELOCITY)).toBe(true)
    expect(shouldCloseOnRelease(-(CLOSE_DISTANCE_PX - 1), -(CLOSE_VELOCITY - 1))).toBe(false)
    // 아래로는 아무리 끌어도 닫지 않는다. 위에서 내려온 시트를 아래로 끄는 것은 닫는 몸짓이 아니다.
    expect(shouldCloseOnRelease(400, 3000)).toBe(false)
  })
})

describe('scrimOpacityFor', () => {
  // 시트는 위로 움직이지 않으므로 닫히려 한다는 표시는 스크림이 맡는다. 손가락이 위로 간 거리로 잰다.
  it('손가락을 위로 민 만큼 옅어지고, 아래로 끌면 그대로다', () => {
    expect(scrimOpacityFor(80)).toBe(1)
    expect(scrimOpacityFor(-20)).toBeGreaterThan(scrimOpacityFor(-60))
    expect(scrimOpacityFor(-10_000)).toBe(0)
  })
})

describe('topSheetMaxHeight', () => {
  it('키보드가 올라오면 키보드 위에 남은 높이가 상한이다', () => {
    const closed = topSheetMaxHeight({ windowHeight: 678, keyboardHeight: 0, topInset: 59, bottomInset: 34 })
    const open = topSheetMaxHeight({ windowHeight: 678, keyboardHeight: 304.7, topInset: 59, bottomInset: 34 })
    expect(open).toBeLessThan(closed)
    expect(open).toBeCloseTo(678 - 304.7 - 59 - 8)
  })

  it('키보드가 없으면 하단 안전영역 위까지다', () => {
    expect(topSheetMaxHeight({ windowHeight: 667, keyboardHeight: 0, topInset: 20, bottomInset: 0 })).toBe(
      667 - 20 - 8,
    )
    expect(topSheetMaxHeight({ windowHeight: 844, keyboardHeight: 0, topInset: 59, bottomInset: 34 })).toBe(
      844 - 59 - 34 - 8,
    )
  })
})
