/**
 * 드롭다운 목록이 펼쳐지는 움직임의 수. 열린 쪽(`placeDropdown` 의 `side`)에 따라 뒤집는다. 칸에 닿는 쪽에서부터 펼쳐져야
 * 목록이 칸과 이어져 보인다.
 */

import { DROPDOWN_SHADOW, type ShadowLayer } from './shadow'

export type DropdownSide = 'below' | 'above'

/** 목록이 펼쳐지기 시작할 때의 세로 배율 */
export const LIST_START_SCALE = 0.85
/** 보기가 나타나며 움직이는 거리 */
const ITEM_TRAVEL_PX = 4
/** 보기마다 늦게 시작하는 시간 */
const ITEM_STAGGER_MS = 40

/**
 * 목록 상자의 처음 세로 위치. 가운데 기준으로 줄인 상자를 칸에 닿는 변 쪽으로 밀어, 그 변을 기준으로 자라게 한다.
 * `Animated.View` 에 정적 `transformOrigin` 을 주면 버려져서 이렇게 민다.
 */
export function listStartOffset(height: number, gap: number, side: DropdownSide): number {
  const offset = gap + (height * (1 - LIST_START_SCALE)) / 2
  return side === 'below' ? -offset : offset
}

/** 보기의 처음 세로 위치. 아래로 열리면 위에서 내려오고, 위로 열리면 아래에서 올라온다 */
export function itemStartOffset(side: DropdownSide): number {
  return side === 'below' ? -ITEM_TRAVEL_PX : ITEM_TRAVEL_PX
}

/** 보기가 늦게 시작하는 시간. 칸에 가까운 보기부터 나타난다 */
export function itemDelay(index: number, count: number, side: DropdownSide): number {
  return (side === 'below' ? index : count - 1 - index) * ITEM_STAGGER_MS
}

/** 목록의 그림자. 칸에서 먼 쪽으로 진다. 위로 열린 목록의 그림자가 아래 칸 쪽으로 지면 어색하다 */
export function listShadowOf(side: DropdownSide): ShadowLayer {
  return side === 'below' ? DROPDOWN_SHADOW : { ...DROPDOWN_SHADOW, y: -DROPDOWN_SHADOW.y }
}
