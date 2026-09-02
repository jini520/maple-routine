/**
 * 메이플 ID 목록을 어디에 앉힐지 — 순수 기하.
 *
 * **컴포넌트 파일 밖에 사는 이유**는 `src/lib/popover-anchor.ts`(웹·RN 공용 팝오버 기하)와 같다 —
 * 값 계산이라 화면 없이 검사할 수 있고, 컴포넌트 파일이 값을 export 하면 fast refresh 가 깨진다
 * (`Button/variants.ts`·`SettingsRow/row-class.ts` 와 같은 판단). core 가 아니라 여기 있는 것은
 * 웹뷰 앱에 짝이 되는 화면이 없기 때문이다(적용 범위는 `app-rn` 뿐 —).
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
}

interface DropdownPlacement {
  top: number
  /** 넘치는 목록은 잘리고 안에서 굴린다. */
  maxHeight: number
}

/**
 * **트리거 자리에서 시작하되, 아래로 넘치면 위로 뒤집는다.**
 *
 * 아래로 열 때는 목록의 **윗변**이 트리거 윗변이고(사이를 띄우지 않는다 — 띄우면 그 둘이 서로
 * 다른 컨트롤로 보인다), 뒤집으면 목록의 **밑변**이 트리거 밑변이다. 어느 쪽이든 목록과 트리거가
 * 한 덩어리로 이어진다.
 *
 * 양쪽 다 모자라면 넓은 쪽에 붙이고 그만큼으로 자른다.
 */
export function placeDropdown(input: DropdownPlacementInput): DropdownPlacement {
  const topLimit = input.safeTop + input.edgeGap
  const bottomLimit = input.windowHeight - input.safeBottom - input.edgeGap
  const anchorBottom = input.anchorTop + input.anchorHeight

  const spaceBelow = bottomLimit - input.anchorTop
  const spaceAbove = anchorBottom - topLimit

  if (input.contentHeight <= spaceBelow) {
    return { top: input.anchorTop, maxHeight: spaceBelow }
  }
  if (input.contentHeight <= spaceAbove) {
    return { top: anchorBottom - input.contentHeight, maxHeight: spaceAbove }
  }
  return spaceAbove > spaceBelow
    ? { top: topLimit, maxHeight: spaceAbove }
    : { top: input.anchorTop, maxHeight: spaceBelow }
}
