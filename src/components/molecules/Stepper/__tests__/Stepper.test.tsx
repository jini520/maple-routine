// 앱의 스테퍼 하나. `toBeDisabled` 대신 RN 의 접근성 상태를 본다.
//
// 비활성 흐림이 특히 중요하다. RN 의 `disabled` 는 모양을 바꾸지 않아서, 흐리지 않으면 눌러도 안 되는
// 버튼이 멀쩡해 보인다(에러 없이).
import { fireEvent } from '@testing-library/react-native'

import { getThemeDefinition } from '../../../../lib/theme/theme-registry'
import { rnThemeAppearancePort } from '../../../../native/adapters/rn-theme-appearance'
import { __resetNativePortsForTest, setHapticsPort } from '../../../../native/ports'
import { __resetThemeAppearanceForTest } from '../../../../theme/appearance-store'
import { resolveControlColors } from '../../../../theme/theme-vars'
import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { Stepper } from '../Stepper'

const 줄이기 = '스우 파티원 수 감소'
const 늘리기 = '스우 파티원 수 증가'

describe('Stepper', () => {
  afterEach(__resetThemeAppearanceForTest)

  it('−/+ 로 1씩 바꾼다', async () => {
    const onChange = jest.fn()
    const { getByLabelText } = await renderAtom(
      <Stepper label="스우 파티원 수" value={3} max={6} onChange={onChange} />,
    )

    await fireEvent.press(getByLabelText(늘리기))
    expect(onChange).toHaveBeenLastCalledWith(4)

    await fireEvent.press(getByLabelText(줄이기))
    expect(onChange).toHaveBeenLastCalledWith(2)
  })

  it('하한에서는 −가, 상한에서는 +가 막히고 흐려진다', async () => {
    const atMin = await renderAtom(<Stepper label="스우 파티원 수" value={1} max={6} onChange={jest.fn()} />)
    expect(atMin.getByLabelText(줄이기).props.accessibilityState.disabled).toBe(true)
    expect(flattenStyle(atMin.getByLabelText(줄이기).props.style).opacity as number).toBeCloseTo(0.4, 5)
    expect(atMin.getByLabelText(늘리기).props.accessibilityState.disabled).toBe(false)
    expect(flattenStyle(atMin.getByLabelText(늘리기).props.style).opacity).toBeUndefined()

    const atMax = await renderAtom(<Stepper label="스우 파티원 수" value={6} max={6} onChange={jest.fn()} />)
    expect(atMax.getByLabelText(늘리기).props.accessibilityState.disabled).toBe(true)
  })

  // 비율 합은 2 에서 멈춘다. 혼자면 나눌 것이 없다.
  it('하한은 min 이 정한다', async () => {
    const { getByLabelText } = await renderAtom(
      <Stepper label="결정석 비율 합" value={2} min={2} max={10} onChange={jest.fn()} />,
    )

    expect(getByLabelText('결정석 비율 합 감소').props.accessibilityState.disabled).toBe(true)
  })

  it('막힌 버튼을 눌러도 onChange 를 부르지 않는다', async () => {
    const onChange = jest.fn()
    const { getByLabelText } = await renderAtom(
      <Stepper label="스우 파티원 수" value={1} max={6} onChange={onChange} />,
    )

    await fireEvent.press(getByLabelText(줄이기))

    expect(onChange).not.toHaveBeenCalled()
  })

  // 상한이 없는 수량(가계부 목록 항목 대부분)은 + 가 막히지 않는다.
  it('max 가 없으면 + 를 막지 않는다', async () => {
    const { getByLabelText } = await renderAtom(<Stepper label="수량" value={999} onChange={jest.fn()} />)

    expect(getByLabelText('수량 증가').props.accessibilityState.disabled).toBe(false)
  })

  it('onPressValue 를 줄 때만 가운데 숫자를 누를 수 있다', async () => {
    const plain = await renderAtom(<Stepper label="스우 파티원 수" value={3} max={6} onChange={jest.fn()} />)
    expect(plain.queryByRole('button', { name: '스우 파티원 수' })).toBeNull()

    const onPressValue = jest.fn()
    const pressable = await renderAtom(
      <Stepper label="수량" value={3} onChange={jest.fn()} onPressValue={onPressValue} testID="quantity" />,
    )
    await fireEvent.press(pressable.getByTestId('quantity'))
    expect(onPressValue).toHaveBeenCalledTimes(1)
  })

  // 단위를 + 옆에 붙이면 알약의 좌우가 안 맞는다(사용자 지정). 크기와 무관하게 숫자만 그린다.
  it.each(['sm', 'md'] as const)('%s 는 숫자만 그리고 테두리가 없다', async (size) => {
    const { getByTestId, getByLabelText, queryByText } = await renderAtom(
      <Stepper label="스우 파티원 수" value={3} max={6} onChange={jest.fn()} size={size} testID="value" />,
    )

    expect(queryByText('인')).toBeNull()
    expect(getByTestId('value').props.children).toBe('3')
    expect(flattenStyle(getByLabelText(줄이기).props.style).borderWidth).toBeUndefined()
    expect(flattenStyle(getByTestId('stepper-track').props.style).borderWidth).toBeUndefined()
  })

  // 세그먼트와 같은 색이다. 트랙이 반투명이라 바탕에 따라 색을 맞바꿀 일이 없다.
  it.each(['머쉬맘', '혼테일'] as const)('%s: 트랙과 버튼이 세그먼트와 같은 색이다', async (name) => {
    rnThemeAppearancePort.apply(name, getThemeDefinition(name))
    const { getByTestId, getByLabelText } = await renderAtom(
      <Stepper label="스우 파티원 수" value={3} max={6} onChange={jest.fn()} />,
    )
    const control = resolveControlColors(getThemeDefinition(name))

    expect(flattenStyle(getByTestId('stepper-track').props.style).backgroundColor).toBe(control.track)
    expect(flattenStyle(getByLabelText(늘리기).props.style).backgroundColor).toBe(control.thumb)
  })
})

// 값이 바뀔 때만 손끝이 답한다. 끝값에서 막힌 버튼은 바뀌는 것이 없다.
describe('Stepper 의 촉각', () => {
  const select = jest.fn(async () => undefined)

  beforeEach(() => {
    select.mockClear()
    setHapticsPort({ tap: async () => {}, select })
  })

  afterEach(__resetNativePortsForTest)

  it('− · + 로 값이 바뀔 때마다 한 번씩 난다', async () => {
    const { getByLabelText } = await renderAtom(
      <Stepper label="스우 파티원 수" value={3} max={6} onChange={jest.fn()} />,
    )

    await fireEvent.press(getByLabelText(늘리기))
    await fireEvent.press(getByLabelText(줄이기))

    expect(select).toHaveBeenCalledTimes(2)
  })

  it('막힌 버튼을 누르면 안 난다', async () => {
    const { getByLabelText } = await renderAtom(
      <Stepper label="스우 파티원 수" value={6} max={6} onChange={jest.fn()} />,
    )

    await fireEvent.press(getByLabelText(늘리기))

    expect(select).not.toHaveBeenCalled()
  })
})
