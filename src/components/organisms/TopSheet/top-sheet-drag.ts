/**
 * 상단 시트를 끌 때의 셈. 손가락을 얼마나 따라갈지, 놓으면 닫을지, 스크림을 얼마나 옅게 할지, 시트가 얼마나 클 수 있는지.
 *
 * UI 스레드의 제스처 콜백과 애니메이션 스타일에서 부르므로 모두 worklet 이다.
 */

/** 끈 거리가 끝없이 커져도 시트가 따라가는 한계. */
export const DRAG_LIMIT_PX = 120

/** 놓았을 때 이만큼 위로 밀려 있으면 닫는다. 끈 거리(손가락)로 잰다. */
export const CLOSE_DISTANCE_PX = 80

/** 놓는 순간 이보다 빠르게 위로 밀고 있으면 거리와 상관없이 닫는다(px/s). */
export const CLOSE_VELOCITY = 900

/** 위로 이만큼 밀면 스크림이 다 사라진다. */
const SCRIM_FADE_PX = 200

/** 시트와 키보드(또는 하단 안전영역) 사이. */
export const TOP_SHEET_BOTTOM_GAP_PX = 8

/**
 * 끈 거리를 시트가 따라가는 거리로 바꾼다. 멀리 끌수록 덜 따라오고 `DRAG_LIMIT_PX` 에 다가가기만 한다.
 *
 * @param distance 손가락이 움직인 거리. 부호가 방향이다
 */
export function resistDrag(distance: number): number {
  'worklet'
  return (DRAG_LIMIT_PX * distance) / (DRAG_LIMIT_PX + Math.abs(distance))
}

/**
 * 놓았을 때 닫을지. 위로 민 것만 닫는 몸짓이다.
 *
 * @param distanceY 끈 세로 거리. 위가 음수
 * @param velocityY 놓는 순간의 세로 속도. 위가 음수
 */
export function shouldCloseOnRelease(distanceY: number, velocityY: number): boolean {
  'worklet'
  return distanceY <= -CLOSE_DISTANCE_PX || velocityY <= -CLOSE_VELOCITY
}

/**
 * 끄는 동안의 스크림 불투명도 배수(0 ~ 1).
 *
 * @param translateY 시트가 실제로 옮겨진 세로 거리. 위가 음수
 */
export function scrimOpacityFor(translateY: number): number {
  'worklet'
  if (translateY >= 0) return 1
  return Math.max(0, 1 + translateY / SCRIM_FADE_PX)
}

/**
 * 시트 높이의 상한. 키보드가 있으면 키보드 위, 없으면 하단 안전영역 위까지다.
 * 키보드 높이는 하단 안전영역을 이미 품고 있어 둘 중 큰 쪽만 뺀다.
 */
export function topSheetMaxHeight(input: {
  windowHeight: number
  keyboardHeight: number
  topInset: number
  bottomInset: number
}): number {
  'worklet'
  return (
    input.windowHeight -
    input.topInset -
    Math.max(input.keyboardHeight, input.bottomInset) -
    TOP_SHEET_BOTTOM_GAP_PX
  )
}
