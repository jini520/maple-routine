/**
 * 떠 있는 바텀시트의 자리와 끌기. 상단 시트를 위아래로 뒤집은 규칙이다.
 *
 * UI 스레드의 제스처 콜백에서 부르므로 끌기 셈은 worklet 이다.
 */
import { dragOffset } from '../TopSheet/top-sheet-drag'

/** 시트와 화면 옆 사이. 아래 간격의 하한도 이 값이다. 상단 시트와 같다. */
export const SHEET_SIDE_GAP_PX = 10

/** 놓았을 때 제자리로 돌아오는 스프링. 상단 시트와 같다. */
export const SNAP_BACK = { damping: 16, stiffness: 220, mass: 0.8 }

/**
 * 시트와 화면 아래 사이. 하단 안전영역만큼 띄우되 옆 간격보다 작으면 옆 간격만큼 띄운다.
 * 그대로 두면 안전영역이 0 인 기기에서 시트가 바닥에 붙는다.
 */
export function sheetBottomGap(bottomInset: number): number {
  return Math.max(bottomInset, SHEET_SIDE_GAP_PX)
}

/** 위 모서리 반경. 상단 시트와 같다. 화면 반경을 모르면 아래 모서리도 이 값이다. */
export const SHEET_RADIUS = 28

/**
 * 바닥 줄 주 버튼이 정확히 동심원일 때의 반경. 버튼 반경 26 은 이보다 8% 커서 곡률을 조금 더 준다. 버튼이 시트 안쪽에
 * 있어 정확히 맞추는 것보다 자연스럽다.
 */
const BUTTON_CONCENTRIC_RADIUS = 24

/** 바닥 줄과 내용의 좌우 여백. 버튼 간격은 이보다 작아지지 않는다. */
const CONTENT_INSET = 16

/**
 * 시트의 아래쪽 모양. 아래 간격 · 아래 모서리 반경 · 바닥 줄 여백 · 내용만 있을 때의 바닥 여백 · 주 버튼 간격.
 *
 * 화면 모서리가 둥글면 옆과 같은 간격으로 띄우고 아래 모서리를 화면 곡률과 동심원(`화면 반경 − 간격`)으로 맞춘다. 그러면
 * 홈 막대가 시트 위에 겹치므로 바닥 여백이 그만큼을 비운다. 반경을 모르거나 0 이면 안전영역 위에 띄우고 모서리는 28 이다.
 * 바닥 줄 없이 내용만 있으면 아래 모서리 반경만큼 비운다. 버튼과 달리 내용은 곡선에 맞춰 깎을 수 없다.
 * 주 버튼은 시트 가장자리에서 `아래 모서리 반경 − 24` 만큼(16 이상) 떨어져 아래 모서리와 동심원에 가깝게 선다.
 *
 * @param screenRadius 화면 모서리 반경. 모르면 `null`
 * @param bottomInset 하단 안전영역
 */
export function sheetShape(
  screenRadius: number | null,
  bottomInset: number,
): { bottomGap: number; bottomRadius: number; bottomPadding: number; contentPadding: number; buttonGap: number } {
  const concentric = screenRadius !== null && screenRadius > 0
  const bottomGap = concentric ? SHEET_SIDE_GAP_PX : sheetBottomGap(bottomInset)
  const bottomRadius = concentric ? Math.max(0, screenRadius - SHEET_SIDE_GAP_PX) : SHEET_RADIUS
  const buttonGap = Math.max(CONTENT_INSET, bottomRadius - BUTTON_CONCENTRIC_RADIUS)
  const bottomPadding = Math.max(CONTENT_INSET, bottomInset - bottomGap, buttonGap)
  return { bottomGap, bottomRadius, bottomPadding, contentPadding: Math.max(bottomPadding, bottomRadius), buttonGap }
}

/**
 * 끈 거리를 시트 층이 따라가는 거리로 바꾼다.
 *
 * 아래는 닫는 몸짓이라 라이브러리가 시트를 직접 옮기고, 층은 따라가지 않는다. 좌우와 위(화면 안쪽)는 상단 시트의
 * `dragOffset` 한계까지만 약간 따라온다.
 *
 * @param distanceX 손가락이 움직인 가로 거리
 * @param distanceY 손가락이 움직인 세로 거리. 위가 음수
 */
export function bottomSheetDragOffset(distanceX: number, distanceY: number): { x: number; y: number } {
  'worklet'
  return {
    x: dragOffset(distanceX, 0).x,
    y: distanceY < 0 ? -dragOffset(0, -distanceY).y : 0,
  }
}

/**
 * 라이브러리 열거형 `ANIMATION_SOURCE.SNAP_POINT_CHANGE` · `ANIMATION_STATUS.RUNNING` 의 값. 진입점에서 가져오면 라이브러리를
 * 가짜로 세우는 테스트에서 열거형이 없어 깨진다. 라이브러리를 올려 값이 바뀌면 `bottom-sheet-drag.test` 가 잡는다.
 */
const SNAP_POINT_CHANGE = 5
const RUNNING = 1

/**
 * 바탕 · 내용 층의 높이. 내용 높이가 바뀌어 시트 자리가 움직이는 동안에만 값이 있고, 아니면 `null`(내용 높이 그대로)이다.
 *
 * 라이브러리는 내용 높이를 바로 바꾸고 자리는 애니메이션으로 따라간다. 그 사이 시트 바닥이 커질 때는 아래 간격을 덮고
 * 화면 밖으로 내려갔고, 줄어들 때는 위로 떠 틈이 생겼다(실기기 녹화). 이 높이면 바닥은 떠 있는 자리에 남고 윗변만 움직인다.
 * 끌기 · 열기 · 닫기는 시트 전체가 미끄러져야 하므로 붙들지 않는다.
 *
 * @param state 라이브러리의 애니메이션 상태(`animatedAnimationState`)
 * @param containerHeight 라이브러리 컨테이너 높이. 이미 아래 간격만큼 줄어든 상자라 그 바닥이 곧 떠 있는 바닥이다
 * @param position 지금 시트 윗변의 자리(`animatedPosition`)
 */
export function floatingLayerHeight(
  state: { source: number; status: number },
  containerHeight: number,
  position: number,
): number | null {
  'worklet'
  if (state.source !== SNAP_POINT_CHANGE || state.status !== RUNNING) return null
  return containerHeight - position
}
