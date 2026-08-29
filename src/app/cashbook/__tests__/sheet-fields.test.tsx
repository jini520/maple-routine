/**
 * 라벨–값 줄의 값 칸([[ADR-178]] 결정 1 · 정정 4).
 *
 * 값과 단위의 세로가 세 번 어긋났고, 네 번째 화면이 변수를 갈랐다 — **값이 `TextInput` 일 때만**
 * 안 맞았다(`Text` 인 줄은 맞았다). 그래서 **보이는 글자는 언제나 `Text`** 이고 칸은 그 위에
 * 투명하게 얹힌다.
 */
import { flattenStyle, renderAtom } from '../../../components/__tests__/render-atom'
import { FieldTextInput } from '../sheet-fields'

describe('FieldTextInput', () => {
  it('숫자 칸은 **글자가 그리고** 칸은 투명하게 얹힌다', async () => {
    const view = await renderAtom(
      <FieldTextInput
        testID="value"
        value="7,250,000"
        keyboardType="number-pad"
        onChangeText={jest.fn()}
        className="flex-1 text-right text-sm text-text"
      />,
    )

    // 보이는 글자 — 칸이 아니라 `Text` 다(읽어 주는 것은 칸이라 숨긴다).
    expect(view.getByText('7,250,000', { includeHiddenElements: true })).toBeTruthy()
    // 칸은 그리지 않는다 — 그래야 `Text` 인 줄과 같은 조건이 된다.
    const 칸 = flattenStyle(view.getByTestId('value').props.style) as { color: string }
    expect(칸.color).toBe('transparent')
  })

  it('빈 칸도 높이를 지킨다 — 자리표시자는 칸이 그린다', async () => {
    const view = await renderAtom(
      <FieldTextInput
        testID="value"
        value=""
        placeholder="0"
        keyboardType="number-pad"
        onChangeText={jest.fn()}
        className="flex-1 text-right text-sm text-text"
      />,
    )

    // 빈 글자 하나가 상자 높이를 든다 — 없으면 칸이 빌 때 줄이 접힌다.
    expect(view.getByText(' ', { includeHiddenElements: true })).toBeTruthy()
    // 자리표시자는 글자색과 따로 노는 값이라(`placeholderTextColor`) 투명해져도 보인다.
    expect(view.getByTestId('value').props.placeholder).toBe('0')
  })

  /**
   * 한글은 IME 가 칸 안에서 조합을 쥐고 있어([[ADR-170]] 정정 12) 부모 상태가 한 글자 늦는다 —
   * 그리는 쪽이 부모 상태면 **조합 중인 글자가 안 보인다**. 그런 칸은 옆에 단위도 없다.
   */
  it('글자 칸은 그대로 칸이 그린다 — 조합이 살아야 한다', async () => {
    const view = await renderAtom(
      <FieldTextInput
        testID="name"
        value="앱솔랩스"
        onChangeText={jest.fn()}
        className="flex-1 text-right text-sm text-text"
      />,
    )

    const 칸 = flattenStyle(view.getByTestId('name').props.style) as { color?: string }
    expect(칸.color).not.toBe('transparent')
    // 겹쳐 그리는 글자가 없다 — 칸 하나뿐이다.
    expect(view.queryByText('앱솔랩스', { includeHiddenElements: true })).toBeNull()
  })
})
