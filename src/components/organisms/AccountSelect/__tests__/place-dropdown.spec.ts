import { placeDropdown } from '../place-dropdown'

const BASE = { windowHeight: 800, safeTop: 40, safeBottom: 30, edgeGap: 12 }

describe('placeDropdown', () => {
  it('간격이 없으면 목록이 트리거 자리에서 시작한다', () => {
    expect(placeDropdown({ ...BASE, anchorTop: 100, anchorHeight: 40, contentHeight: 200 }).top).toBe(100)
  })

  it('간격을 주면 트리거 아래로 그만큼 띄운다', () => {
    const placed = placeDropdown({ ...BASE, anchorTop: 100, anchorHeight: 40, contentHeight: 200, gap: 6 })

    expect(placed.top).toBe(146)
    expect(placed.maxHeight).toBe(800 - 30 - 12 - 146)
  })

  it('간격을 주고 아래가 모자라면 트리거 위로 그만큼 띄워 뒤집는다', () => {
    const placed = placeDropdown({ ...BASE, anchorTop: 600, anchorHeight: 40, contentHeight: 200, gap: 6 })

    expect(placed.top).toBe(600 - 6 - 200)
  })
})
