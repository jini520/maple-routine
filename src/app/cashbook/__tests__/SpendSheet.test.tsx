// 지출 기록 시트([[ADR-166]] · [[ADR-170]] 결정 6).
//
// **갈래는 시트 밖에서 갈렸다** — 펼침판이 「지출」을 골라 이 시트를 연다. 그래서 이 시트에는
// 수입/지출 세그먼트가 없고, 자기가 지출이라는 것을 **모른 채** 받은 것을 그린다.
import type { ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

// 시트 껍데기는 `BossDropSheet.test.tsx` 와 같은 방식으로 세운다 — 라이브러리를 목으로 갈아
// 끼우고 내용만 본다(껍데기의 동작은 그쪽 컴포넌트의 테스트가 붙든다).
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
import { SpendSheet } from '../SpendSheet'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function 그리기(overrides: Partial<React.ComponentProps<typeof SpendSheet>> = {}) {
  return renderOverlay(
    <SpendSheet
      dateKey="2026-08-23"
      lastPointRate={null}
      onSave={jest.fn()}
      onClose={jest.fn()}
      {...overrides}
    />,
  )
}

async function 누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

describe('머리', () => {
  it('어느 날에 적히는지 말한다 — FAB 는 날짜를 안 들고 온다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('spend-sheet-date')).toHaveTextContent('8월 23일 (일)')
  })

  it('수입/지출 세그먼트가 없다 — 갈래는 펼침판이 이미 갈랐다', async () => {
    const view = await 그리기()

    expect(view.queryByLabelText('수입')).toBeNull()
  })
})

describe('갈래 칩', () => {
  // 직접 입력 둘(아이템 구매 · 기타)은 앞 키패드가 서야 성립한다 — 그때까지 **누를 수 없는 칩을
  // 세우지 않는다**([[ADR-132]] 결정 12 의 껍데기를 되풀이하지 않는다).
  it('목록이 있는 갈래만 세운다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('컨텐츠')).toBeTruthy()
    expect(view.getByLabelText('상점·편의')).toBeTruthy()
    expect(view.getByLabelText('버프')).toBeTruthy()
    expect(view.queryByLabelText('아이템 구매')).toBeNull()
    expect(view.queryByLabelText('기타')).toBeNull()
  })

  it('첫 갈래로 시작한다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('컨텐츠').props.accessibilityState?.selected).toBe(true)
  })

  it('갈래를 바꾸면 그 묶음들이 선다', async () => {
    const view = await 그리기()

    await 누르기(view, '버프')

    expect(view.getByText('버프 물약')).toBeTruthy()
    expect(view.queryByText('에픽던전 추가 리워드')).toBeNull()
  })

  // 고르던 항목이 남아 있으면 «컨텐츠를 골랐는데 버프 항목이 저장되는» 일이 생긴다.
  it('갈래를 바꾸면 고르던 항목이 풀린다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '하이마운틴 2단계')

    await 누르기(view, '버프')

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })
})

describe('항목 — 고르면 채워진다', () => {
  // 가격이 전부 고정이라 «목록만 받고 금액은 매번 입력» 이 아니다([[ADR-166]] 정정 1 ①).
  it('묶음 이름과 항목이 파일 차례대로 선다', async () => {
    const view = await 그리기()

    expect(view.getByText('에픽던전 추가 리워드')).toBeTruthy()
    expect(view.getByLabelText('하이마운틴 1단계')).toBeTruthy()
  })

  it('고르기 전에는 저장할 수 없다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  it('고르면 단가가 그대로 금액이 된다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 누르기(view, '하이마운틴 2단계')

    // 30,000 메포 ÷ 1,180 → 25.42억. 부호까지 붙든다 — 지출은 언제나 빼는 쪽이다.
    expect(view.getByTestId('spend-sheet-total')).toHaveTextContent('−25.42억')
  })
})

