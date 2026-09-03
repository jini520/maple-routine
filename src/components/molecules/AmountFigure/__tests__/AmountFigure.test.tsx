/**
 * 큰 숫자 + 힌트 한 줄. 시트에서 **저장 바로 위**에 서는 덩어리.
 *
 * **못 치는 글자만 그린다**. 금액은 폼마다 라벨–값 줄에서 받으므로 이 부품에는
 * 칸도 초기화도 없다. 값이 바뀌면 **곧바로** 갈아 끼운다.
 *
 * 숫자는 **한국어 단위로 접혀서** 선다. `850,000,000` 이 아니라 `8억 5천만`. 밑에 있던
 * 힌트 한 줄은 그 일을 하던 자리라 함께 사라졌다.
 */
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { AmountFigure } from '../AmountFigure'

describe('AmountFigure', () => {
  it('큰 숫자를 한국어 단위로 접고 통화를 옆에 둔다', async () => {
    const view = await renderAtom(<AmountFigure value={1_200_000_000} unit="메소" testID="amount" />)

    expect(view.getByTestId('amount')).toHaveTextContent('12억')
    expect(view.getByText('메소')).toBeTruthy()
  })

  // 접어도 **값을 안 깎는다**. 이 자리가 곧 저장될 총액이라 화면과 저장이 갈리면 안 된다.
  it('만 미만 나머지까지 그대로 적는다', async () => {
    const view = await renderAtom(<AmountFigure value={123_456_789} unit="메소" testID="amount" />)

    expect(view.getByTestId('amount')).toHaveTextContent('1억 2345만 6789')
  })

  it('0 이면 흐린 색으로 그린다. 아직 셀 것이 없다는 뜻이다', async () => {
    const view = await renderAtom(<AmountFigure value={0} unit="메소" testID="amount" />)

    expect(view.getByTestId('amount')).toHaveTextContent('0')
    expect(flattenStyle(view.getByTestId('amount').props.style).color).toBe('#9A9070')
  })

  /**
   * 부품에서 입력 경로를 걷었다.
   *
   * 이 자리가 다시 칸이 되면 앱이 센 값을 사람이 덮어쓴다 가 살아나므로 구조로 막아 둔다.
   */
  it('치는 칸이 아예 없다', async () => {
    const view = await renderAtom(<AmountFigure value={700_000} unit="메소" testID="amount" />)

    expect(view.queryByLabelText('금액')).toBeNull()
    expect(view.getByTestId('amount').props.onChangeText).toBeUndefined()
    // 같은 값을 그리는 글자가 뒤에 없다. 있으면 안드로이드에서 둘 다 그려져 이중으로 보인다.
    expect(view.queryAllByText('70만', { includeHiddenElements: true })).toHaveLength(1)
  })

  // 큰 숫자가 사용자의 값이 아니게 되어 되돌릴 대상이 없다. 지울 값은 각자의 칸에 있다.
  it('초기화 버튼이 없다', async () => {
    const view = await renderAtom(<AmountFigure value={12} unit="메소" testID="amount" />)

    expect(view.queryByLabelText('금액 초기화')).toBeNull()
  })

  /**
   * 힌트 한 줄이 **사라졌다**.
   *
   * 그 줄이 하던 억/만 환산은 큰 숫자가 직접 하고, 막힌 이유를 말하던 몫은 필수 칸의 빨간 `*` 와
   * 꺼진 저장 버튼이 받는다. 부품에 그 자리를 남겨 두면 다시 채워진다.
   */
  it('힌트 줄이 아예 없다', async () => {
    const view = await renderAtom(<AmountFigure value={1_200_000_000} unit="메소" testID="a" />)

    expect(view.queryByTestId('a-hint')).toBeNull()
  })

  // 위 줄의 밑줄이 경계를 겸한다. 여기서 또 그으면 선이 두 줄이 된다.
  it('자기 윗선을 안 긋는다', async () => {
    const view = await renderAtom(<AmountFigure value={12} unit="메소" testID="amount" />)

    expect(flattenStyle(view.getByTestId('amount-figure').props.style).borderTopWidth ?? 0).toBe(0)
  })
})

/**
 * 단위는 숫자와 **같은 줄 상자**에 선다.
 *
 * `items-baseline` 은 못 믿는다. Yoga 가 노드마다 기준선을 어떻게 잡는지가 갈린다. 그래서
 * 정렬을 위에서 맞추고 **두 상자에 같은 줄높이· 같은 글자 크기**를 넣는다. 그러면 기준선은
 * 정의상 같은 자리다. 두 글꼴 크기의 차이를 **픽셀로 적지 않는 이유**가 그것이다.
 */
