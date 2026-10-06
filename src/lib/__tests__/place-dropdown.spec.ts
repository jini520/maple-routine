import { placeDropdown, placePopover } from '../place-dropdown'

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

/** 갤럭시 Z 폴드 8. 커버 416×657 · 인너 816×616, 위 31 · 아래 48. */
const 커버 = { windowHeight: 657, safeTop: 31, safeBottom: 48, edgeGap: 12, gap: 8 }
const 인너 = { windowHeight: 616, safeTop: 31, safeBottom: 48, edgeGap: 12, gap: 8 }

describe('placePopover', () => {
  it('아래에 들어가면 아래로 연다', () => {
    expect(placePopover({ ...커버, anchorTop: 100, anchorHeight: 27, contentHeight: 274 })).toEqual({
      side: 'below',
      top: 135,
    })
  })

  // MVP 고르기 화면의 적용 시작 주. 아래로 열면 135dp 가 화면 밖이었다(#530).
  it('아래가 모자라고 위에 들어가면 위로 뒤집는다', () => {
    expect(placePopover({ ...커버, anchorTop: 425, anchorHeight: 27, contentHeight: 274 })).toEqual({
      side: 'above',
      top: 425 - 8 - 274,
    })
  })

  // 시작 · 종료 탭이 있는 주 달력. 큰 쪽에 상한을 걸고 굴리면 날을 고를 수 없어 가운데로 옮긴다.
  it('위아래 둘 다 모자라면 안전영역 안 가운데에 앉힌다', () => {
    expect(placePopover({ ...인너, anchorTop: 300, anchorHeight: 27, contentHeight: 335 })).toEqual({
      side: 'center',
      top: 31 + (616 - 31 - 48 - 335) / 2,
    })
  })

  // 아래에 들어가기만 하면 아래로 열어, 화면 아래쪽 라벨의 팝오버가 하단바 위까지 내려왔다.
  it('위아래 둘 다 들어가면 빈 공간이 넓은 쪽에 연다', () => {
    expect(placePopover({ ...커버, anchorTop: 400, anchorHeight: 27, contentHeight: 100 })).toEqual({
      side: 'above',
      top: 400 - 8 - 100,
    })
  })

  it('넓은 쪽을 고를 때 하단바가 덮는 자리는 빈 공간으로 치지 않는다', () => {
    const input = { ...BASE, gap: 8, anchorTop: 330, anchorHeight: 27, contentHeight: 100 }

    expect(placePopover(input).side).toBe('below')
    expect(placePopover({ ...input, coveredBottomPx: 30 + 140 })).toEqual({ side: 'above', top: 330 - 8 - 100 })
  })

  // 하단바를 들어가는지 판정에서까지 빼면 바가 없는 시트에서 쓸데없이 가운데로 간다.
  it('넓은 쪽에 안 들어가면 하단바 뒤까지 쳐서 반대쪽에 연다', () => {
    expect(
      placePopover({ ...BASE, gap: 8, anchorTop: 300, anchorHeight: 27, contentHeight: 300, coveredBottomPx: 30 + 300 }),
    ).toEqual({ side: 'below', top: 335 })
  })

  it('가운데로도 안 들어가면 위 한계에 붙인다', () => {
    expect(placePopover({ ...인너, anchorTop: 300, anchorHeight: 27, contentHeight: 560 }).top).toBe(31 + 12)
  })
})
