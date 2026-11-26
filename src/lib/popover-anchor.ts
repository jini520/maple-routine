/** 꼬리(`PopoverCaret`)의 폭 · 높이. 높이 중 `CARET_OVERLAP` 은 상자 변 안에 겹친다 */
export const CARET_WIDTH = 12
export const CARET_HEIGHT = 7
/** 밑변이 상자 변과 맞닿기만 하면 그 사이에 틈이 보여 1 겹친다 */
export const CARET_OVERLAP = 1
/** 꼬리가 상자 끝에서 띄우는 최소 거리. 이보다 가면 반경 12 모서리의 둥근 곳에 걸린다 */
const CARET_INSET = 10

export interface PopoverAnchorInput {
  /** 팝오버가 들어갈 컨테이너(카드)의 폭 */
  containerWidth: number
  /** 트리거 중심의 x. 컨테이너 왼쪽 변 기준 */
  anchorCenterX: number
  popoverWidth: number
  /** 컨테이너 좌우로 남길 최소 여백 */
  edgeGap: number
  /** 꼬리(caret) 한 변 */
  caretSize: number
}

export interface PopoverAnchorGeometry {
  /** 컨테이너 기준 팝오버 left */
  left: number
  /** 팝오버 기준 꼬리 left */
  caretLeft: number
}

/**
 * 트리거 x에 맞춘 팝오버와 꼬리 위치.
 *
 * 트리거가 컨테이너 가장자리 쪽에 있으면 팝오버를 그대로 두면 밖으로 나간다. 팝오버는 `edgeGap`
 * 안쪽으로 clamp하고 **꼬리만 트리거를 지목**한다. 그래서 clamp된 상황에서도 "어느 것을 눌러서 뜬
 * 설명인지"가 남는다. 꼬리도 팝오버 모서리를 넘지 않게 제한한다(넘으면 둥근 모서리에 잘린다).
 *
 * 보스 수익 카드에서 이 계산이 필요한 이유: 트리거(실패 아이콘)가 금액 위에 붙어 있고 **금액은
 * 자릿수에 따라 폭이 변해** 트리거 x를 고정값으로 알 수 없다.
 */
export function anchorPopover(input: PopoverAnchorInput): PopoverAnchorGeometry {
  const { containerWidth, anchorCenterX, popoverWidth, edgeGap, caretSize } = input

  const maxLeft = Math.max(edgeGap, containerWidth - popoverWidth - edgeGap)
  // 트리거가 팝오버 왼쪽에서 살짝 안쪽에 오도록 두고(왼쪽 정렬보다 자연스럽다) 범위로 자른다.
  const left = Math.min(Math.max(anchorCenterX - 24, edgeGap), maxLeft)

  return { left, caretLeft: caretLeftOf(anchorCenterX - left, popoverWidth, caretSize, CARET_INSET) }
}

function caretLeftOf(anchorInBox: number, boxWidth: number, caretSize: number, inset: number): number {
  return Math.min(Math.max(anchorInBox - caretSize / 2, inset), boxWidth - inset - caretSize)
}

/**
 * 앵커 가운데에 맞춰 뜨는 말풍선과 꼬리 위치. 차트 밖으로 나가면 상자만 안쪽으로 밀고 꼬리는 앵커를 따라간다.
 *
 * @example
 * centerBubble({ containerWidth: width, anchorCenterX: x(selected), bubbleWidth, caretSize: CARET_WIDTH, edgeGap: -BUBBLE_OVERHANG, caretInset: 8 })
 */
export function centerBubble(input: {
  containerWidth: number
  anchorCenterX: number
  bubbleWidth: number
  caretSize: number
  /** 컨테이너 끝에서 띄울 거리. 음수면 그만큼 밖으로 나간다 */
  edgeGap?: number
  /** 꼬리가 상자 끝에서 띄우는 최소 거리. 상자 모서리 반경에 맞춘다 */
  caretInset?: number
}): PopoverAnchorGeometry {
  const edgeGap = input.edgeGap ?? 0
  const maxLeft = input.containerWidth - edgeGap - input.bubbleWidth
  const left = Math.max(edgeGap, Math.min(input.anchorCenterX - input.bubbleWidth / 2, maxLeft))
  return {
    left,
    caretLeft: caretLeftOf(input.anchorCenterX - left, input.bubbleWidth, input.caretSize, input.caretInset ?? CARET_INSET),
  }
}
