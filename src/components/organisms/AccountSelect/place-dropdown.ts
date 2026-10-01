/**
 * 메이플 ID 목록을 어디에 앉힐지. 순수 기하.
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
