// 결산 안내 줄. today 맨 위, 공지 배너 바로 위에 서는 띠 한 줄.
//
// 여기가 지키는 것 셋. **결산 중일 때만 선다**(못 받았으면 안 선다) · **닫기와 탭이 다른 일을
// 한다**(X 는 닫고 그 밖은 FAQ 를 연다) · **문장 둘이 각자 한 줄**이다(한 문단으로 흘리면 폭에
// 따라 문장 가운데가 끊긴다).
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
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { act, fireEvent, screen } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useSettlementStore } from '../../../features/settlement/store'
import { SettlementBanner } from '../SettlementBanner'

const 결산중 = {
  settling: true,
  startedAt: '2026-09-16T15:30:00.000Z',
  dismissedAt: null,
  visible: true,
}

const dismiss = jest.fn().mockResolvedValue(undefined)

function 세우기(overrides: Partial<typeof 결산중> = {}): void {
  useSettlementStore.setState({ ...결산중, ...overrides, dismiss })
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

beforeEach(() => {
  dismiss.mockClear()
  useSettlementStore.setState({ settling: false, startedAt: null, dismissedAt: null, visible: false })
})

it('결산 중이면 문장 둘이 각자 한 줄로 선다', async () => {
  세우기()

  await renderOverlay(<SettlementBanner />)

  expect(screen.getByText('스케줄러 데이터를 결산 중입니다.')).toBeTruthy()
  expect(screen.getByText('일부 데이터가 갱신되지 않을 수 있습니다.')).toBeTruthy()
})

// 결산 중이 아닐 때 빈 상자를 두면 아래 것들이 이유 없이 밀린다.
it('결산 중이 아니면 아무것도 안 그린다', async () => {
  await renderOverlay(<SettlementBanner />)

  expect(screen.queryByTestId('today-settlement-banner')).toBeNull()
})

// 못 받은 것은 **결산 아님** 과 다른 사실이지만 화면이 하는 일은 같다.
it('서버를 못 받아 안 보이는 상태면 안 그린다', async () => {
  세우기({ visible: false })

  await renderOverlay(<SettlementBanner />)

  expect(screen.queryByTestId('today-settlement-banner')).toBeNull()
})

it('닫기를 누르면 스토어가 닫는다', async () => {
  세우기()
  await renderOverlay(<SettlementBanner />)

  await press(screen.getByLabelText('결산 안내 닫기'))

  expect(dismiss).toHaveBeenCalled()
})

it('줄을 탭하면 FAQ 시트가 열린다', async () => {
  세우기()
  await renderOverlay(<SettlementBanner />)

  await press(screen.getByLabelText('결산이 무엇인지 보기'))

  expect(screen.getByText('스케줄러 결산')).toBeTruthy()
  expect(screen.getByText('결산이 무엇인가요?')).toBeTruthy()
})

// 재조회가 아닌 이유는 결산 중에는 같은 값이 다시 와서 앱이 고장 난 것으로 읽히기 때문이다.
it('닫기는 시트를 안 연다', async () => {
  세우기()
  await renderOverlay(<SettlementBanner />)

  await press(screen.getByLabelText('결산 안내 닫기'))

  expect(screen.queryByText('결산이 무엇인가요?')).toBeNull()
})
