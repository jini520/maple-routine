/** 두 층 카드 바탕(`CardBackdrop`)의 세로 자리. 구분자 칸의 빈칸도 같은 값을 쓴다. */

/** 구분자 칸 맨 위에서 위 카드가 더 내려오는 높이. 구분자가 같은 높이의 빈칸을 둔다. */
export const UPPER_CARD_TAIL = 9
/** 두 카드 사이 여백. 구분자가 같은 높이의 빈칸을 둔다. */
export const CARD_GAP = 16

/**
 * 두 카드의 세로 자리.
 * @param headerHeight 격자 위 머리글의 높이. 격자 안 위치는 이만큼 아래에서 시작한다.
 * @param separatorTop 격자 안에서 구분자 칸의 지금 위치(위 끝)
 */
export function backdropFrames(
  headerHeight: number,
  separatorTop: number,
): { upperHeight: number; lowerTop: number } {
  'worklet'
  const upperHeight = headerHeight + separatorTop + UPPER_CARD_TAIL
  return { upperHeight, lowerTop: upperHeight + CARD_GAP }
}
