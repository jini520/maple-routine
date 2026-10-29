// Open API 점검 배너. 넥슨 데이터를 읽는 화면의 머리글 바로 아래에 서는 띠 한 줄.
//
// 여기가 지키는 것 셋. **무엇이 점검 중인지 따로 말한다**(메이플스토리 API 점검과 Open API 점검을 묶지 않는다) ·
// **X 가 스토어의 닫기를 부른다**(한 화면에서 닫으면 이번 점검 동안 모든 화면에서 내려간다) ·
// **줄을 탭하면 FAQ 시트가 열린다**(X 는 시트를 안 연다).
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
    useBottomSheetInternal: () =>
      jest.requireActual<typeof import('../../components/__tests__/bottom-sheet-internal-fake')>(
        '../../components/__tests__/bottom-sheet-internal-fake',
      ).fakeBottomSheetInternal(),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { act, fireEvent, screen } from '@testing-library/react-native'

import { renderOverlay } from '../../components/__tests__/render-atom'
import { useNexonMaintenanceStore } from '../../features/nexon-maintenance/store'
import { NexonMaintenanceBanner } from '../NexonMaintenanceBanner'

const dismiss = jest.fn()

beforeEach(() => {
  dismiss.mockClear()
  useNexonMaintenanceStore.setState({ scope: null, dismiss })
})

it('점검이 아니면 아무것도 안 그린다', async () => {
  await renderOverlay(<NexonMaintenanceBanner testID="banner" />)

  expect(screen.queryByTestId('banner')).toBeNull()
})

it.each([
  ['game', '메이플스토리 API 점검 중입니다.'],
  ['api', '넥슨 Open API 점검 중입니다.'],
] as const)('%s 점검이면 무엇이 점검 중인지와 마지막 값을 보인다는 것을 말한다', async (scope, title) => {
  useNexonMaintenanceStore.setState({ scope })

  await renderOverlay(<NexonMaintenanceBanner testID="banner" />)

  expect(screen.getByText(title)).toBeTruthy()
  expect(screen.getByText('점검이 끝날 때까지 마지막으로 불러온 정보를 보여 줍니다.')).toBeTruthy()
})

it('X 를 누르면 닫는다', async () => {
  useNexonMaintenanceStore.setState({ scope: 'game' })
  await renderOverlay(<NexonMaintenanceBanner testID="banner" />)

  await act(async () => {
    fireEvent.press(screen.getByLabelText('점검 안내 닫기'))
  })

  expect(dismiss).toHaveBeenCalledTimes(1)
})

it('줄을 탭하면 FAQ 시트가 열린다', async () => {
  useNexonMaintenanceStore.setState({ scope: 'api' })
  await renderOverlay(<NexonMaintenanceBanner testID="banner" />)

  await act(async () => {
    fireEvent.press(screen.getByLabelText('점검이 무엇인지 보기'))
  })

  expect(screen.getByText('Open API 점검')).toBeTruthy()
  expect(screen.getByText('점검 중에는 무엇을 불러올 수 없나요?')).toBeTruthy()
})

it('X 는 시트를 안 연다', async () => {
  useNexonMaintenanceStore.setState({ scope: 'game' })
  await renderOverlay(<NexonMaintenanceBanner testID="banner" />)

  await act(async () => {
    fireEvent.press(screen.getByLabelText('점검 안내 닫기'))
  })

  expect(screen.queryByText('점검 중에는 무엇을 불러올 수 없나요?')).toBeNull()
})
