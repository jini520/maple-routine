import {
  CLOSE_DISTANCE_PX,
  CLOSE_VELOCITY,
  DRAG_LIMIT_PX,
  resistDrag,
  scrimOpacityFor,
  shouldCloseOnRelease,
  topSheetMaxHeight,
} from '../top-sheet-drag'

describe('resistDrag', () => {
  it('멀리 끌수록 덜 따라오고, 어느 방향이든 한계를 넘지 않는다', () => {
    const near = resistDrag(20)
    const far = resistDrag(200)
    // 따라오는 비율이 끈 거리와 함께 줄어든다.
    expect(far / 200).toBeLessThan(near / 20)
    expect(resistDrag(10_000)).toBeLessThan(DRAG_LIMIT_PX)
    expect(resistDrag(-10_000)).toBeGreaterThan(-DRAG_LIMIT_PX)
    // 방향은 그대로 둔다.
    expect(resistDrag(-50)).toBe(-resistDrag(50))
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
  it('위로 민 만큼만 옅어지고, 아래로 끌면 그대로다', () => {
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
