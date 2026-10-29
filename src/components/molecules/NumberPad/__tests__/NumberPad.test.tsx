// 숫자 판. 스크린리더가 격자를 읽어야 하므로 **키마다 이름**이 있는지를 본다.
// 높이는 판정하는 쪽(`lib/number-pad-metrics`)과 같은 수여야 해서 상수를 베끼지 않고 가져다 쓴다.
import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { NUMBER_PAD_HEIGHT_PX } from '../../../../lib/number-pad-metrics'
import { getThemeDefinition } from '../../../../lib/theme/theme-registry'
import { __resetThemeAppearanceForTest, setThemeAppearance } from '../../../../theme/appearance-store'
import { buildPopoverScopeVariables } from '../../../../theme/theme-vars'
import { NumberPad } from '../NumberPad'

function 판(props: Partial<React.ComponentProps<typeof NumberPad>> = {}): React.JSX.Element {
  return (
    <NumberPad
      onDigit={props.onDigit ?? jest.fn()}
      onBackspace={props.onBackspace ?? jest.fn()}
      onConfirm={props.onConfirm ?? jest.fn()}
      confirmLabel={props.confirmLabel}
      onDecimal={props.onDecimal}
      decimalDisabled={props.decimalDisabled}
    />
  )
}

describe('NumberPad', () => {
  it('판이 제 높이를 못박는다. 판정하는 쪽과 같은 수다', async () => {
    const { getByTestId } = await renderAtom(판())

    expect(flattenStyle(getByTestId('number-pad').props.style).height).toBe(NUMBER_PAD_HEIGHT_PX)
  })

  it('숫자를 누르면 그 글자를 낸다', async () => {
    const onDigit = jest.fn()
    const { getByLabelText } = await renderAtom(판({ onDigit }))

    await fireEvent.press(getByLabelText('7'))

    expect(onDigit).toHaveBeenCalledWith('7')
  })

  it('지우개와 확인은 길이 각자 따로다', async () => {
    const onBackspace = jest.fn()
    const onConfirm = jest.fn()
    const { getByLabelText } = await renderAtom(판({ onBackspace, onConfirm }))

    await fireEvent.press(getByLabelText('한 자리 지우기'))
    await fireEvent.press(getByLabelText('확인'))

    expect(onBackspace).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('소수점 키를 누르면 소수점을 알린다', async () => {
    const onDecimal = jest.fn()
    const { getByLabelText } = await renderAtom(판({ onDecimal }))

    await fireEvent.press(getByLabelText('소수점'))

    expect(onDecimal).toHaveBeenCalledTimes(1)
  })

  // 기본 단위에서는 키를 없애지 않고 잠근다. 단위를 바꿀 때마다 키 자리가 움직이면 안 된다.
  it('잠긴 소수점 키는 자리를 지키고 눌리지 않는다', async () => {
    const onDecimal = jest.fn()
    const { getByLabelText } = await renderAtom(판({ onDecimal, decimalDisabled: true }))

    await fireEvent.press(getByLabelText('소수점'))

    expect(onDecimal).not.toHaveBeenCalled()
  })

  it('소수점 키는 받는 카드에만 선다', async () => {
    const { queryByLabelText } = await renderAtom(판())

    expect(queryByLabelText('소수점')).toBeNull()
  })
})

// 판은 카드를 덮고 뜬다. 테두리 없이 그림자로 가르고, 다크에서는 팝오버처럼 시트보다 한 단 더 올린 면이다.
describe('NumberPad 의 면', () => {
  afterEach(__resetThemeAppearanceForTest)

  it('다크에서 테두리 없이 팝오버와 같은 올린 면으로 선다', async () => {
    const 검은마법사 = getThemeDefinition('검은마법사')
    const { getByTestId } = await renderAtom(판())
    await act(async () => {
      setThemeAppearance('검은마법사', 검은마법사)
    })
    const pad = flattenStyle(getByTestId('number-pad').props.style)

    expect(pad.borderWidth ?? 0).toBe(0)
    expect(pad.backgroundColor).toBe(buildPopoverScopeVariables(검은마법사)['--color-bg'])
  })
})
