/**
 * 바텀시트 끌기 처리기. 내용을 스크롤한 시트에서 어디를 잡고 끄느냐에 따라 시트가 언제 내려오는지 본다.
 *
 * 라이브러리 기본 처리기(`useGestureEventsHandlersDefault`)를 진짜로 돌린다. 결함이 그 처리기가 스크롤된 거리를 먼저 쓰는
 * 데서 나왔으므로, 그것을 가짜로 세우면 고쳤는지 알 수 없다. 처리기가 읽는 시트 상태만 가짜로 넣는다.
 */
import { createElement, type Context, type ReactNode } from 'react'
import { renderHook } from '@testing-library/react-native'
import { makeMutable } from 'react-native-reanimated'
import {
  GESTURE_SOURCE,
  KEYBOARD_STATUS,
  SCROLLABLE_TYPE,
  type GestureEventsHandlersHookType,
} from '@gorhom/bottom-sheet'

import { sheetDragHandlers } from '../sheet-drag-handlers'

/** 라이브러리가 자기 상태를 내려보내는 통로. 진입점이 내보내지 않아 jest 가 읽는 빌드의 파일을 직접 연다. */
const { BottomSheetInternalContext } = jest.requireActual<{ BottomSheetInternalContext: Context<unknown> }>(
  '@gorhom/bottom-sheet/lib/commonjs/contexts/internal',
)

type 처리기 = ReturnType<GestureEventsHandlersHookType>
type 끌기값 = Parameters<처리기['handleOnStart']>[1]

const 컨테이너 = 844
/** 열린 시트의 윗변. 시트 높이는 544 다. */
const 윗변 = 300
const 시트높이 = 컨테이너 - 윗변
const 머리 = 90
const 바닥줄 = 80
/** 내용을 맨 아래까지 내린 거리. 아래로 끄는 거리보다 길어야 결함이 보인다. */
const 스크롤된거리 = 400
/** 손가락이 이만큼 움직인 뒤에야 끌기가 잡힌다. */
const 잡히는거리 = 12

function 시트상태() {
  return {
    animatedPosition: makeMutable(윗변),
    animatedDetentsState: makeMutable({ highestDetentPosition: 윗변, detents: [윗변], closedDetentPosition: 컨테이너 }),
    animatedKeyboardState: makeMutable({ status: KEYBOARD_STATUS.UNDETERMINED, heightWithinContainer: 0 }),
    animatedScrollableState: makeMutable({
      contentOffsetY: 스크롤된거리,
      refreshable: false,
      type: SCROLLABLE_TYPE.SCROLLVIEW,
    }),
    animatedLayoutState: makeMutable({ containerHeight: 컨테이너, window: { height: 컨테이너 } }),
    isInTemporaryPosition: makeMutable(false),
    enableOverDrag: true,
    enablePanDownToClose: true,
    // 시트가 넘기는 값과 같다. 위로 끌어도 안 늘어난다.
    overDragResistanceFactor: 0,
    enableBlurKeyboardOnGesture: false,
    animateToPosition: jest.fn(),
    stopAnimation: jest.fn(),
  }
}

async function 열기(): Promise<{ 상태: ReturnType<typeof 시트상태>; 처리기: 처리기 }> {
  const 상태 = 시트상태()
  const hook = sheetDragHandlers(makeMutable(0), makeMutable(0), makeMutable({ top: 머리, bottom: 바닥줄 }))
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(BottomSheetInternalContext.Provider, { value: 상태 }, children)
  const { result } = await renderHook(() => hook(), { wrapper })
  return { 상태, 처리기: result.current }
}

/** 시트 윗변에서 잰 자리 `y` 와 손가락을 댄 뒤 움직인 거리. */
function 값(y: number, translationY: number, velocityY = 0): 끌기값 {
  return { x: 0, y, absoluteX: 0, absoluteY: 윗변 + y, translationX: 0, translationY, velocityX: 0, velocityY } as 끌기값
}

/** 시트의 `닿은자리` 에 손가락을 대고 `거리` 만큼 아래로 끈다. 라이브러리는 이 끌기를 늘 내용 끌기로 넘긴다. */
function 끌기(처리기: 처리기, 닿은자리: number, 거리: number): void {
  처리기.handleOnStart(GESTURE_SOURCE.CONTENT, 값(닿은자리 + 잡히는거리, 잡히는거리))
  처리기.handleOnChange(GESTURE_SOURCE.CONTENT, 값(닿은자리 + 거리, 거리))
}

describe('sheetDragHandlers: 내용을 맨 아래까지 스크롤한 시트', () => {
  it('머리를 잡고 끌면 손가락을 바로 따라 내려온다', async () => {
    const { 상태, 처리기 } = await 열기()

    끌기(처리기, 10, 80)

    expect(상태.animatedPosition.value).toBe(윗변 + 80)
  })

  it('바닥 줄을 잡고 끌어도 손가락을 바로 따라 내려온다', async () => {
    const { 상태, 처리기 } = await 열기()

    끌기(처리기, 시트높이 - 40, 80)

    expect(상태.animatedPosition.value).toBe(윗변 + 80)
  })

  // 손가락 밑에서 내용이 그만큼 되감기므로 이쪽은 그대로가 맞다.
  it('스크롤 칸을 잡고 끌면 스크롤된 만큼은 시트가 그대로다', async () => {
    const { 상태, 처리기 } = await 열기()

    끌기(처리기, 200, 80)

    expect(상태.animatedPosition.value).toBe(윗변)
  })

  it('머리 아랫변 가까이 대고 끌어 스크롤 칸 위에서 잡혀도 머리를 잡은 것이다', async () => {
    const { 상태, 처리기 } = await 열기()

    끌기(처리기, 머리 - 5, 80)

    expect(상태.animatedPosition.value).toBe(윗변 + 80)
  })

  it('머리로 끌다 놓으면 끈 거리로 닫을지 정한다. 스크롤된 거리를 빼지 않는다', async () => {
    const { 상태, 처리기 } = await 열기()

    끌기(처리기, 10, 300)
    처리기.handleOnEnd(GESTURE_SOURCE.CONTENT, 값(310, 300))

    expect(상태.animateToPosition).toHaveBeenCalledWith(컨테이너, expect.anything(), expect.anything())
  })
})
