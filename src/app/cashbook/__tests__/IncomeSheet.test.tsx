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

async function 치기(view: Rendered, ...keys: string[]): Promise<void> {
  for (const key of keys) await 누르기(view, key)
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

describe('금액 — 앞 키패드다', () => {
  // OS 키보드를 안 부른다([[ADR-124]] 결정 5) — 메소는 자릿수가 커서 시스템 키패드로는 0 을 센다.
  it('친 자리가 왼쪽으로 자란다', async () => {
    const view = await 그리기()

    await 치기(view, '1', '2', '00')

    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('1,200')
  })

  it('빠른 칩이 더한다', async () => {
    const view = await 그리기()

    await act(async () => {
      fireEvent.press(view.getByText('+1억'))
    })

    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('100,000,000')
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
    await 치기(view, '1', '2')
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
