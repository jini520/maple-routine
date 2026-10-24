// 보스 줄의 난이도 고르개. 고른 배지 하나가 펼쳐져 모든 난이도가 된다.
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { BADGE_VARIANT } from '../../../atoms/Badge/variants'
import { __resetNativePortsForTest, setHapticsPort } from '../../../../native/ports'
import { DifficultyExpander } from '../DifficultyExpander'

function render(onChange = jest.fn(), align?: 'start' | 'end') {
  return renderAtom(
    <DifficultyExpander
      label="스우"
      difficulties={['normal', 'hard', 'extreme']}
      value="hard"
      onChange={onChange}
      align={align}
    />,
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

  // 카오스의 금테 · 익스트림의 붉은 테두리가 정식 디자인이다. 고르개만 테두리를 빼면 같은 난이도가 화면마다 달라 보인다.
  it('배지가 난이도 배지(`Badge`)와 같은 테두리를 그린다', async () => {
    const view = await render()

    const pill = view.getAllByTestId('difficulty-pill-hard')[0]
    expect(flattenStyle(pill.props.style)).toMatchObject(BADGE_VARIANT.hard.border)
  })

  // 바탕은 옆 UI 를 덮는다. 일러스트 위처럼 바탕이 드러나는 자리에서 한쪽만 넓으면 배지 줄과 어긋나 보인다.
  it.each(['start', 'end'] as const)('펼친 줄 바탕이 배지 줄을 사방으로 같은 여백만큼 감싼다 (%s)', async (align) => {
    const view = await render(jest.fn(), align)

    await fireEvent.press(view.getByLabelText('스우 난이도 하드, 눌러서 바꾸기'))

    const { left, right, top, bottom } = flattenStyle(view.getByTestId('difficulty-expander-plate').props.style)
    expect(left).toBeLessThan(0)
    expect([right, top, bottom]).toEqual([left, left, left])
  })

  // 줄 오른쪽 끝에 붙은 고르개가 오른쪽으로 펼치면 화면 밖으로 넘친다.
  it('`end` 면 펼친 줄이 오른쪽 끝에 붙어 왼쪽으로 선다', async () => {
    const view = await render(jest.fn(), 'end')

    await fireEvent.press(view.getByLabelText('스우 난이도 하드, 눌러서 바꾸기'))

    const lane = flattenStyle(view.getByTestId('difficulty-expander-lane').props.style)
    expect(lane.right).toBe(0)
    expect(lane.left).toBeUndefined()
  })
})

// 선택이 실제로 바뀔 때만 손끝이 답한다. 같은 난이도를 다시 누르는 것은 바뀌는 것이 없다.
describe('DifficultyExpander 의 촉각', () => {
  const select = jest.fn(async () => undefined)

  beforeEach(() => {
    select.mockClear()
    setHapticsPort({ tap: async () => {}, select })
  })

  afterEach(__resetNativePortsForTest)

  it('다른 난이도를 고르면 한 번 난다', async () => {
    const view = await render()

    await fireEvent.press(view.getByLabelText('스우 난이도 하드, 눌러서 바꾸기'))
    await fireEvent.press(view.getByLabelText('스우 익스트림'))

    expect(select).toHaveBeenCalledTimes(1)
  })

  it('고른 난이도를 다시 누르면 안 난다', async () => {
    const view = await render()

    await fireEvent.press(view.getByLabelText('스우 난이도 하드, 눌러서 바꾸기'))
    await fireEvent.press(view.getByLabelText('스우 하드'))

    expect(select).not.toHaveBeenCalled()
  })
})
