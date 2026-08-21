// 웹판의 일곱을 옮겼다. 갈린 것은 두 가지다 — `toBeDisabled()` 대신 **RN 의 접근성 상태**를 보고,
// `tabular-nums` 클래스 대신 **풀린 `fontVariant`** 를 본다.
//
// 여기서 특히 중요한 케이스는 비활성 흐림이다. 웹은 `disabled:opacity-40` 한 클래스였는데 RN 에서
// 그 변형은 `Pressable disabled` 와 이어져 있지 않아 **비활성 버튼이 멀쩡한 색으로 보인다**
// (에러 없이). 아래 두 케이스가 그 실패를 잡는다.
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { PartySizeStepper } from '../PartySizeStepper'

const 감소 = '스우 파티원 수 감소'
const 증가 = '스우 파티원 수 증가'

describe('PartySizeStepper', () => {
  it('값을 그리고 −/+ 로 1씩 바꾼다', async () => {
    const onChange = jest.fn()
    const { getByText, getByLabelText } = await renderAtom(
      <PartySizeStepper label="스우" value={3} max={6} onChange={onChange} />,
    )

    expect(getByText('3')).toBeTruthy()

    await fireEvent.press(getByLabelText(증가))
    expect(onChange).toHaveBeenCalledWith(4)

    await fireEvent.press(getByLabelText(감소))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('1에서는 −가, 상한에서는 +가 비활성이다', async () => {
    const atMin = await renderAtom(<PartySizeStepper label="스우" value={1} max={6} onChange={jest.fn()} />)
    expect(atMin.getByLabelText(감소).props.accessibilityState.disabled).toBe(true)
    expect(atMin.getByLabelText(증가).props.accessibilityState.disabled).toBe(false)

    const atMax = await renderAtom(<PartySizeStepper label="스우" value={6} max={6} onChange={jest.fn()} />)
    expect(atMax.getByLabelText(감소).props.accessibilityState.disabled).toBe(false)
    expect(atMax.getByLabelText(증가).props.accessibilityState.disabled).toBe(true)
  })

  // 웹의 `disabled:opacity-40` 자리 — RN 에서는 JS 조건이 대신한다(컴포넌트 주석 ①).
  it('비활성 버튼은 흐리게 그린다', async () => {
    const { getByLabelText } = await renderAtom(
      <PartySizeStepper label="스우" value={1} max={6} onChange={jest.fn()} />,
    )

    expect(flattenStyle(getByLabelText(감소).props.style).opacity as number).toBeCloseTo(0.4, 5)
    expect(flattenStyle(getByLabelText(증가).props.style).opacity).toBeUndefined()
  })

  it('비활성 버튼을 눌러도 onChange 를 부르지 않는다', async () => {
    const onChange = jest.fn()
    const { getByLabelText } = await renderAtom(
      <PartySizeStepper label="스우" value={1} max={6} onChange={onChange} />,
    )

    await fireEvent.press(getByLabelText(감소))

    expect(onChange).not.toHaveBeenCalled()
  })

  // 상한은 (보스, 난이도)마다 다르다 — 스우는 하드 6인, 익스트림 2인(boss-crystal-prices.json).
  it('상한이 낮아지면 그 값에서 +가 막힌다', async () => {
    const { getByLabelText } = await renderAtom(
      <PartySizeStepper label="스우" value={2} max={2} onChange={jest.fn()} />,
    )

    expect(getByLabelText(증가).props.accessibilityState.disabled).toBe(true)
  })

  it('기본 크기(default)는 단위 "인"을 함께 그린다', async () => {
    const { getByText } = await renderAtom(<PartySizeStepper label="스우" value={3} max={6} onChange={jest.fn()} />)

    expect(getByText('인')).toBeTruthy()
  })

  // 관리 페이지 행은 좁아서 단위 없이 숫자만 — 기존 표시를 바꾸지 않는다.
  it('compact 는 단위를 그리지 않는다', async () => {
    const { queryByText } = await renderAtom(
      <PartySizeStepper label="스우" value={3} max={6} onChange={jest.fn()} size="compact" />,
    )

    expect(queryByText('인')).toBeNull()
  })

  it('값이 자릿수를 넘어가도 −/+ 가 움직이지 않게 tabular-nums 로 그린다', async () => {
    const { getByText } = await renderAtom(<PartySizeStepper label="스우" value={6} max={6} onChange={jest.fn()} />)

    expect(flattenStyle(getByText('6').props.style).fontVariant).toEqual(['tabular-nums'])
  })

  // 히트 영역을 넓히던 웹의 `-m-1 p-1` 자리 — RN 은 레이아웃을 안 건드리는 `hitSlop` 을 쓴다.
  it('시각 크기보다 넓은 히트 영역을 갖는다', async () => {
    const { getByLabelText } = await renderAtom(
      <PartySizeStepper label="스우" value={3} max={6} onChange={jest.fn()} />,
    )

    expect(getByLabelText(증가).props.hitSlop).toEqual({ top: 8, bottom: 8, left: 8, right: 8 })
  })

})