describe('줄 상자', () => {
  it('숫자의 줄 상자는 글자보다 크다. ascent 가 잘리지 않는다', async () => {
    const view = await renderAtom(<AmountFigure value={700_000} unit="메소" testID="amount" />)

    const style = flattenStyle(view.getByTestId('amount').props.style) as {
      fontSize: number
      lineHeight: number
    }
    expect(style.fontSize).toBe(24)
    // 줄 높이가 글자 크기와 같으면 상자에 ascent 가 안 들어가 위가 잘린다.
    expect(style.lineHeight).toBe(31)
    expect(style.lineHeight).toBeGreaterThan(style.fontSize)
  })

  /**
   * 단위 글자(`조`·`억`·`만`·`천`)는 숫자보다 **계단 한 칸 아래**다.
   *
   * `text-2xl` 안에 `text-xl` 을 안친 것이라 줄 높이 28 이 함께 온다. 그 줄 높이가 바깥 줄 상자를
   * 흔들지 않는 것은 안드로이드에서 잰 값이다(큰 숫자 줄이 픽셀 단위로 같다).
   */
  it('단위 글자는 숫자보다 한 단계 작다', async () => {
    const view = await renderAtom(<AmountFigure value={850_000_000} unit="메소" testID="amount" />)

    const 억 = flattenStyle(view.getByText('억').props.style) as { fontSize: number }
    const 숫자 = flattenStyle(view.getByTestId('amount').props.style) as { fontSize: number }

    expect(억.fontSize).toBe(20)
    expect(억.fontSize).toBeLessThan(숫자.fontSize)
  })

  /**
   * 단위 왼쪽의 틈은 **폭만 있는 `View`** 다.
   *
   * 공백 글자로 넣으면 `8억 5천만` 이 `8 억 5 천만` 이 되어 화면을 집는 모든 자리가 그 공백을
   * 알아야 한다. 그 회귀를 여기서 막는다.
   */
  it('단위 왼쪽 틈이 읽어 주는 글에 안 섞인다', async () => {
    const view = await renderAtom(<AmountFigure value={850_000_000} unit="메소" testID="amount" />)

    expect(view.getByTestId('amount')).toHaveTextContent('8억 5천만')
  })

  it('숫자와 단위가 **같은 줄높이**를 쓴다', async () => {
    const view = await renderAtom(<AmountFigure value={7_250_000} unit="메소" testID="amount" />)

    const 숫자 = flattenStyle(view.getByTestId('amount').props.style) as { lineHeight: number }
    const 단위 = flattenStyle(view.getByTestId('amount-unit').props.style) as { lineHeight: number }

    // 클래스 문자열(`leading-[38px]`)과 상수가 갈리면 여기서 잡힌다. 보간을 못 하는 자리다.
    expect(단위.lineHeight).toBe(숫자.lineHeight)
  })

  it('단위 줄에 **숫자와 같은 크기**의 글자가 심겨 있다. 그 줄의 지표를 그것이 정한다', async () => {
    const view = await renderAtom(<AmountFigure value={7_250_000} unit="메소" testID="amount" />)

    const 숫자 = flattenStyle(view.getByTestId('amount').props.style) as { fontSize: number }
    // 폭 0 짜리 투명 글자(ZWSP)가 숫자와 같은 크기여야 한다. 작아지면 기준선이 다시 갈린다.
    // 둘 다 `text-2xl` 이라 계단이 움직여도 함께 움직인다.
    const 심긴글자 = flattenStyle(view.getByText('\u200B').props.style) as {
      fontSize: number
      opacity: number
    }

    expect(심긴글자.fontSize).toBe(숫자.fontSize)
    expect(심긴글자.opacity).toBe(0)
  })
})

/**
 * 어림값 표식.
 *
 * 사냥 메소는 젠 주기·마릿수·레벨로 **미리 세어 둔 값**이지 실제로 받은 액수가 아니다
 * 표식이 없으면 그 수가 정산된 금액처럼 읽힌다.
 */
describe('≈ 표식', () => {
  it('어림이면 앞에 `≈` 가 붙는다', async () => {
    const view = await renderAtom(
      <AmountFigure value={41_760_000} unit="메소" testID="amount" approximate />,
    )

    expect(view.getByTestId('amount')).toHaveTextContent('≈ 4176만')
  })

  it('0 에는 안 붙는다. 아직 어림할 것이 없다', async () => {
    const view = await renderAtom(
      <AmountFigure value={0} unit="메소" testID="amount" approximate />,
    )

    expect(view.getByTestId('amount')).toHaveTextContent('0')
  })

  it('안 주면 안 붙는다. 판매·지출은 실제로 오간 값이다', async () => {
    const view = await renderAtom(<AmountFigure value={41_760_000} unit="메소" testID="amount" />)

    expect(view.getByTestId('amount')).toHaveTextContent('4176만')
  })
})

// 눌러도 아무 일이 없어야 한다. 이 덩어리는 이제 **보여 주기만** 하는 자리다.
it('덩어리를 눌러도 값이 안 바뀐다', async () => {
  const view = await renderAtom(<AmountFigure value={12} unit="메소" testID="amount" />)

  fireEvent.press(view.getByTestId('amount-figure'))

  expect(view.getByTestId('amount')).toHaveTextContent('12')
})
