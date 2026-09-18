// 직접 완료 안내 줄. 결산 줄 바로 아래, 공지 배너 위에 서는 띠 한 줄.
//
// 여기가 지키는 것 셋. **서버가 연 보스가 있을 때만 선다** · **닫기와 탭이 다른 일을 한다**(X 는
// 이번 주 동안 닫고 그 밖은 FAQ 를 연다) · **문장 둘이 각자 한 줄**이다.
import type { ReactNode } from 'react'

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
    useBottomSheetInternal: () => null,
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.TextInput, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { act, fireEvent, screen } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useManualCompletionStore } from '../../../features/manual-completion/store'
import { ManualCompletionBanner } from '../ManualCompletionBanner'

const 열림 = {
  bosses: [{ boss: 'black_mage', from: '2026-09-01' }],
  dismissedWeek: null,
  visible: true,
}

const dismiss = jest.fn().mockResolvedValue(undefined)

function 세우기(overrides: Partial<typeof 열림> = {}): void {
  useManualCompletionStore.setState({ ...열림, ...overrides, dismiss })
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

beforeEach(() => {
  dismiss.mockClear()
  useManualCompletionStore.setState({ bosses: null, dismissedWeek: null, visible: false })
})

it('열린 보스가 있으면 문장 둘이 각자 한 줄로 선다', async () => {
  세우기()

  await renderOverlay(<ManualCompletionBanner />)

  expect(screen.getByText('직접 완료할 수 있는 보스가 있어요.')).toBeTruthy()
  expect(screen.getByText('넥슨이 완료를 주지 않는 보스를 직접 기록할 수 있습니다.')).toBeTruthy()
})

// 빈 상자를 두면 아래 것들이 이유 없이 밀린다.
it('열린 보스가 없으면 아무것도 안 그린다', async () => {
  await renderOverlay(<ManualCompletionBanner />)

  expect(screen.queryByTestId('today-manual-completion-banner')).toBeNull()
})

// 못 받은 것은 **아무것도 안 열림** 과 다른 사실이지만 화면이 하는 일은 같다.
it('이번 주에 닫았으면 안 그린다', async () => {
  세우기({ visible: false })

  await renderOverlay(<ManualCompletionBanner />)

  expect(screen.queryByTestId('today-manual-completion-banner')).toBeNull()
})

it('닫기를 누르면 스토어가 닫는다', async () => {
  세우기()
  await renderOverlay(<ManualCompletionBanner />)

  await press(screen.getByLabelText('직접 완료 안내 닫기'))

  expect(dismiss).toHaveBeenCalled()
})

it('줄을 탭하면 FAQ 시트가 열린다', async () => {
  세우기()
  await renderOverlay(<ManualCompletionBanner />)

  await press(screen.getByLabelText('직접 완료가 무엇인지 보기'))

  expect(screen.getByText('직접 완료')).toBeTruthy()
  expect(screen.getByText('보스를 잡았는데 완료가 되지 않아요.')).toBeTruthy()
})

it('닫기는 시트를 안 연다', async () => {
  세우기()
  await renderOverlay(<ManualCompletionBanner />)

  await press(screen.getByLabelText('직접 완료 안내 닫기'))

  expect(screen.queryByText('보스를 잡았는데 완료가 되지 않아요.')).toBeNull()
})
