/**
 * 모달 카드가 가질 수 있는 높이. 위아래 안전영역과 여백을 뺀 값.
 *
 * 높은 화면에서는 어느 모달도 여기에 안 닿는다. 짧은 화면(폴드 커버 · 인너)에서 카드가 화면
 * 밖으로 넘치지 않게 막는 값이고, 넘치는 몫은 카드 안 스크롤이 받는다.
 */
import { Dimensions, Platform } from 'react-native'

/** 위 정렬 카드가 상단 안전영역 아래에 두는 여백. 스크림의 `paddingTop` 과 같은 값이어야 한다. */
export const MODAL_TOP_GAP_PX = 32

/** 카드와 하단 안전영역 사이, 가운데 정렬에서는 위아래 양쪽의 여백. */
export const MODAL_EDGE_GAP_PX = 16

/** 모달 카드의 상한 높이. */
export function resolveModalMaxHeight(input: {
  windowHeightPx: number
  insetTopPx: number
  insetBottomPx: number
  align: 'top' | 'center'
}): number {
  const top = input.align === 'top' ? input.insetTopPx + MODAL_TOP_GAP_PX : input.insetTopPx + MODAL_EDGE_GAP_PX
  const bottom = input.insetBottomPx + MODAL_EDGE_GAP_PX
  return input.windowHeightPx - top - bottom
}

/**
 * 오버레이(RN `Modal`) 창의 높이.
 *
 * 안드로이드 모달 창은 내비 바까지 덮어 표시 높이와 같다. `useWindowDimensions` 는 기기에 따라
 * 내비 바를 뺀 값을 내므로 그것으로 재면 아래 인셋을 두 번 뺀다. iOS 는 창 높이 그대로다.
 */
export function overlayWindowHeightPx(windowHeightPx: number): number {
  return Platform.OS === 'android' ? Dimensions.get('screen').height : windowHeightPx
}
