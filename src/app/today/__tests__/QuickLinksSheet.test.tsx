// 빠른 이동 편집 시트. 이 파일이 지키는 것 넷.
// ① 본문 타일을 누르면 트레이 끝에 붙고, 다시 누르거나 트레이 칸을 누르면 빠진다
// ② 칸이 다 차면 고르지 않은 타일이 흐려지고 눌러도 붙지 않는다
// ③ `한 줄` 로 바꾸면 트레이 차례로 여섯 번째부터 빠진다
// ④ `적용` 해야 저장된다. 하나도 고르지 않으면 `적용` 을 누를 수 없다
import type { ReactNode } from 'react'
import { fireEvent, waitFor } from '@testing-library/react-native'

import { flattenStyle, renderOverlay } from '../../../components/__tests__/render-atom'
import { DEFAULT_QUICK_LINKS } from '../../../features/quick-links/config'
import { useQuickLinksStore } from '../../../features/quick-links/store'
import type { QuickLinksConfig } from '../../../types/quick-links'
import { QuickLinksSheet } from '../QuickLinksSheet'

// 시트 라이브러리를 맨 뷰로 바꾼다. 여기서 보는 것은 시트 안에 무엇이 서는가다.
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

const save = jest.fn((config: QuickLinksConfig) => {
  useQuickLinksStore.setState({ config })
  return Promise.resolve()
})

beforeEach(() => {
  save.mockClear()
  useQuickLinksStore.setState({ config: DEFAULT_QUICK_LINKS, save })
})

async function 시트(config: QuickLinksConfig, onClose = jest.fn()) {
  const view = await renderOverlay(<QuickLinksSheet config={config} onClose={onClose} />)
  return { view, onClose }
}

function 트레이(view: Awaited<ReturnType<typeof renderOverlay>>): string[] {
  return view.queryAllByTestId(/^quick-links-tray-/).map((node) => String(node.props.testID).replace('quick-links-tray-', ''))
}

describe('고르기', () => {
  it('타일을 누르면 트레이 끝에 붙고, 다시 누르면 빠진다', async () => {
    const { view } = await 시트({ rows: 1, ids: ['profit'] })

    await fireEvent.press(view.getByTestId('quick-links-tile-boss'))
    expect(트레이(view)).toEqual(['profit', 'boss'])
    expect(view.getByTestId('quick-links-check-boss')).toBeTruthy()

    await fireEvent.press(view.getByTestId('quick-links-tile-boss'))
    expect(트레이(view)).toEqual(['profit'])
  })

  it('트레이 칸을 누르면 빠진다', async () => {
    const { view } = await 시트({ rows: 1, ids: ['profit', 'stats'] })

    await fireEvent.press(view.getByTestId('quick-links-tray-profit'))

    expect(트레이(view)).toEqual(['stats'])
  })

  it('칸이 다 차면 고르지 않은 타일이 흐려지고 눌러도 붙지 않는다', async () => {
    const { view } = await 시트(DEFAULT_QUICK_LINKS)

    const 보스 = view.getByTestId('quick-links-tile-boss')
    expect(flattenStyle(보스.props.style).opacity).toBeLessThan(1)
    expect(flattenStyle(view.getByTestId('quick-links-tile-profit').props.style).opacity ?? 1).toBe(1)

    await fireEvent.press(보스)
    expect(트레이(view)).toEqual(DEFAULT_QUICK_LINKS.ids)
  })
})

describe('줄 수', () => {
  it('`한 줄` 로 바꾸면 여섯 번째부터 빠진다', async () => {
    const ids: QuickLinksConfig['ids'] = ['profit', 'stats', 'boss-manage', 'item-split', 'app-settings', 'boss', 'notices']
    const { view } = await 시트({ rows: 2, ids })

    await fireEvent.press(view.getByText('한 줄'))

    expect(트레이(view)).toEqual(ids.slice(0, 5))
  })
})

describe('적용', () => {
  it('누르기 전에는 저장하지 않고, 누르면 저장하고 닫는다', async () => {
    const { view, onClose } = await 시트({ rows: 1, ids: ['profit'] })

    await fireEvent.press(view.getByTestId('quick-links-tile-stats'))
    expect(save).not.toHaveBeenCalled()

    await fireEvent.press(view.getByRole('button', { name: '적용' }))

    expect(save).toHaveBeenCalledWith({ rows: 1, ids: ['profit', 'stats'] })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('하나도 고르지 않으면 누를 수 없다', async () => {
    const { view } = await 시트({ rows: 1, ids: ['profit'] })

    await fireEvent.press(view.getByTestId('quick-links-tray-profit'))
    await fireEvent.press(view.getByRole('button', { name: '화면을 골라 주세요' }))

    expect(save).not.toHaveBeenCalled()
  })
})
