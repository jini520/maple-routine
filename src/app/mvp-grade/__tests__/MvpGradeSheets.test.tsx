/** 설정 이력 상세의 바텀시트 셋. 등급 변경 · 기록 고치기 · 기록 추가. */
import type { ReactNode } from 'react'
import { fireEvent } from '@testing-library/react-native'

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { renderOverlay } from '../../../components/__tests__/render-atom'
import type { MvpGradeEntry } from '../../../lib/mvp/history'
import { GradeChangeSheet, GradeEditSheet, GradeInsertSheet } from '../MvpGradeSheets'

const TODAY = '2026-09-22'
// 6/11 실버 · 7/30 골드. 지금 기록은 7/30 골드다.
const HISTORY: MvpGradeEntry[] = [
  { startDate: '2026-06-11', grade: 'silver' },
  { startDate: '2026-07-30', grade: 'gold' },
]

function 저장(view: Awaited<ReturnType<typeof renderOverlay>>) {
  return view.getByRole('button', { name: '저장' })
}

describe('GradeChangeSheet', () => {
  it('이번 주와 지금 등급으로 열리고, 고른 등급을 그 주부터 적는다', async () => {
    const onSave = jest.fn(async () => {})
    const view = await renderOverlay(
      <GradeChangeSheet history={HISTORY} todayDateKey={TODAY} onSave={onSave} onClose={jest.fn()} />,
    )

    expect(view.getByText('등급 변경')).toBeTruthy()
    expect(view.getByTestId('mvp-grade-sheet-week')).toHaveTextContent('9월 17일 (목)')
    expect(view.getByLabelText('골드').props.accessibilityState?.selected).toBe(true)
    expect(view.getByText('선택한 주부터 새 등급으로 계산해요.')).toBeTruthy()

    await fireEvent.press(view.getByLabelText('레드'))
    await fireEvent.press(저장(view))

    expect(onSave).toHaveBeenCalledWith([...HISTORY, { startDate: '2026-09-17', grade: 'red' }])
  })

  it('주는 지금 기록이 시작된 주부터 이번 주까지 고른다', async () => {
    const view = await renderOverlay(
      <GradeChangeSheet history={HISTORY} todayDateKey={TODAY} onSave={jest.fn()} onClose={jest.fn()} />,
    )

    await fireEvent.press(view.getByLabelText('시작 주 고르기'))

    expect(view.getByLabelText('2026-09-08').props.accessibilityState?.disabled).toBe(false)
    expect(view.getByLabelText('2026-09-24').props.accessibilityState?.disabled).toBe(true)
  })
})

describe('GradeEditSheet', () => {
  it('그 기록의 주와 등급으로 열리고 고친 값을 적는다', async () => {
    const onSave = jest.fn(async () => {})
    const view = await renderOverlay(
      <GradeEditSheet
        history={HISTORY}
        startDate="2026-07-30"
        todayDateKey={TODAY}
        onSave={onSave}
        onDelete={jest.fn()}
        onClose={jest.fn()}
      />,
    )

    expect(view.getByText('등급 기록 고치기')).toBeTruthy()
    expect(view.getByTestId('mvp-grade-sheet-week')).toHaveTextContent('7월 30일 (목)')
    expect(view.getByText('이 주부터 다음 기록 전까지 이 등급으로 계산해요.')).toBeTruthy()

    await fireEvent.press(view.getByLabelText('다이아'))
    await fireEvent.press(저장(view))

    expect(onSave).toHaveBeenCalledWith([
      { startDate: '2026-06-11', grade: 'silver' },
      { startDate: '2026-07-30', grade: 'diamond' },
    ])
  })

  it('지우기를 누르면 지우기를 묻는다', async () => {
    const onDelete = jest.fn()
    const view = await renderOverlay(
      <GradeEditSheet
        history={HISTORY}
        startDate="2026-07-30"
        todayDateKey={TODAY}
        onSave={jest.fn()}
        onDelete={onDelete}
        onClose={jest.fn()}
      />,
    )

    await fireEvent.press(view.getByRole('button', { name: '이 기록 지우기' }))

    expect(onDelete).toHaveBeenCalled()
  })
})

describe('GradeInsertSheet', () => {
  it('기간을 고르기 전에는 저장이 꺼져 있고 무엇을 고를지 말한다', async () => {
    const view = await renderOverlay(
      <GradeInsertSheet history={HISTORY} todayDateKey={TODAY} onSave={jest.fn()} onClose={jest.fn()} />,
    )

    expect(view.getByText('기록 추가')).toBeTruthy()
    expect(view.getByTestId('mvp-grade-sheet-week')).toHaveTextContent('기간 선택')
    expect(view.getByText('시작 주와 종료 주를 골라 주세요. 지난주까지 고를 수 있어요.')).toBeTruthy()
    expect(저장(view).props.accessibilityState?.disabled).toBe(true)
  })

  it('시작 주를 고르면 종료 주 탭으로 넘어가고, 둘 다 고르면 기간과 다시 이어지는 등급을 말한다', async () => {
    const onSave = jest.fn(async () => {})
    const view = await renderOverlay(
      <GradeInsertSheet history={HISTORY} todayDateKey={TODAY} onSave={onSave} onClose={jest.fn()} />,
    )

    await fireEvent.press(view.getByLabelText('기간 고르기'))
    expect(view.getByTestId('week-calendar-tab-start').props.accessibilityState?.selected).toBe(true)
    // 달력은 지난주의 달(9월)로 열린다
    await fireEvent.press(view.getByLabelText('지난달'))
    await fireEvent.press(view.getByLabelText('지난달'))
    // 7/30 은 기록이 있는 주라 시작 주로 못 고른다
    expect(view.getByLabelText('2026-07-31').props.accessibilityState?.disabled).toBe(true)
    await fireEvent.press(view.getByLabelText('2026-07-03'))
    expect(view.getByTestId('week-calendar-tab-end').props.accessibilityState?.selected).toBe(true)
    // 종료 주는 다음 기록(7/30)의 앞 주까지다
    expect(view.getByLabelText('2026-07-31').props.accessibilityState?.disabled).toBe(true)
    await fireEvent.press(view.getByLabelText('2026-07-12'))

    expect(view.queryByTestId('week-calendar-popover')).toBeNull()
    expect(view.getByTestId('mvp-grade-sheet-week')).toHaveTextContent('7월 2일 ~ 7월 15일')
    await fireEvent.press(view.getByLabelText('레드'))
    expect(
      view.getByText('7월 2일 (목)부터 7월 15일 (수)까지 레드로 계산해요. 7월 16일부터는 다시 실버예요.'),
    ).toBeTruthy()

    await fireEvent.press(저장(view))
    expect(onSave).toHaveBeenCalledWith([
      { startDate: '2026-06-11', grade: 'silver' },
      { startDate: '2026-07-02', grade: 'red' },
      { startDate: '2026-07-16', grade: 'silver' },
      { startDate: '2026-07-30', grade: 'gold' },
    ])
  })
})
