// 숫자 판. 스크린리더가 격자를 읽어야 하므로 **키마다 이름**이 있는지를 본다.
// 높이는 판정하는 쪽(`lib/number-pad-metrics`)과 같은 수여야 해서 상수를 베끼지 않고 가져다 쓴다.
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { NUMBER_PAD_HEIGHT_PX } from '../../../../lib/number-pad-metrics'
import { NumberPad } from '../NumberPad'

function 판(props: Partial<React.ComponentProps<typeof NumberPad>> = {}): React.JSX.Element {
  return (
    <NumberPad
      onDigit={props.onDigit ?? jest.fn()}
      onBackspace={props.onBackspace ?? jest.fn()}
      onConfirm={props.onConfirm ?? jest.fn()}
      confirmLabel={props.confirmLabel}
    />
  )
}

describe('NumberPad', () => {
  it('판이 제 높이를 못박는다. 판정하는 쪽과 같은 수다', async () => {
    const { getByTestId } = await renderAtom(판())

    expect(flattenStyle(getByTestId('number-pad').props.style).height).toBe(NUMBER_PAD_HEIGHT_PX)
  })

  it('확인 글자를 호출부가 바꾼다. 카드의 버튼과 다른 말이어야 한다', async () => {
    const { getByLabelText, getByText } = await renderAtom(판({ confirmLabel: '입력' }))

    expect(getByLabelText('입력')).toBeTruthy()
    expect(getByText('입력')).toBeTruthy()
  })

  it('숫자 열 개를 1~5 · 6~0 두 줄로 세운다', async () => {
    const { getByLabelText } = await renderAtom(판())

    for (const 글자 of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(getByLabelText(글자)).toBeTruthy()
    }
  })

  it('숫자를 누르면 그 글자를 낸다', async () => {
    const onDigit = jest.fn()
    const { getByLabelText } = await renderAtom(판({ onDigit }))

    fireEvent.press(getByLabelText('7'))

    expect(onDigit).toHaveBeenCalledWith('7')
  })

  it('지우개와 확인은 길이 각자 따로다', async () => {
    const onBackspace = jest.fn()
    const onConfirm = jest.fn()
    const { getByLabelText } = await renderAtom(판({ onBackspace, onConfirm }))

    fireEvent.press(getByLabelText('한 자리 지우기'))
    fireEvent.press(getByLabelText('확인'))

    expect(onBackspace).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
