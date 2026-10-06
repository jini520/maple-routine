/**
 * 트리거에 붙는 목록 · 팝오버를 어디에 앉힐지. 순수 기하.
 *
 * 컴포넌트 파일 밖에 사는 것은 값 계산이라 화면 없이 검사할 수 있고, 컴포넌트 파일이 값을
 * export 하면 fast refresh 가 깨지기 때문이다.
 */

interface DropdownPlacementInput {
  /** 트리거의 윈도우 기준 윗변·높이(`measureInWindow`). */
  anchorTop: number
  anchorHeight: number
  /** 목록 내용의 자연 높이(`onLayout`). */
  contentHeight: number
  windowHeight: number
  safeTop: number
  safeBottom: number
  edgeGap: number
  /**
   * 트리거와 목록 사이. 주면 목록이 트리거를 덮지 않고 그 아래(뒤집히면 위)에 이만큼 떨어져 선다.
   * 안 주면 트리거 자리에서 시작한다(메이플 ID 고르개).
   */
  gap?: number
}

interface DropdownPlacement {
  top: number
  /** 넘치는 목록은 잘리고 안에서 굴린다. */
  maxHeight: number
}

/**
 * 트리거 자리에서 시작하되 아래로 넘치면 위로 뒤집는 배치.
 *
 * 아래로 열 때는 목록의 윗변이 트리거 윗변이고(사이를 띄우지 않는다. 띄우면 그 둘이 서로 다른
 * 컨트롤로 보인다), 뒤집으면 목록의 밑변이 트리거 밑변이다. 어느 쪽이든 목록과 트리거가 한
 * 덩어리로 이어진다.
 *
 * 양쪽 다 모자라면 넓은 쪽에 붙이고 그만큼으로 자른다.
 */
export function placeDropdown(input: DropdownPlacementInput): DropdownPlacement {
  const topLimit = input.safeTop + input.edgeGap
  const bottomLimit = input.windowHeight - input.safeBottom - input.edgeGap
  const anchorBottom = input.anchorTop + input.anchorHeight
  // 간격이 있으면 목록은 트리거 밖에 선다. 아래로는 트리거 밑변 + 간격에서, 위로는 트리거 윗변 - 간격까지.
  const belowStart = input.gap === undefined ? input.anchorTop : anchorBottom + input.gap
  const aboveEnd = input.gap === undefined ? anchorBottom : input.anchorTop - input.gap

  const spaceBelow = bottomLimit - belowStart
  const spaceAbove = aboveEnd - topLimit

  if (input.contentHeight <= spaceBelow) {
    return { top: belowStart, maxHeight: spaceBelow }
  }
  if (input.contentHeight <= spaceAbove) {
    return { top: aboveEnd - input.contentHeight, maxHeight: spaceAbove }
  }
  return spaceAbove > spaceBelow
    ? { top: topLimit, maxHeight: spaceAbove }
    : { top: belowStart, maxHeight: spaceBelow }
}

interface PopoverPlacement {
  /** 앵커 아래 · 위 · 앵커를 버린 화면 가운데. 꼬리 방향과 스크림을 이것이 정한다. */
  side: 'below' | 'above' | 'center'
  top: number
}

/**
 * 앵커에 붙는 팝오버의 자리. 위아래 중 빈 공간이 넓은 쪽, 거기 안 들어가면 반대쪽, 둘 다 안 되면 가운데다.
 *
 * 넓은 쪽을 고를 때만 하단바가 덮는 자리(`coveredBottomPx`)를 뺀다. 들어가는지 판정에서까지 빼면 바가
 * 없는 시트에서 쓸데없이 가운데로 간다.
 *
 * 드롭다운과 달리 양쪽 다 모자랄 때 자르지 않는다. 달력은 줄 몇 개만 보여서는 날을 고를 수
 * 없어서, 앵커를 버리고 화면 가운데에 온전히 앉힌다.
 */
export function placePopover(
  input: DropdownPlacementInput & {
    gap: number
    /** 창 바닥에서부터 하단바가 덮는 높이. 안전영역을 포함한다 */
    coveredBottomPx?: number
  },
): PopoverPlacement {
  const topLimit = input.safeTop + input.edgeGap
  const bottomLimit = input.windowHeight - input.safeBottom - input.edgeGap
  const belowTop = input.anchorTop + input.anchorHeight + input.gap
  const aboveBottom = input.anchorTop - input.gap
  const spaceAbove = aboveBottom - topLimit
  const spaceBelow = bottomLimit - belowTop
  const openBelow =
    input.windowHeight - Math.max(input.safeBottom, input.coveredBottomPx ?? 0) - input.edgeGap - belowTop

  const below: PopoverPlacement = { side: 'below', top: belowTop }
  const above: PopoverPlacement = { side: 'above', top: aboveBottom - input.contentHeight }
  const [first, second] = spaceAbove > openBelow ? [above, below] : [below, above]
  const fits = (placement: PopoverPlacement): boolean =>
    input.contentHeight <= (placement.side === 'below' ? spaceBelow : spaceAbove)
  if (fits(first)) return first
  if (fits(second)) return second

  const usable = input.windowHeight - input.safeTop - input.safeBottom
  const centered = input.safeTop + (usable - input.contentHeight) / 2
  // 가운데에 둔 상자가 앵커를 덮는 것은 괜찮다. 화면 위로 넘치는 것만 막는다.
  return { side: 'center', top: Math.max(centered, input.safeTop + input.edgeGap) }
}
