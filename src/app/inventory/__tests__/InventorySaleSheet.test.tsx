import type { ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

// 시트 껍데기는 가계부 시트 테스트와 같은 방식으로 세운다. 라이브러리를 목으로 갈아 끼우고 내용만 본다.
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
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    useBottomSheetTimingConfigs: (config: unknown) => config,
    useBottomSheetInternal: () =>
      jest.requireActual<typeof import('../../../components/__tests__/bottom-sheet-internal-fake')>(
        '../../../components/__tests__/bottom-sheet-internal-fake',
      ).fakeBottomSheetInternal(),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

// 자동 수수료가 읽는 등급 기록. 칸 얼굴(ocid-1)이 다이아 ID 라 자동 요율이 서고 저장이 켜진다.
jest.mock('../../../features/mvp-grade/fee-context', () => ({
  loadFeeContext: jest.fn(async () => ({
    histories: new Map([['A', [{ startDate: '2026-06-11', grade: 'diamond' }]]]),
    sightings: [{ ocid: 'ocid-1', name: '루디', accountId: 'A', firstSeenOn: '2026-06-01', lastSeenOn: '2099-12-31' }],
    fallbackOcid: 'ocid-1',
  })),
}))

jest.mock('../../../features/cashbook/records', () => ({ recordIncome: jest.fn(async () => undefined) }))

import { renderOverlay } from '../../../components/__tests__/render-atom'
import type { InventoryCell } from '../../../features/inventory/cells'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { InventorySaleSheet } from '../InventorySaleSheet'

const { recordIncome } = jest.requireMock('../../../features/cashbook/records') as { recordIncome: jest.Mock }

const 넣은벨트 = {
  id: 'item-belt',
  accountId: 'maple-a',
  worldKey: 'scania',
  itemKey: 'dreamy_belt',
  itemKindKey: 'equipment',
  quantity: 1,
  used: 0,
  purchased: 0,
  remaining: 1,
  ringLevel: null,
}
const 벨트칸 = {
  kind: 'item',
  item: 넣은벨트,
  itemKey: 'dreamy_belt',
  itemKindKey: 'equipment',
  count: 1,
  ringLevel: null,
  faceOcid: 'ocid-1',
  tag: null,
} as Extract<InventoryCell, { kind: 'item' }>

type 화면 = Awaited<ReturnType<typeof renderOverlay>>

async function 누르기(view: 화면, 대상: string): Promise<void> {
  await act(async () => {
    fireEvent.press(대상.startsWith('inventory-') || 대상.startsWith('input-card-') ? view.getByTestId(대상) : view.getByLabelText(대상))
  })
}

async function 카드에치기(view: 화면, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('input-card-value'), text)
  })
  await 누르기(view, 'input-card-confirm')
}

beforeEach(() => {
  installNoopNativePorts()
  recordIncome.mockClear()
})

// 인벤토리에서 판 것도 가계부 `아이템 판매` 기록이 되므로, 가계부 판매 폼과 같은 메모 칸을 둔다.
describe('InventorySaleSheet 메모', () => {
  it('메모 칸이 서고, 맥락 줄이 그 칸의 아이템 이름인 여러 줄 카드로 적은 메모가 판 기록에 실린다', async () => {
    const view = await renderOverlay(<InventorySaleSheet cell={벨트칸} owner="메이플ID-maple-a · 스카니아" onClose={jest.fn()} />)

    await 누르기(view, '메모 추가')
    expect(view.getByTestId('input-card-context')).toHaveTextContent('몽환의 벨트')
    expect(view.getByTestId('input-card-value').props.multiline).toBe(true)
    await 카드에치기(view, '21성 보공 2줄')
    expect(view.getByTestId('inventory-sale-memo-body').props.children).toBe('21성 보공 2줄')

    await 누르기(view, 'inventory-sale-price')
    await 카드에치기(view, '3200000000')
    await 누르기(view, '저장')

    expect(recordIncome.mock.calls[0][0]).toMatchObject({
      category: 'item_sale',
      itemKey: 'dreamy_belt',
      inventoryItemId: 'item-belt',
      memo: '21성 보공 2줄',
    })
  })
})
