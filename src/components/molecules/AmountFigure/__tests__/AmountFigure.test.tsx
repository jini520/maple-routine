/**
 * 큰 숫자 + 힌트 한 줄([[ADR-173]] 결정 1·2·9) — 시트에서 **저장 바로 위**에 서는 덩어리.
 *
 * `MesoPad/MesoAmountField`(드롭 판매가)와 갈라 둔 부품이다. 그쪽은 앱 키패드가 값을 넣고
 * ([[ADR-124]] 결정 5) 빠른 칩을 자기가 그리는데, 이쪽은 칸이 직접 받고 빠른 칩이 폼 밖에 있다.
 */
import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { clearCountUpMemory } from '../../../../lib/use-count-up'
import { AmountFigure } from '../AmountFigure'

// 카운트업의 기억은 **모듈 수준**이라 케이스 사이로 샌다([[ADR-087]] 결정 8) — 안 지우면 앞
// 케이스가 남긴 값에서 굴러가 다음 케이스가 중간값을 본다.
beforeEach(clearCountUpMemory)

describe('AmountFigure', () => {
  it('큰 숫자를 콤마째 그리고 단위를 옆에 둔다', async () => {
    const view = await renderAtom(
      <AmountFigure value={1_200_000_000} unit="메소" testID="amount" onChangeValue={jest.fn()} />,
    )

    expect(view.getByTestId('amount').props.value).toBe('1,200,000,000')
    expect(view.getByText('메소')).toBeTruthy()
  })

  it('0 이면 칸을 비우고 자리표시자로 「0」 을 둔다', async () => {
    const view = await renderAtom(
      <AmountFigure value={0} unit="메소" testID="amount" onChangeValue={jest.fn()} />,
    )

    expect(view.getByTestId('amount').props.value).toBe('')
    expect(view.getByTestId('amount').props.placeholder).toBe('0')
  })

  it('치면 숫자만 남겨 돌려준다', async () => {
    const onChangeValue = jest.fn()
    const view = await renderAtom(
      <AmountFigure value={0} unit="메소" testID="amount" onChangeValue={onChangeValue} />,
    )

    fireEvent.changeText(view.getByTestId('amount'), '1,200')

    expect(onChangeValue).toHaveBeenCalledWith(1200)
  })

  // **값이 갈릴 때만 뜬다**(결정 2) — 캐시처럼 환산이 없는 자리는 줄이 통째로 사라진다.
  it('힌트가 없으면 그 줄을 안 그린다', async () => {
    const 있음 = await renderAtom(
      <AmountFigure value={1} unit="메소" testID="a" hint="12억" onChangeValue={jest.fn()} />,
    )
    expect(있음.getByTestId('a-hint')).toBeTruthy()

    const 없음 = await renderAtom(
      <AmountFigure value={1} unit="원" testID="b" onChangeValue={jest.fn()} />,
    )
    expect(없음.queryByTestId('b-hint')).toBeNull()
  })

  /**
   * **칠 때는 친 값, 손을 떼면 보여 줄 값**([[ADR-173]] 결정 6) — 관세가 그 자리다.
   * 넘어가는 동안 굴러가므로 더해지는 금액을 따로 안 적는다(결정 5).
   */
  it('손을 뗀 상태에서는 보여 줄 값을, 커서가 있으면 친 값을 그린다', async () => {
    const view = await renderAtom(
      <AmountFigure
        value={1_200_000_000}
        displayValue={1_320_000_000}
        unit="메소"
        testID="amount"
        onChangeValue={jest.fn()}
      />,
    )
    const 칸 = view.getByTestId('amount')
    expect(칸.props.value).toBe('1,320,000,000')

    // 포커스는 상태를 바꾸므로 커밋을 기다려야 한다 — `fireEvent` 만으로는 다음 렌더가 안 온다.
    await act(async () => {
      fireEvent(칸, 'focus')
    })
    expect(view.getByTestId('amount').props.value).toBe('1,200,000,000')
    // 손을 떼면 다시 합계로 **굴러간다** — 그 중간값을 여기서 붙들지 않는다(프레임에 매인다).
  })

  it('막힌 힌트는 에러색이다 — 왜 저장이 안 되는지를 말하는 줄이다', async () => {
    const view = await renderAtom(
      <AmountFigure
        value={30_000}
        unit="메포"
        testID="amount"
        hint="시세를 넣어야 메소로 셀 수 있어요"
        hintBlocked
        onChangeValue={jest.fn()}
      />,
    )

    expect(flattenStyle(view.getByTestId('amount-hint').props.style).color).toBe('#B3200B')
  })

  // 값이 0 이면 지울 것이 없다 — 자리는 지키되 안 보이고 안 눌린다(`MesoAmountField` 와 같은 처방).
  it('초기화는 큰 숫자와 같은 줄에 있고, 0 이면 안 눌린다', async () => {
    const 비었을때 = await renderAtom(
      <AmountFigure value={0} unit="메소" testID="a" onChangeValue={jest.fn()} />,
    )
    expect(비었을때.getByLabelText('금액 초기화').props.pointerEvents).toBe('none')

    const onChangeValue = jest.fn()
    const 찼을때 = await renderAtom(
      <AmountFigure value={12} unit="메소" testID="b" onChangeValue={onChangeValue} />,
    )
    fireEvent.press(찼을때.getByLabelText('금액 초기화'))
    expect(onChangeValue).toHaveBeenCalledWith(0)
  })

  // 결정 9 — 위 줄의 밑줄이 경계를 겸한다. 여기서 또 그으면 선이 두 줄이 된다.
  it('자기 윗선을 안 긋는다', async () => {
    const view = await renderAtom(
      <AmountFigure value={12} unit="메소" testID="amount" onChangeValue={jest.fn()} />,
    )

    expect(flattenStyle(view.getByTestId('amount-figure').props.style).borderTopWidth ?? 0).toBe(0)
  })
})
