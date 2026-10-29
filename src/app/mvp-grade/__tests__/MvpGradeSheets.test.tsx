/** 설정 이력 상세의 바텀시트 둘. 등급 변경 · 기록 고치기. */
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
    useBottomSheetInternal: () =>
      jest.requireActual<typeof import('../../../components/__tests__/bottom-sheet-internal-fake')>(
        '../../../components/__tests__/bottom-sheet-internal-fake',
      ).fakeBottomSheetInternal(),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { renderOverlay } from '../../../components/__tests__/render-atom'
import type { MvpGradeEntry } from '../../../lib/mvp/history'
import { GradeChangeSheet, GradeEditSheet } from '../MvpGradeSheets'

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
  it('오늘과 지금 등급으로 열리고, 고른 등급을 그 날부터 적는다', async () => {
    const onSave = jest.fn(async () => {})
    const view = await renderOverlay(
      <GradeChangeSheet history={HISTORY} todayDateKey={TODAY} onSave={onSave} onClose={jest.fn()} />,
    )

    expect(view.getByText('등급 변경')).toBeTruthy()
    expect(view.getByTestId('mvp-grade-sheet-date')).toHaveTextContent('9월 22일 (화)')
    expect(view.getByLabelText('골드').props.accessibilityState?.selected).toBe(true)
    expect(view.getByText('선택한 날부터 새 등급으로 계산해요.')).toBeTruthy()

    await fireEvent.press(view.getByLabelText('레드'))
    await fireEvent.press(저장(view))

    expect(onSave).toHaveBeenCalledWith([...HISTORY, { startDate: '2026-09-22', grade: 'red' }])
  })

  // 따로 있던 기록 추가 시트를 합쳤다. 지난 날을 고르면 그 날부터 다음 기록 전날까지 그 등급이다.
  it('오늘 뒤는 못 고르고, 지난 날을 고르면 그 날부터 적는다', async () => {
    const onSave = jest.fn(async () => {})
    const view = await renderOverlay(
      <GradeChangeSheet history={HISTORY} todayDateKey={TODAY} onSave={onSave} onClose={jest.fn()} />,
    )

    await fireEvent.press(view.getByLabelText('시작일 고르기'))
    expect(view.getByLabelText('2026-09-23').props.accessibilityState?.disabled).toBe(true)
    await fireEvent.press(view.getByLabelText('지난달'))
    await fireEvent.press(view.getByLabelText('지난달'))
    await fireEvent.press(view.getByLabelText('2026-07-05'))
    await fireEvent.press(view.getByRole('button', { name: '확인' }))
    await fireEvent.press(view.getByLabelText('레드'))
    await fireEvent.press(저장(view))

    expect(onSave).toHaveBeenCalledWith([
      { startDate: '2026-06-11', grade: 'silver' },
      { startDate: '2026-07-05', grade: 'red' },
      { startDate: '2026-07-30', grade: 'gold' },
    ])
  })

  it('날을 눌러도 확인해야 바뀌고, 바깥을 누르면 버린다', async () => {
    const view = await renderOverlay(
      <GradeChangeSheet history={HISTORY} todayDateKey={TODAY} onSave={jest.fn()} onClose={jest.fn()} />,
    )

    await fireEvent.press(view.getByLabelText('시작일 고르기'))
    await fireEvent.press(view.getByLabelText('2026-09-20'))
    await fireEvent.press(view.getByLabelText('날짜 고르기 닫기'))
    expect(view.getByTestId('mvp-grade-sheet-date')).toHaveTextContent('9월 22일 (화)')

    await fireEvent.press(view.getByLabelText('시작일 고르기'))
    await fireEvent.press(view.getByLabelText('2026-09-20'))
    await fireEvent.press(view.getByRole('button', { name: '확인' }))
    expect(view.getByTestId('mvp-grade-sheet-date')).toHaveTextContent('9월 20일 (일)')
  })
})

describe('GradeEditSheet', () => {
  function 고치기(onSave = jest.fn(async () => {})) {
    return renderOverlay(
      <GradeEditSheet
        history={HISTORY}
        startDate="2026-07-30"
        todayDateKey={TODAY}
        onSave={onSave}
        onDelete={jest.fn()}
        onClose={jest.fn()}
      />,
    )
  }

  it('그 기록의 날과 등급으로 열리고 고친 값을 적는다', async () => {
    const onSave = jest.fn(async () => {})
    const view = await 고치기(onSave)

    expect(view.getByText('등급 기록 고치기')).toBeTruthy()
    expect(view.getByTestId('mvp-grade-sheet-date')).toHaveTextContent('7월 30일 (목)')
    expect(view.getByText('이 날부터 다음 기록 전까지 이 등급으로 계산해요.')).toBeTruthy()

    await fireEvent.press(view.getByLabelText('다이아'))
    await fireEvent.press(저장(view))

    expect(onSave).toHaveBeenCalledWith([
      { startDate: '2026-06-11', grade: 'silver' },
      { startDate: '2026-07-30', grade: 'diamond' },
    ])
  })

  it('앞 기록 다음 날부터 고를 수 있다', async () => {
    const view = await 고치기()

    await fireEvent.press(view.getByLabelText('시작일 고르기'))
    await fireEvent.press(view.getByLabelText('지난달'))

    expect(view.getByLabelText('2026-06-11').props.accessibilityState?.disabled).toBe(true)
    expect(view.getByLabelText('2026-06-12').props.accessibilityState?.disabled).toBe(false)
  })
})
