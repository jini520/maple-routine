// 수입 기록 시트([[ADR-170]] 결정 1·6).
//
// 지출 시트와 **폼이 통째로 다르다** — 통화가 메소 하나뿐이라 시세도 관세도 수량도 없고,
// 갈래는 첫 칸의 **라벨만** 바꾼다.
import type { ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, { testID: 'sheet-backdrop', ...props }),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, props),
    // 시트 밖과 같게 둔다 — 아톰이 이 값으로 «시트 안인가» 를 묻는다([[ADR-170]] 정정 5).
    // 목이 시트를 평범한 `View` 로 바꾸므로 여기서도 문맥이 없는 것이 사실이고, 그래서
    // 아래 입력은 안 그려진다 — 그래도 **있어야 한다**: `lib/nativewind-interop` 이 모듈을
    // 읽는 순간 이것을 등록하므로, 없으면 스위트가 뜨기도 전에 죽는다.
    useBottomSheetInternal: () => null,
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.TextInput, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { IncomeSheet } from '../IncomeSheet'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function 그리기(overrides: Partial<React.ComponentProps<typeof IncomeSheet>> = {}) {
  return renderOverlay(
    <IncomeSheet dateKey="2026-08-23" onSave={jest.fn()} onClose={jest.fn()} {...overrides} />,
  )
}

async function 누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

/** 금액 칸에 **친다** — OS 숫자 키보드다([[ADR-170]] 정정 4). 칸이 콤마째 값을 받는다. */
async function 치기(view: Rendered, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('income-sheet-amount'), text)
  })
}

describe('갈래', () => {
  it('사용자가 준 둘과 안전망 하나다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('아이템 판매')).toBeTruthy()
    expect(view.getByLabelText('사냥')).toBeTruthy()
    expect(view.getByLabelText('기타')).toBeTruthy()
  })

  // 폼은 하나다 — 갈래는 첫 칸의 라벨만 바꾼다([[ADR-170]] 결정 1).
  it('갈래가 첫 칸의 이름을 바꾼다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('판 것')

    await 누르기(view, '사냥')

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('사냥터')
  })

  it('기타는 이름을 안 좁힌다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('내용')
  })
})

/**
 * 금액은 **OS 숫자 키보드**다([[ADR-170]] 정정 4). 앱 키패드를 안 두는 이유는 이 시트가 사용처
 * 칸 때문에 **어차피 키보드를 부르기** 때문이다 — [[ADR-124]] 결정 5 의 전제가 여기엔 없다.
 */
describe('금액 — OS 숫자 키보드다 ([[ADR-170]] 정정 4)', () => {
  it('앱 키패드를 안 그린다', async () => {
    const view = await 그리기()

    expect(view.queryByLabelText('한 자리 지우기')).toBeNull()
    expect(view.queryByLabelText('00')).toBeNull()
  })

  it('숫자 키보드를 부른다 — 글자 키보드가 아니다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('income-sheet-amount').props.keyboardType).toBe('number-pad')
  })

  it('친 값이 콤마째 선다', async () => {
    const view = await 그리기()

    await 치기(view, '1200')

    expect(view.getByTestId('income-sheet-amount').props.value).toBe('1,200')
  })

  // 칸이 콤마를 그리므로 다음 타건은 콤마째 들어온다 — 그것을 걷어야 값이 안 깨진다.
  it('콤마가 섞여 들어와도 값이 안 깨진다', async () => {
    const view = await 그리기()

    await 치기(view, '1,2000')

    expect(view.getByTestId('income-sheet-amount').props.value).toBe('12,000')
  })

  // 「0」 을 값으로 두면 그 뒤에 친 숫자가 붙어 자릿수가 하나 는다.
  it('0 이면 칸을 비우고 자리표시자로 「0」 을 둔다', async () => {
    const view = await 그리기()

    const 칸 = view.getByTestId('income-sheet-amount')
    expect(칸.props.value).toBe('')
    expect(칸.props.placeholder).toBe('0')
  })

  // OS 키패드엔 `00` 이 없어 억 단위를 치려면 0 을 여덟 번 눌러야 한다 — 칩이 그 자리를 막는다.
  it('빠른 칩이 더한다 — 키패드를 걷어도 칩은 남는다', async () => {
    const view = await 그리기()

    await act(async () => {
      fireEvent.press(view.getByText('+1억'))
    })

    expect(view.getByTestId('income-sheet-amount').props.value).toBe('100,000,000')
  })

  it('금액이 0 이면 저장할 수 없다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })
})

describe('저장', () => {
  it('갈래와 이름과 금액을 넘긴다 — 통화 칸이 없다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })

    await 누르기(view, '사냥')
    await 치기(view, '12')
    await 누르기(view, '저장')

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toEqual({
      ocid: null,
      earnedOn: '2026-08-23',
      category: '사냥',
      item: null,
      mesoAmount: 12,
      memo: null,
    })
  })

  it('저장하면 닫는다', async () => {
    const onClose = jest.fn()
    const view = await 그리기({ onClose })

    await 치기(view, '1')
    await 누르기(view, '저장')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