describe('수량 — 곱셈은 앱이 한다', () => {
  // 사용자가 곱셈을 대신하면 «몇 포인트 썼나» 를 나중에 되물을 수 없다([[ADR-166]] 정정 1 ③).
  it('단위 이름은 카탈로그가 준다 — 레코드에 안 적는다', async () => {
    const view = await 그리기()
    await 누르기(view, '버프')

    await 누르기(view, '보약 버프 추가 구매')

    expect(view.getByTestId('spend-sheet-quantity-unit')).toHaveTextContent('포인트')
  })

  it('회 단위 항목은 「회」다', async () => {
    const view = await 그리기()

    await 누르기(view, '하이마운틴 2단계')

    expect(view.getByTestId('spend-sheet-quantity-unit')).toHaveTextContent('회')
  })

  it('수량을 올리면 금액이 그만큼 는다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave, lastPointRate: 1_180 })
    await 누르기(view, '하이마운틴 2단계')

    await 누르기(view, '수량 늘리기')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ quantity: 2, pointAmount: 60_000 })
  })

  it('1 아래로는 못 내린다', async () => {
    const view = await 그리기()
    await 누르기(view, '하이마운틴 2단계')

    expect(view.getByLabelText('수량 줄이기').props.accessibilityState?.disabled).toBe(true)
  })

  it('항목을 바꾸면 수량이 1 로 돌아간다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave, lastPointRate: 1_180 })
    await 누르기(view, '하이마운틴 2단계')
    await 누르기(view, '수량 늘리기')

    await 누르기(view, '몬스터 파크')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ quantity: 1 })
  })
})

// [[ADR-166]] 정정 2 ③ — 시세 없이 저장하면 그 행은 **영영 메소로 표시할 수 없는 행**이 된다.
describe('메소마켓 시세', () => {
  it('메포 항목을 고르면 시세 칸이 선다', async () => {
    const view = await 그리기()

    await 누르기(view, '하이마운틴 2단계')

    expect(view.getByTestId('spend-sheet-rate')).toBeTruthy()
  })

  it('메소 항목에는 안 선다 — 물어볼 이유가 없다', async () => {
    const view = await 그리기()
    await 누르기(view, '버프')

    await 누르기(view, '세이람의 영약')

    expect(view.queryByTestId('spend-sheet-rate')).toBeNull()
  })

  it('시세가 없으면 저장이 막힌다', async () => {
    const view = await 그리기({ lastPointRate: null })

    await 누르기(view, '하이마운틴 2단계')

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  // [[ADR-166]] 결정 5 — 금액은 매번 다르지만 시세는 좀처럼 안 바뀐다. 필수 칸이 매번 비어 있으면
  // 입력이 막히므로 «기억한다» 가 여기서 결정적이다.
  it('마지막으로 쓴 시세가 채워져 있다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 누르기(view, '하이마운틴 2단계')

    expect(view.getByTestId('spend-sheet-rate')).toHaveTextContent('1,180 메포')
    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(false)
  })

  it('메소 항목은 시세가 없어도 저장된다', async () => {
    const view = await 그리기({ lastPointRate: null })
    await 누르기(view, '버프')

    await 누르기(view, '세이람의 영약')

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(false)
  })
})

describe('저장', () => {
  it('메포 항목은 원금과 시세를 함께 박는다 — 메소 칸은 비운다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave, lastPointRate: 1_180 })

    await 누르기(view, '하이마운틴 2단계')
    await 누르기(view, '저장')

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toEqual({
      ocid: null,
      spentOn: '2026-08-23',
      category: '컨텐츠',
      item: '하이마운틴 2단계',
      quantity: 1,
      mesoAmount: null,
      tariffMeso: null,
      pointAmount: 30_000,
      pointPer100mMeso: 1_180,
      cashAmount: null,
      memo: null,
    })
  })

  it('메소 항목은 메소 칸만 채운다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '버프')

    await 누르기(view, '콜렉터의 영약')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      category: '버프',
      item: '콜렉터의 영약',
      mesoAmount: 20_000_000,
      pointAmount: null,
      pointPer100mMeso: null,
    })
  })

  it('저장하면 닫는다', async () => {
    const onClose = jest.fn()
    const view = await 그리기({ onClose, lastPointRate: 1_180 })

    await 누르기(view, '하이마운틴 2단계')
    await 누르기(view, '저장')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
