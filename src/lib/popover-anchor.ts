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

  const caretInset = 10
  const caretLeft = Math.min(
    Math.max(anchorCenterX - left - caretSize / 2, caretInset),
    popoverWidth - caretInset - caretSize,
  )

  return { left, caretLeft }
}
