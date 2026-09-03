/**
 * 스냅백 대신 닫힘으로 넘어가는 가로 끌기 거리(px).
 */
const SWIPE_DISMISS_THRESHOLD_PX = 70

export function shouldDismissFromSwipe(deltaX: number): boolean {
  return Math.abs(deltaX) > SWIPE_DISMISS_THRESHOLD_PX
}
