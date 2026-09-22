/** 수수료 줄. `자동` 체크박스를 켜면 명패와 요율, 끄면 세그먼트와 설명 한 줄이다. */
import { fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
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

  it('자동이면 명패와 요율이 이 순서로 서고 설명 줄이 없다', async () => {
    const { view } = render(true)
    const screen = await view

    expect(screen.getByLabelText('MVP 다이아')).toBeTruthy()
    expect(screen.getByText('3%')).toBeTruthy()
    expect(screen.queryByTestId('segment')).toBeNull()
    expect(screen.queryByText('직접 고른 요율이라 등급이 바뀌어도 그대로예요.')).toBeNull()
  })

  it('자동을 끄면 세그먼트와 설명 한 줄이 선다', async () => {
    const { view } = render(false)
    const screen = await view

    expect(screen.getByTestId('segment')).toBeTruthy()
    expect(screen.getByText('직접 고른 요율이라 등급이 바뀌어도 그대로예요.')).toBeTruthy()
  })

  it('체크박스를 누르면 자동을 뒤집는다', async () => {
    const { view, onAutoChange } = render(true)
    const screen = await view

    fireEvent.press(screen.getByRole('checkbox'))

    expect(onAutoChange).toHaveBeenCalledWith(false)
  })

  it('캐릭터를 고르기 전에는 자동의 값 자리가 빈다', async () => {
    const { view } = render(true, null)
    const screen = await view

    expect(screen.queryByText('3%')).toBeNull()
    expect(screen.queryByLabelText(/^MVP /)).toBeNull()
  })
})
