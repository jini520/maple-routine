/**
 * 상단 시트를 끌 때의 셈. 시트가 얼마나 따라갈지, 놓으면 닫을지, 스크림을 얼마나 옅게 할지, 시트가 얼마나 클 수 있는지.
 *
 * UI 스레드의 제스처 콜백과 애니메이션 스타일에서 부르므로 모두 worklet 이다.
 */

/**
 * 좌우로 시트가 따라가는 한계. 시트와 화면 옆 사이(10)보다 작아야 시트가 화면 옆 가장자리를 넘지 않는다.
 * 정말 약간만 움직인다(사용자 지정).
 */
export const DRAG_SIDE_LIMIT_PX = 6

/** 위에서 내려온 시트가 아래(화면 안쪽)로 따라가는 한계. */
export const DRAG_AWAY_LIMIT_PX = 10

/** 놓았을 때 이만큼 위로 밀려 있으면 닫는다. 끈 거리(손가락)로 잰다. */
export const CLOSE_DISTANCE_PX = 80

/** 놓는 순간 이보다 빠르게 위로 밀고 있으면 거리와 상관없이 닫는다(px/s). */
export const CLOSE_VELOCITY = 900

/** 위로 이만큼 밀면 스크림이 다 사라진다. */
const SCRIM_FADE_PX = 200

/** 시트와 키보드(또는 하단 안전영역) 사이. */
export const TOP_SHEET_BOTTOM_GAP_PX = 8

function resist(distance: number, limit: number): number {
  'worklet'
  return (limit * distance) / (limit + Math.abs(distance))
}

/**
 * 끈 거리를 시트가 따라가는 거리로 바꾼다.
 *
 * 위로는 손가락을 그대로 따라간다. 위로 미는 것은 시트를 닫는 몸짓이라 막지 않는다(사용자 지정). 좌우와 아래는
 * 닫는 몸짓이 아니라서 정말 약간만 따라오고, 멀리 끌수록 덜 따라와 방향마다의 한계에 다가가기만 한다.
 *
 * @param distanceX 손가락이 움직인 가로 거리
 * @param distanceY 손가락이 움직인 세로 거리. 위가 음수
 */
export function dragOffset(distanceX: number, distanceY: number): { x: number; y: number } {
  'worklet'
  return {
    x: resist(distanceX, DRAG_SIDE_LIMIT_PX),
    y: distanceY > 0 ? resist(distanceY, DRAG_AWAY_LIMIT_PX) : distanceY,
  }
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
 * 끄는 동안의 스크림 불투명도 배수(0 ~ 1). 위로 민 만큼 옅어진다.
 *
 * @param distanceY 손가락이 움직인 세로 거리. 위가 음수
 */
export function scrimOpacityFor(distanceY: number): number {
  'worklet'
  if (distanceY >= 0) return 1
  return Math.max(0, 1 + distanceY / SCRIM_FADE_PX)
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
