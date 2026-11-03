// 화면 머리 제목 옆의 물음표. 누르면 그 화면의 FAQ 시트가 열린다.
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
      jest.requireActual<typeof import('../../../__tests__/bottom-sheet-internal-fake')>(
        '../../../__tests__/bottom-sheet-internal-fake',
      ).fakeBottomSheetInternal(),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { act, fireEvent, screen } from '@testing-library/react-native'

import { renderOverlay } from '../../../__tests__/render-atom'
import type { FaqSheetContent } from '../../../../types/faq'
import { FaqButton } from '../FaqButton'

const 묶음: FaqSheetContent = {
  title: 'today',
  items: [
    {
      question: 'today에서는 무엇을 할 수 있나요?',
      answer: [{ kind: 'paragraph', text: '오늘 할 일과 이번 주 결과를 한눈에 보여 주는 화면이에요.' }],
    },
  ],
}

it('누르기 전에는 시트가 없고, 누르면 묶음 제목의 FAQ 시트가 열린다', async () => {
  await renderOverlay(<FaqButton sheet={묶음} />)

  expect(screen.queryByText('today에서는 무엇을 할 수 있나요?')).toBeNull()

  await act(async () => {
    fireEvent.press(screen.getByLabelText('자주 묻는 질문'))
  })

  expect(screen.getByText('today')).toBeTruthy()
  expect(screen.getByText('today에서는 무엇을 할 수 있나요?')).toBeTruthy()
})

// 문항이 없는 화면에도 물음표를 미리 달아 둔다. 서버에 문항이 생기기 전에는 보이지 않아야 한다.
it('묶음이 없으면 아무것도 그리지 않는다', async () => {
  await renderOverlay(<FaqButton sheet={null} />)

  expect(screen.queryByLabelText('자주 묻는 질문')).toBeNull()
})
