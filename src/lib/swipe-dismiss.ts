// 가로로 이 값(px)을 넘게 끌면 스냅백 대신 닫힌 것으로 처리한다.
const SWIPE_DISMISS_THRESHOLD_PX = 70

export function shouldDismissFromSwipe(deltaX: number): boolean {
  return Math.abs(deltaX) > SWIPE_DISMISS_THRESHOLD_PX
}
