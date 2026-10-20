// 보스 줄의 난이도 고르개. 고른 배지 하나가 펼쳐져 모든 난이도가 된다.
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { DifficultyExpander } from '../DifficultyExpander'

function render(onChange = jest.fn()) {
  return renderAtom(
    <DifficultyExpander label="스우" difficulties={['normal', 'hard', 'extreme']} value="hard" onChange={onChange} />,
  )
}

describe('DifficultyExpander', () => {
  it('접힌 동안에는 고른 난이도 하나만 보인다', async () => {
    const view = await render()

    expect(view.getByLabelText('스우 난이도 하드, 눌러서 바꾸기')).toBeTruthy()
    expect(view.queryByRole('radio')).toBeNull()
  })

  // 고르지 않은 난이도도 제 색을 띠되 흐리다.
  it('누르면 모든 난이도가 펼쳐지고, 고르지 않은 난이도는 흐리다', async () => {
    const view = await render()

    await fireEvent.press(view.getByLabelText('스우 난이도 하드, 눌러서 바꾸기'))

    expect(view.getAllByRole('radio')).toHaveLength(3)
    expect(view.getByLabelText('스우 하드').props.accessibilityState.checked).toBe(true)
    expect(flattenStyle(view.getByLabelText('스우 노멀').props.style).opacity as number).toBeLessThan(1)
    expect(flattenStyle(view.getByLabelText('스우 하드').props.style).opacity).toBeUndefined()
  })

  // 펼친 줄이 옆의 스테퍼에 가려 잘리면 안 된다. RN 은 나중 형제를 위에 그리므로 이 부품이 형제보다 위에 서야 한다.
  it('펼친 동안 형제 UI 보다 위에 선다', async () => {
    const view = await render()

    await fireEvent.press(view.getByLabelText('스우 난이도 하드, 눌러서 바꾸기'))

    expect(flattenStyle(view.getByTestId('difficulty-expander').props.style).zIndex as number).toBeGreaterThan(0)
  })

  it('펼친 뒤 고르면 그 난이도를 알린다', async () => {
    const onChange = jest.fn()
    const view = await render(onChange)

    await fireEvent.press(view.getByLabelText('스우 난이도 하드, 눌러서 바꾸기'))
    await fireEvent.press(view.getByLabelText('스우 익스트림'))

    expect(onChange).toHaveBeenCalledWith('extreme')
  })

  // 같은 난이도를 다시 누르면 바꿀 것이 없으니 접기만 한다.
  it('고른 난이도를 다시 누르면 알리지 않는다', async () => {
    const onChange = jest.fn()
    const view = await render(onChange)

    await fireEvent.press(view.getByLabelText('스우 난이도 하드, 눌러서 바꾸기'))
    await fireEvent.press(view.getByLabelText('스우 하드'))

    expect(onChange).not.toHaveBeenCalled()
  })
})
