/** 수수료 줄. `자동` 체크박스를 켜면 명패와 요율, 끄면 세그먼트다. 설명 줄은 없다. */
import { fireEvent, within } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { FeeRow } from '../FeeRow'

const OPTIONS = ['없음', '3%', '5%'] as const

function render(auto: boolean, autoFee: { grade: 'diamond' | 'normal'; percent: number } | null = { grade: 'diamond', percent: 3 }) {
  const onAutoChange = jest.fn()
  const onSelect = jest.fn()
  const view = renderAtom(
    <FeeRow
      label="수수료"
      auto={auto}
      onAutoChange={onAutoChange}
      autoFee={autoFee}
      options={OPTIONS}
      selected="5%"
      onSelect={onSelect}
    />,
  )
  return { view, onAutoChange, onSelect }
}

describe('FeeRow', () => {
  it('자동인데 요율을 아직 모르면 받은 안내를 흐린 글자로 세운다', async () => {
    const screen = await renderAtom(
      <FeeRow
        label="수수료"
        auto
        onAutoChange={jest.fn()}
        autoFee={null}
        autoPlaceholder="캐릭터를 선택해 주세요"
        options={OPTIONS}
        selected="5%"
        onSelect={jest.fn()}
      />,
    )

    expect(screen.getByText('캐릭터를 선택해 주세요')).toBeTruthy()
  })

  it('자동이면 명패와 요율이 이 순서로 선다', async () => {
    const { view } = render(true)
    const screen = await view

    expect(screen.getByLabelText('MVP 다이아')).toBeTruthy()
    expect(screen.getByText('3%')).toBeTruthy()
    expect(screen.queryByTestId('segment')).toBeNull()
  })

  // 체크박스가 꺼져 있는 것이 이미 **직접 고른 요율**을 말한다. 설명 줄은 폼마다 줄 높이를 늘렸다.
  it('자동을 끄면 세그먼트만 서고 설명 줄이 없다', async () => {
    const { view } = render(false)
    const screen = await view

    expect(screen.getByTestId('segment')).toBeTruthy()
    expect(screen.queryByText(/직접 고른 요율/)).toBeNull()
  })

  it('체크박스를 누르면 자동을 뒤집는다', async () => {
    const { view, onAutoChange } = render(true)
    const screen = await view

    fireEvent.press(screen.getByRole('checkbox'))

    expect(onAutoChange).toHaveBeenCalledWith(false)
  })

  // 드롭 가격 카드는 이 줄 둘을 판의 반쪽에 세운다. 한 줄로 두면 이름과 세그먼트가 붙는다.
  it('stacked 는 이름과 자동이 윗줄, 값이 아랫줄이다', async () => {
    const screen = await renderAtom(
      <FeeRow
        testID="fee"
        variant="stacked"
        label="판매 수수료"
        auto
        onAutoChange={jest.fn()}
        autoFee={{ grade: 'diamond', percent: 3 }}
        options={OPTIONS}
        selected="5%"
        onSelect={jest.fn()}
      />,
    )

    expect(flattenStyle(screen.getByTestId('fee').props.style).flexDirection).not.toBe('row')
    expect(flattenStyle(screen.getByTestId('fee-head').props.style).flexDirection).toBe('row')
    // 값은 머리 줄 밖에 있다. 안에 있으면 이름과 한 줄을 다툰다.
    expect(within(screen.getByTestId('fee-head')).queryByLabelText('MVP 다이아')).toBeNull()
    expect(flattenStyle(screen.getByTestId('fee-value').props.style).justifyContent).toBe('flex-end')
    expect(screen.getByLabelText('MVP 다이아')).toBeTruthy()
  })

  // 자동을 켜고 끌 때마다 값 자리가 명패 · 요율(19)과 세그먼트(26)를 오간다. 높이를 안 못박으면
  // 그 7px 만큼 아래의 버튼 줄과 옆 줄이 함께 흔들린다(사용자 지적).
  it.each(['stacked', 'compact'] as const)('%s 는 자동을 켜고 꺼도 값 줄 높이가 안 바뀐다', async (variant) => {
    const 켬 = await renderAtom(
      <FeeRow
        testID="fee"
        variant={variant}
        label="판매 수수료"
        auto
        onAutoChange={jest.fn()}
        autoFee={{ grade: 'diamond', percent: 3 }}
        options={OPTIONS}
        selected="5%"
        onSelect={jest.fn()}
      />,
    )
    const 끔 = await renderAtom(
      <FeeRow
        testID="fee"
        variant={variant}
        label="판매 수수료"
        auto={false}
        onAutoChange={jest.fn()}
        autoFee={{ grade: 'diamond', percent: 3 }}
        options={OPTIONS}
        selected="5%"
        onSelect={jest.fn()}
      />,
    )

    const 높이 = (view: typeof 켬): unknown => flattenStyle(view.getByTestId('fee-value').props.style).height
    expect(높이(켬)).toBe(26)
    expect(높이(끔)).toBe(26)
  })

  it('캐릭터를 고르기 전에는 자동의 값 자리가 빈다', async () => {
    const { view } = render(true, null)
    const screen = await view

    expect(screen.queryByText('3%')).toBeNull()
    expect(screen.queryByLabelText(/^MVP /)).toBeNull()
  })
})
