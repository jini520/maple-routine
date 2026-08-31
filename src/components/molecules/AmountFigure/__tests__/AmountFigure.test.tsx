/**
 * 큰 숫자 + 힌트 한 줄([[ADR-173]] 결정 1·2·9) — 시트에서 **저장 바로 위**에 서는 덩어리.
 *
 * `MesoPad/MesoAmountField`(드롭 판매가)와 갈라 둔 부품이다. 그쪽은 앱 키패드가 값을 넣고
 * ([[ADR-124]] 결정 5) 빠른 칩을 자기가 그리는데, 이쪽은 칸이 직접 받고 빠른 칩이 폼 밖에 있다.
 */
import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { clearCountUpMemory } from '../../../../hooks/useCountUp'
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

/**
 * 단위는 숫자와 **기준선을 맞춘다** ([[ADR-178]] 정정 2).
 *
 * `items-baseline` 은 `TextInput` 에는 안 먹는다 — Yoga 는 글자 노드에만 기준선을 주고 그 밖에는
 * 상자 밑변으로 떨어진다. 그래서 치는 칸 옆의 단위가 숫자 기준선 위로 떠 보였다(사용자 보고
 * 2026-08-29). **상자와 기준선은 글자가 만들고** 치는 칸은 그 위에 얹는다.
 */
describe('기준선 ([[ADR-178]] 정정 2)', () => {
  it('치는 칸일 때도 **글자가 상자를 만든다** — 같은 값이 뒤에 선다', async () => {
    const view = await renderAtom(
      <AmountFigure value={700_000} unit="메소" testID="amount" onChangeValue={jest.fn()} />,
    )

    // 보이는 값은 칸이 든다.
    expect(view.getByTestId('amount').props.value).toBe('700,000')
    // 그 뒤에 **같은 글자**가 서서 상자와 기준선을 만든다 — 없으면 단위가 기준선을 잃는다.
    // 그 글자는 `aria-hidden` 이라(읽어 주는 것은 칸이다) 기본 쿼리에서 숨는다.
    expect(view.getByText('700,000', { includeHiddenElements: true })).toBeTruthy()
  })

  it('못 치는 자리에서는 그 글자가 곧 보이는 숫자다 — 상자가 하나뿐이다', async () => {
    const view = await renderAtom(
      <AmountFigure value={700_000} unit="메소" testID="amount" readOnly onChangeValue={jest.fn()} />,
    )

    expect(view.getByTestId('amount')).toHaveTextContent('700,000')
    // 치는 칸이 아예 없다 — 겹쳐 둘 것이 없다.
    expect(view.queryByLabelText('금액')).toBeNull()
  })

  it('숫자의 줄 상자는 글자보다 크다 — ascent 가 잘리지 않는다', async () => {
    const view = await renderAtom(
      <AmountFigure value={700_000} unit="메소" testID="amount" readOnly onChangeValue={jest.fn()} />,
    )

    const style = flattenStyle(view.getByTestId('amount').props.style) as {
      fontSize: number
      lineHeight: number
    }
    expect(style.fontSize).toBe(30)
    // `leading-none`(=30) 이면 상자가 글자와 같아 초점에서 위가 잘렸다.
    expect(style.lineHeight).toBeGreaterThan(style.fontSize)
  })
})

/**
 * 단위는 숫자와 **같은 줄 상자**에 선다 ([[ADR-178]] 정정 3).
 *
 * `items-baseline` 은 `TextInput` 이 섞인 줄에서 못 믿는다(실기에서 단위가 숫자 기준선 위로 떴다).
 * 그래서 정렬을 위에서 맞추고 **두 상자에 같은 줄높이 · 같은 글자 크기**를 넣는다 — 그러면
 * 기준선은 정의상 같은 자리다. 두 글꼴 크기의 차이를 **픽셀로 적지 않는 이유**가 그것이다.
 */
describe('단위의 줄 상자 ([[ADR-178]] 정정 3)', () => {
  it('숫자와 단위가 **같은 줄높이**를 쓴다', async () => {
    const view = await renderAtom(
      <AmountFigure value={7_250_000} unit="메소" testID="amount" readOnly onChangeValue={jest.fn()} />,
    )

    const 숫자 = flattenStyle(view.getByTestId('amount').props.style) as { lineHeight: number }
    const 단위 = flattenStyle(view.getByTestId('amount-unit').props.style) as { lineHeight: number }

    // 클래스 문자열(`leading-[38px]`)과 상수가 갈리면 여기서 잡힌다 — 보간을 못 하는 자리다.
    expect(단위.lineHeight).toBe(숫자.lineHeight)
  })

  it('단위 줄에 **숫자와 같은 크기**의 글자가 심겨 있다 — 그 줄의 지표를 그것이 정한다', async () => {
    const view = await renderAtom(
      <AmountFigure value={7_250_000} unit="메소" testID="amount" readOnly onChangeValue={jest.fn()} />,
    )

    const 숫자 = flattenStyle(view.getByTestId('amount').props.style) as { fontSize: number }
    // 폭 0 짜리 투명 글자(ZWSP)가 숫자와 같은 크기여야 한다 — 작아지면 기준선이 다시 갈린다.
    const 심긴글자 = flattenStyle(view.getByText('\u200B').props.style) as {
      fontSize: number
      opacity: number
    }

    expect(심긴글자.fontSize).toBe(숫자.fontSize)
    expect(심긴글자.opacity).toBe(0)
  })
})

/**
 * 어림값 표식 (사용자 지정 2026-08-29).
 *
 * 사냥 메소는 젠 주기·마릿수·레벨로 **미리 세어 둔 값**이지 실제로 받은 액수가 아니다
 * ([[ADR-175]] 결정 3). 표식이 없으면 그 수가 정산된 금액처럼 읽힌다.
 */
describe('≈ 표식', () => {
  it('어림이면 앞에 `≈` 가 붙는다', async () => {
    const view = await renderAtom(
      <AmountFigure
        value={41_760_000}
        unit="메소"
        testID="amount"
        approximate
        readOnly
        onChangeValue={jest.fn()}
      />,
    )

    expect(view.getByTestId('amount')).toHaveTextContent('≈ 41,760,000')
  })

  it('0 에는 안 붙는다 — 아직 어림할 것이 없다', async () => {
    const view = await renderAtom(
      <AmountFigure
        value={0}
        unit="메소"
        testID="amount"
        approximate
        readOnly
        onChangeValue={jest.fn()}
      />,
    )

    expect(view.getByTestId('amount')).toHaveTextContent('0')
  })

  it('안 주면 안 붙는다 — 판매·지출은 실제로 오간 값이다', async () => {
    const view = await renderAtom(
      <AmountFigure
        value={41_760_000}
        unit="메소"
        testID="amount"
        readOnly
        onChangeValue={jest.fn()}
      />,
    )

    expect(view.getByTestId('amount')).toHaveTextContent('41,760,000')
  })
})
