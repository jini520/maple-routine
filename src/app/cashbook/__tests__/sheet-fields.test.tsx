/**
 * 시트의 고르는 칸(`SelectRow`).
 *
 * 고른 값은 알약이 아니라 다른 칸의 값과 같은 글자다. 안 골랐으면 그 자리에 자리표시자가 선다.
 */
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { SelectRow } from '../sheet-fields'

const 보기 = [
  { value: null, label: '선택 안함' },
  { value: 'ocid-1', label: '루디' },
  { value: 'ocid-2', label: '아델' },
]

async function 그리기(selected: string | null, onSelect = jest.fn()) {
  return await renderOverlay(
    <SelectRow
      testID="row"
      label="캐릭터"
      placeholder="캐릭터 선택"
      options={보기}
      selected={selected}
      onSelect={onSelect}
    />,
  )
}

describe('SelectRow', () => {
  it('안 골랐으면 자리표시자가 값 자리에 선다', async () => {
    const view = await 그리기(null)

    expect(view.getByTestId('row-value')).toHaveTextContent('캐릭터 선택')
  })

  it('고른 값의 이름이 값 자리에 글자로 선다', async () => {
    const view = await 그리기('ocid-2')

    expect(view.getByTestId('row-value')).toHaveTextContent('아델')
  })

  it('목록에 없는 값이면 자리표시자로 돌아간다', async () => {
    const view = await 그리기('ocid-9')

    expect(view.getByTestId('row-value')).toHaveTextContent('캐릭터 선택')
  })

  it('칸을 눌러 목록을 열고 보기를 누르면 그 값을 넘긴다', async () => {
    const onSelect = jest.fn()
    const view = await 그리기(null, onSelect)

    await act(async () => {
      fireEvent.press(view.getByTestId('row-open'))
    })
    await act(async () => {
      fireEvent.press(view.getByTestId('row-option-ocid-1'))
    })

    expect(onSelect).toHaveBeenCalledWith('ocid-1')
  })
})
