/**
 * 시트 안의 입력 칸. 부품은 RN 것 그대로, 시트가 보는 값만 채운다.
 *
 * `@gorhom/bottom-sheet` 는 `animatedKeyboardState.target` 이 비어 있으면 키보드 이벤트를 받고도
 * 상태를 안 올린다. 그 값을 채우려고 라이브러리의 `BottomSheetTextInput` 을 쓰면 안쪽이
 * `react-native-gesture-handler` 의 입력이라 안드로이드 한글 조합이 깨진다(자모가 따로
 * 확정된다). 그래서 부품을 되돌리고 값만 채운다.
 *
 * 그 값을 채우는 자리가 아톰이 아니라 여기다. 아톰은 자기가 시트 안에 있는지 모른다.
 */
const mockInsideSheet = jest.fn<unknown, [boolean?]>(() => null)

jest.mock('@gorhom/bottom-sheet', () => ({
  useBottomSheetInternal: (unsafe?: boolean) => mockInsideSheet(unsafe),
}))

import { act, fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { FONT_SCALE_MAX } from '../../../atoms/Text/font-scaling'
import { SheetTextInput } from '../SheetTextInput'

/** 라이브러리의 공유값을 흉내 낸다. 훅이 부르는 것은 `get`/`set` 둘뿐이다. */
function 키보드상태(target?: number) {
  let state = { target, status: 0, height: 0 }
  return {
    get: () => state,
    set: (next: (previous: typeof state) => typeof state) => {
      state = next(state)
    },
    현재: () => state,
  }
}

beforeEach(() => {
  mockInsideSheet.mockReset().mockReturnValue(null)
})

describe('SheetTextInput: 부품은 RN 것 하나다', () => {
  it('시트 안이든 밖이든 같은 입력을 그린다', async () => {
    const 시트밖 = await renderAtom(<SheetTextInput testID="칸" />)
    expect(시트밖.getByTestId('칸')).toBeTruthy()

    mockInsideSheet.mockReturnValue({ animatedKeyboardState: 키보드상태() })
    const 시트안 = await renderAtom(<SheetTextInput testID="칸" />)
    expect(시트안.getByTestId('칸')).toBeTruthy()
  })

  // 시트 밖에서 던지면 화면이 죽는다. `unsafe` 를 줘야 `null` 로 돌아온다.
  it('시트 밖에서 안 던지도록 unsafe 로 묻는다', async () => {
    await renderAtom(<SheetTextInput testID="칸" />)

    expect(mockInsideSheet).toHaveBeenCalledWith(true)
  })

  // 이 아톰이 존재하는 첫째 이유다. 시트 배선이 그것을 밀어내면 안 된다.
  it('글자 배수 클램프가 그대로 붙는다', async () => {
    mockInsideSheet.mockReturnValue({ animatedKeyboardState: 키보드상태() })
    const view = await renderAtom(<SheetTextInput testID="칸" />)

    expect(view.getByTestId('칸').props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX)
  })
})

describe('시트가 보는 초점', () => {
  it('커서가 들어오면 채운다. 이것이 없으면 시트가 안 올라간다', async () => {
    const 상태 = 키보드상태()
    mockInsideSheet.mockReturnValue({ animatedKeyboardState: 상태 })
    const view = await renderAtom(<SheetTextInput testID="칸" />)

    await act(async () => {
      fireEvent(view.getByTestId('칸'), 'focus', { nativeEvent: { target: 7 } })
    })

    expect(상태.현재().target).toBe(7)
  })

  it('커서가 빠지면 지운다', async () => {
    const 상태 = 키보드상태()
    mockInsideSheet.mockReturnValue({ animatedKeyboardState: 상태 })
    const view = await renderAtom(<SheetTextInput testID="칸" />)

    await act(async () => {
      fireEvent(view.getByTestId('칸'), 'focus', { nativeEvent: { target: 7 } })
    })
    await act(async () => {
      fireEvent(view.getByTestId('칸'), 'blur', { nativeEvent: { target: 7 } })
    })

    expect(상태.현재().target).toBeUndefined()
  })

  /**
   * **남의 초점은 안 끈다.** 시트 안 두 칸 사이를 오갈 때 켬과 흐림이 어느 순서로 오든 성립해야
   * 한다. 흐림이 먼저면 껐다가 새 칸이 곧 켜고, 켬이 먼저면 흐림은 남의 것이라 안 끈다.
   */
  it('이미 다른 칸이 켜져 있으면 흐림이 안 끈다', async () => {
    const 상태 = 키보드상태()
    mockInsideSheet.mockReturnValue({ animatedKeyboardState: 상태 })
    const view = await renderAtom(<SheetTextInput testID="칸" />)

    await act(async () => {
      fireEvent(view.getByTestId('칸'), 'focus', { nativeEvent: { target: 7 } })
    })
    // 옆 칸이 먼저 켜졌다.
    상태.set((state) => ({ ...state, target: 9 }))

    await act(async () => {
      fireEvent(view.getByTestId('칸'), 'blur', { nativeEvent: { target: 7 } })
    })

    expect(상태.현재().target).toBe(9)
  })

  it('언마운트하면 내 초점을 거둔다. 남의 것은 두고', async () => {
    const 상태 = 키보드상태()
    mockInsideSheet.mockReturnValue({ animatedKeyboardState: 상태 })
    const view = await renderAtom(<SheetTextInput testID="칸" />)

    await act(async () => {
      fireEvent(view.getByTestId('칸'), 'focus', { nativeEvent: { target: 7 } })
    })
    await act(async () => {
      view.unmount()
    })

    expect(상태.현재().target).toBeUndefined()
  })

  it('호출부의 onFocus·onBlur 도 그대로 부른다', async () => {
    const onFocus = jest.fn()
    const onBlur = jest.fn()
    mockInsideSheet.mockReturnValue({ animatedKeyboardState: 키보드상태() })
    const view = await renderAtom(<SheetTextInput testID="칸" onFocus={onFocus} onBlur={onBlur} />)

    await act(async () => {
      fireEvent(view.getByTestId('칸'), 'focus', { nativeEvent: { target: 7 } })
    })
    await act(async () => {
      fireEvent(view.getByTestId('칸'), 'blur', { nativeEvent: { target: 7 } })
    })

    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  // 시트 밖에서는 채울 곳이 없다. 그래도 커서가 들어오고 나가는 것이 안 깨져야 한다.
  it('시트 밖에서는 아무것도 안 채우고 그냥 동작한다', async () => {
    const onFocus = jest.fn()
    const view = await renderAtom(<SheetTextInput testID="칸" onFocus={onFocus} />)

    await act(async () => {
      fireEvent(view.getByTestId('칸'), 'focus', { nativeEvent: { target: 7 } })
    })

    expect(onFocus).toHaveBeenCalledTimes(1)
  })
})
