/**
 * 시트 안의 `TextInput` 은 **시트가 아는 입력**이어야 한다([[ADR-170]] 정정 5).
 *
 * `@gorhom/bottom-sheet` 는 `BottomSheetTextInput` 의 `onFocus` 가 채우는 `target` 이 없으면
 * 키보드 이벤트를 받고도 상태를 **안 올린다**(라이브러리 소스 `useAnimatedKeyboard`). 그래서
 * 평범한 `TextInput` 을 쓰면 키보드가 떠도 시트가 한 번도 안 올라간다 — 기기 문제가 아니라 결정적이다.
 *
 * 그 판정을 **아톰이** 한다. 호출부가 부품을 고르게 두면 다음에 시트를 만드는 사람이 같은 것을
 * 다시 겪는다(이 아톰이 존재하는 이유 그대로 — `Text.tsx` 파일 머리).
 */
const mockInsideSheet = jest.fn<unknown, [boolean?]>(() => null)

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    useBottomSheetInternal: (unsafe?: boolean) => mockInsideSheet(unsafe),
    // **상자로 감싼다** — 안쪽에 프롭을 그대로 흘려보내야 클램프를 볼 수 있고, 감싸면 «어느
    // 부품이 그려졌나» 를 호출부의 `testID` 와 안 겹치게 집을 수 있다.
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(
        ReactNative.View,
        { testID: 'sheet-input' },
        React.createElement(ReactNative.TextInput, props),
      ),
  }
})

import { renderAtom } from '../../../__tests__/render-atom'
import { FONT_SCALE_MAX } from '../font-scaling'
import { TextInput } from '../Text'

beforeEach(() => {
  mockInsideSheet.mockReset().mockReturnValue(null)
})

describe('TextInput — 시트 안이면 시트가 아는 입력이다 ([[ADR-170]] 정정 5)', () => {
  it('시트 밖에서는 react-native 의 것을 그린다', async () => {
    const { queryByTestId, getByTestId } = await renderAtom(<TextInput testID="칸" />)

    expect(queryByTestId('sheet-input')).toBeNull()
    expect(getByTestId('칸')).toBeTruthy()
  })

  it('시트 안에서는 BottomSheetTextInput 을 그린다', async () => {
    mockInsideSheet.mockReturnValue({})

    const { getByTestId } = await renderAtom(<TextInput testID="칸" />)

    expect(getByTestId('sheet-input')).toBeTruthy()
  })

  // 시트 밖에서 던지면 화면이 죽는다 — `unsafe` 를 줘야 `null` 로 돌아온다.
  it('시트 밖에서 안 던지도록 unsafe 로 묻는다', async () => {
    await renderAtom(<TextInput testID="칸" />)

    expect(mockInsideSheet).toHaveBeenCalledWith(true)
  })

  // 어느 쪽을 그리든 클램프는 그대로다 — 이 아톰이 존재하는 첫째 이유다([[ADR-152]] 결정 4).
  it('어느 쪽이든 글자 배수 클램프가 붙는다', async () => {
    mockInsideSheet.mockReturnValue({})
    const 시트안 = await renderAtom(<TextInput testID="칸" />)
    expect(시트안.getByTestId('칸').props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX)

    mockInsideSheet.mockReturnValue(null)
    const 시트밖 = await renderAtom(<TextInput testID="칸" />)
    expect(시트밖.getByTestId('칸').props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX)
  })
})
