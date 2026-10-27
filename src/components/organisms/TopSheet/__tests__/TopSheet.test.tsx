// 위에서 내려오는 시트.
//
// 끄는 몸짓 자체는 제스처 라이브러리가 jest 에서 돌지 않아 여기서 보지 않는다. 끄는 셈은 `top-sheet-drag.test.ts` 가 본다.
import { BackHandler, Text } from 'react-native'
import { act, fireEvent } from '@testing-library/react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'

import { flattenStyle, renderOverlay, 테스트_안전영역 } from '../../../__tests__/render-atom'
import { TopSheet } from '../TopSheet'

// jest 의 reanimated 는 움직임이 끝난 값을 `style` 에 다시 적지 않아 첫 렌더의 불투명도 0 이 남는다.
// 그래서 테스트 라이브러리는 이 층을 숨은 요소로 본다. 쿼리마다 숨은 요소를 포함한다.
const 숨김포함 = { includeHiddenElements: true }

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

/** 들어오고 나가는 움직임이 다 끝날 만큼 시간을 흘린다. */
async function settle(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })
}

async function open(onClose: () => void): Promise<Awaited<ReturnType<typeof renderOverlay>>> {
  const view = await renderOverlay(
    <TopSheet label="API 키 입력" testId="key-sheet" onClose={onClose}>
      <Text>시트 내용</Text>
    </TopSheet>,
  )
  await settle()
  return view
}

describe('TopSheet: 닫기', () => {
  it('스크림을 누르면 나가는 움직임을 거쳐 부모에 알린다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await open(onClose)

    await fireEvent.press(getByTestId('key-sheet-scrim', 숨김포함))
    expect(onClose).not.toHaveBeenCalled()
    await settle()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('안드로이드 뒤로가기도 같은 닫기이고, 뒤로가기를 여기서 끊는다', async () => {
    const onClose = jest.fn()
    const handlers: (() => boolean)[] = []
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      handlers.push(handler as () => boolean)
      return { remove: jest.fn() }
    })
    await open(onClose)

    let consumed = false
    await act(async () => {
      consumed = handlers.at(-1)?.() ?? false
    })

    expect(consumed).toBe(true)
    await settle()
    expect(onClose).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('두 번 눌러도 부모에 한 번만 알린다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await open(onClose)

    await fireEvent.press(getByTestId('key-sheet-scrim', 숨김포함))
    await fireEvent.press(getByTestId('key-sheet-scrim', 숨김포함))
    await settle()

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('TopSheet: 높이 상한', () => {
  const 화면높이 = 테스트_안전영역.frame.height
  const 위 = 테스트_안전영역.insets.top

  afterEach(() => {
    jest.mocked(useReanimatedKeyboardAnimation).mockRestore?.()
  })

  it('키보드가 올라오면 키보드 위에 남은 높이로 줄어든다', async () => {
    const 키보드 = 304
    jest.mocked(useReanimatedKeyboardAnimation).mockReturnValue({
      height: { value: -키보드, get: () => -키보드 },
      progress: { value: 1, get: () => 1 },
    } as never)

    const { getByTestId } = await open(jest.fn())

    expect(flattenStyle(getByTestId('key-sheet', 숨김포함).props.style).maxHeight).toBe(화면높이 - 위 - 키보드 - 8)
  })
})
