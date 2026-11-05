/**
 * 바텀시트 끌기 처리기. 라이브러리 기본 처리기 위에 시트 층이 따라가는 거리와 끌기의 출처를 얹는다.
 */
import {
  GESTURE_SOURCE,
  useBottomSheetInternal,
  useGestureEventsHandlersDefault,
  type GestureEventsHandlersHookType,
} from '@gorhom/bottom-sheet'
import { useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated'

import { bottomSheetDragOffset, SNAP_BACK } from './bottom-sheet-drag'

/** 스크롤 밖에 고정된 머리 · 바닥 줄의 높이. 없는 줄은 0 이다. */
export interface FixedRows {
  top: number
  bottom: number
}

/**
 * 이번 끌기를 라이브러리에 넘기는 출처. 손가락을 댄 자리가 머리나 바닥 줄 안이면 핸들 끌기다.
 *
 * 내용 끌기는 스크롤된 거리만큼을 스크롤을 되감는 몫으로 먼저 쓰는데, 스크롤 밖 줄에서는 그동안 아무것도 안 움직인다.
 * 끌기는 손가락이 조금 움직인 뒤에 잡히므로 잡힌 자리(`y`)가 아니라 댄 자리(`y − translationY`)로 가른다.
 *
 * @param source 라이브러리가 준 출처
 * @param payload 끌기가 잡힌 순간의 값. `y` 는 시트 윗변에서 잰다
 * @param sheetHeight 시트 높이
 * @param rows 머리 · 바닥 줄의 높이
 */
function sheetDragSource(
  source: GESTURE_SOURCE,
  payload: { y: number; translationY: number },
  sheetHeight: number,
  rows: FixedRows,
): GESTURE_SOURCE {
  'worklet'
  if (source !== GESTURE_SOURCE.CONTENT) return source
  const startY = payload.y - payload.translationY
  return startY < rows.top || startY > sheetHeight - rows.bottom ? GESTURE_SOURCE.HANDLE : source
}

/**
 * @param dragX 끄는 동안 시트 층이 좌우로 따라간 거리
 * @param dragY 끄는 동안 시트 층이 위로 따라간 거리
 * @param fixedRows 머리 · 바닥 줄의 높이
 */
export function sheetDragHandlers(
  dragX: SharedValue<number>,
  dragY: SharedValue<number>,
  fixedRows: SharedValue<FixedRows>,
): GestureEventsHandlersHookType {
  return function useSheetDragHandlers() {
    const base = useGestureEventsHandlersDefault()
    const { animatedLayoutState, animatedPosition } = useBottomSheetInternal()
    /** 놓을 때까지 같은 출처를 넘긴다. 손가락이 끄는 중에 다른 칸 위로 넘어가도 바뀌지 않는다. */
    const dragSource = useSharedValue(GESTURE_SOURCE.CONTENT)
    return {
      handleOnStart(source, payload) {
        'worklet'
        // 라이브러리 컨테이너의 바닥이 곧 떠 있는 시트의 바닥이다.
        const sheetHeight = animatedLayoutState.get().containerHeight - animatedPosition.get()
        dragSource.set(sheetDragSource(source, payload, sheetHeight, fixedRows.get()))
        base.handleOnStart(dragSource.get(), payload)
      },
      handleOnChange(_source, payload) {
        'worklet'
        base.handleOnChange(dragSource.get(), payload)
        const offset = bottomSheetDragOffset(payload.translationX, payload.translationY)
        dragX.set(offset.x)
        dragY.set(offset.y)
      },
      // 둘 다에서 돌려놓는다. 라이브러리는 정상 종료(`onEnd`) 뒤의 `onFinalize` 를 처리기까지 넘기지 않아, 한쪽에만 두면
      // 놓은 뒤에도 시트가 옆으로 밀린 채 남았다(실기기).
      handleOnEnd(_source, payload) {
        'worklet'
        base.handleOnEnd(dragSource.get(), payload)
        dragX.set(withSpring(0, SNAP_BACK))
        dragY.set(withSpring(0, SNAP_BACK))
      },
      handleOnFinalize(_source, payload) {
        'worklet'
        base.handleOnFinalize(dragSource.get(), payload)
        dragX.set(withSpring(0, SNAP_BACK))
        dragY.set(withSpring(0, SNAP_BACK))
      },
    }
  }
}
