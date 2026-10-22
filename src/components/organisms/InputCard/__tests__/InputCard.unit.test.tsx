/**
 * 금액 카드의 단위 세그먼트(기본 · 만 · 억).
 *
 * 여기서 지키는 것은 **어느 단위로 쳐도 카드가 내보내는 것은 메소 글자**라는 것이다. 받는 쪽은
 * 단위를 모른다. 단위가 새면 99.9 억이 99 메소로 저장된다.
 */
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../__tests__/render-atom'
import { installFakePreferences } from '../../../../storage/__tests__/fake-preferences'
import { __resetMesoUnitsForTest, mesoUnitOf, rememberMesoUnit } from '../../../../features/input-card/meso-unit'
import { InputCard, type InputCardProps } from '../InputCard'

beforeEach(() => {
  installFakePreferences()
  __resetMesoUnitsForTest()
})

async function 그리기(props: Partial<InputCardProps> = {}) {
  const onConfirm = jest.fn()
  const view = await renderOverlay(
    <InputCard
      label="판매 대금"
      unit="메소"
      reading
      unitKey="itemSale"
      chips={[{ label: '+1억', value: 100_000_000 }]}
      value=""
      onConfirm={onConfirm}
      onCancel={jest.fn()}
      {...props}
    />,
  )
  return { view, onConfirm }
}

type 화면 = Awaited<ReturnType<typeof renderOverlay>>

async function 치기(view: 화면, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('input-card-value'), text)
  })
}

async function 누르기(view: 화면, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

async function 확인(view: 화면): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByTestId('input-card-confirm'))
  })
}

function 칸(view: 화면): string {
  return view.getByTestId('input-card-value').props.value as string
}

describe('단위 세그먼트', () => {
  it('unitKey 를 안 넘긴 카드에는 서지 않는다', async () => {
    const { view } = await 그리기({ unitKey: undefined })

    expect(view.queryByLabelText('억')).toBeNull()
  })

  it('억으로 친 값을 메소로 내보낸다', async () => {
    const { view, onConfirm } = await 그리기()

    await 누르기(view, '억')
    await 치기(view, '99.9')
    await 확인(view)

    expect(onConfirm).toHaveBeenCalledWith('9990000000')
  })

  it('씨앗은 메소로 받고 기억한 단위로 나눠 보인다', async () => {
    rememberMesoUnit('itemSale', 'eok')
    const { view } = await 그리기({ value: '9990000000' })

    expect(칸(view)).toBe('99.9')
  })

  it('단위를 바꿔도 값은 그대로이고 칸의 숫자만 바뀐다', async () => {
    const { view, onConfirm } = await 그리기({ value: '9990000000' })

    await 누르기(view, '만')
    expect(칸(view)).toBe('999,000')
    await 누르기(view, '억')
    expect(칸(view)).toBe('99.9')
    await 확인(view)

    expect(onConfirm).toHaveBeenCalledWith('9990000000')
  })

  // 칩 눈금이 단위마다 바뀌면 같은 칩이 화면마다 다른 금액이 된다.
  it('빠른 추가 칩은 메소 값을 더한다', async () => {
    rememberMesoUnit('itemSale', 'eok')
    const { view, onConfirm } = await 그리기({ value: '9990000000' })

    await act(async () => {
      fireEvent.press(view.getByText('+1억'))
    })

    expect(칸(view)).toBe('100.9')
    await 확인(view)
    expect(onConfirm).toHaveBeenCalledWith('10090000000')
  })

  it('고른 단위를 그 칸에 기억한다', async () => {
    const { view } = await 그리기()

    await 누르기(view, '만')

    expect(mesoUnitOf('itemSale')).toBe('man')
    expect(mesoUnitOf('dropPrice')).toBe('base')
  })

  it('값 칸 오른쪽 단위 글자가 고른 단위를 따른다', async () => {
    const { view } = await 그리기()

    await 누르기(view, '억')

    expect(view.getByText('억 메소')).toBeTruthy()
  })

  it('단위 읽기는 메소로 환산한 값을 읽는다', async () => {
    rememberMesoUnit('itemSale', 'eok')
    const { view } = await 그리기({ value: '9990000000' })

    expect(view.getByTestId('input-card-reading').props.children).toBe('99억 9천만')
  })

  it('OS 키보드는 소수점이 있는 숫자판이다', async () => {
    const { view } = await 그리기()

    expect(view.getByTestId('input-card-value').props.keyboardType).toBe('decimal-pad')
  })
})

describe('단위 카드의 자체 판', () => {
  async function 판이_선_카드(props: Partial<InputCardProps> = {}) {
    const 결과 = await 그리기(props)
    await act(async () => {
      fireEvent(결과.view.getByTestId('input-card-panel'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 336, height: 2000 } },
      })
    })
    await act(async () => {
      fireEvent(결과.view.getByTestId('input-card-value'), 'pressIn')
    })
    return 결과
  }

  it('판의 소수점 키로 끝수를 친다', async () => {
    rememberMesoUnit('itemSale', 'eok')
    const { view, onConfirm } = await 판이_선_카드()

    for (const 키 of ['9', '9', '소수점', '9']) await 누르기(view, 키)

    expect(칸(view)).toBe('99.9')
    await 확인(view)
    expect(onConfirm).toHaveBeenCalledWith('9990000000')
  })

  it('기본 단위에서는 소수점 키가 안 먹는다', async () => {
    const { view } = await 판이_선_카드()

    for (const 키 of ['9', '소수점', '9']) await 누르기(view, 키)

    expect(칸(view)).toBe('99')
  })

  it('단위 세그먼트가 없는 카드의 판에는 소수점 키가 없다', async () => {
    const { view } = await 판이_선_카드({ unitKey: undefined })

    expect(view.queryByLabelText('소수점')).toBeNull()
  })
})
