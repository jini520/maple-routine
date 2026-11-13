import type { ReactNode } from 'react'
import { act, fireEvent, within } from '@testing-library/react-native'

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

jest.mock('../../../features/inventory/query', () => ({ useInventory: jest.fn() }))
jest.mock('../../../features/inventory/load', () => ({
  loadInventoryOwners: jest.fn(async () => [
    { accountId: 'maple-a', worldKey: 'scania', mapleIdName: '메이플ID-maple-a', characterName: '낮잠곰', label: '메이플ID-maple-a · 스카니아' },
    { accountId: 'maple-a', worldKey: 'bera', mapleIdName: '메이플ID-maple-a', characterName: '단풍줍기', label: '메이플ID-maple-a · 베라' },
  ]),
}))
jest.mock('../../../features/inventory/actions', () => ({
  loadDropForSale: jest.fn(),
  sellDrop: jest.fn(async () => undefined),
  skipDrop: jest.fn(async () => undefined),
  removeInventoryRemaining: jest.fn(async () => undefined),
  editInventoryRemaining: jest.fn(async () => undefined),
  addToInventory: jest.fn(async () => undefined),
}))

import { flattenStyle, renderOverlay } from '../../../components/__tests__/render-atom'
import type { BossDropRecord } from '../../../storage/boss-drops'
import type { InventoryCell } from '../../../features/inventory/cells'
import type { InventoryView } from '../../../features/inventory/load'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { InventoryScreen } from '../InventoryScreen'

const { useInventory } = jest.requireMock('../../../features/inventory/query') as { useInventory: jest.Mock }
const actions = jest.requireMock('../../../features/inventory/actions') as Record<string, jest.Mock>

const 드롭 = { dropRecordId: 'drop-1', ocid: 'ocid-a', itemKey: 'stone', category: 'consumable', quantity: 1 } as BossDropRecord
const 넣은것 = { id: 'item-1', accountId: 'maple-a', worldKey: 'scania', itemKey: 'stone', itemKindKey: 'consumable', quantity: 3, used: 0, purchased: 0, remaining: 3, ringLevel: null }
const 넣은장비 = { ...넣은것, id: 'item-2', itemKey: 'belt', itemKindKey: 'equipment', quantity: 1, remaining: 1 }

const CELLS: InventoryCell[] = [
  { kind: 'item', item: 넣은장비, itemKey: 'belt', itemKindKey: 'equipment', count: 1, ringLevel: null, faceOcid: null, tag: null },
  { kind: 'drop', drop: 드롭, itemKey: 'stone', itemKindKey: 'consumable', count: 1, ringLevel: null, faceOcid: 'ocid-a', tag: null },
  { kind: 'item', item: 넣은것, itemKey: 'stone', itemKindKey: 'consumable', count: 3, ringLevel: null, faceOcid: null, tag: null },
]

const VIEW: InventoryView = {
  cells: CELLS,
  faces: { 'ocid-a': { name: '낮잠곰', imageUrl: null, unavailable: false } },
  owners: { 'item-1': '메이플ID-maple-a · 스카니아', 'item-2': '메이플ID-maple-a · 스카니아' },
}

type 화면 = Awaited<ReturnType<typeof renderOverlay>>

async function 열기(): Promise<화면> {
  const view = await renderOverlay(<InventoryScreen />)
  await act(async () => {
    fireEvent(view.getByTestId('inventory-grid'), 'layout', { nativeEvent: { layout: { width: 360, height: 400 } } })
  })
  return view
}

async function 누르기(view: 화면, 대상: string): Promise<void> {
  await act(async () => {
    fireEvent.press(대상.startsWith('inventory-') ? view.getByTestId(대상) : view.getByLabelText(대상))
  })
}

beforeEach(() => {
  installNoopNativePorts()
  useInventory.mockReset().mockReturnValue({ data: VIEW, isError: false, refetch: jest.fn() })
  for (const mock of Object.values(actions)) mock.mockClear()
})

describe('InventoryScreen', () => {
  it('칸을 누르면 그 칸의 글자가 선다. 보스 드롭은 판매 · 기록 안함이다', async () => {
    const view = await 열기()

    await 누르기(view, 'inventory-cell-1')

    expect(view.getByLabelText('판매')).toBeTruthy()
    expect(view.getByLabelText('기록 안함')).toBeTruthy()
    expect(view.queryByLabelText('삭제')).toBeNull()
  })

  it('보스 드롭의 기록 안함은 확인을 묻지 않고 바로 저장한다', async () => {
    const view = await 열기()
    await 누르기(view, 'inventory-cell-1')

    await 누르기(view, '기록 안함')

    expect(actions.skipDrop).toHaveBeenCalledWith(드롭)
    expect(view.queryByTestId('inventory-delete')).toBeNull()
  })

  it('넣은 장비는 판매 · 삭제만 서고, 넣은 소비 아이템은 판매 · 수정 · 삭제가 선다', async () => {
    const view = await 열기()

    await 누르기(view, 'inventory-cell-0')
    expect(view.queryByLabelText('수정')).toBeNull()
    expect(view.getByLabelText('삭제')).toBeTruthy()

    await 누르기(view, '메뉴 닫기')
    await 누르기(view, 'inventory-cell-2')
    expect(view.getByLabelText('수정')).toBeTruthy()
  })

  it('넣은 아이템의 삭제는 확인을 한 번 더 묻고, 확인해야 남은 것을 지운다', async () => {
    const view = await 열기()
    await 누르기(view, 'inventory-cell-2')
    await 누르기(view, '삭제')

    expect(view.getByText('아이템을 삭제할까요?')).toBeTruthy()
    expect(view.getByText('메이플ID-maple-a · 스카니아')).toBeTruthy()
    expect(actions.removeInventoryRemaining).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.press(view.getByText('삭제'))
    })
    expect(actions.removeInventoryRemaining).toHaveBeenCalledWith('item-1')
  })

  it('넣기에는 종류 칸이 없고 찾아 고른 아이템의 종류로 넣는다. 특수스킬 반지는 목록에서 레벨째 골라 레벨 칸 · 수량 칸이 없다', async () => {
    const view = await 열기()
    await 누르기(view, 'inventory-add-fab')
    expect(view.queryByTestId('inventory-add-kind')).toBeNull()

    await 누르기(view, 'inventory-add-owner-open')
    await 누르기(view, 'inventory-add-owner-option-maple-a|scania')
    await 누르기(view, 'inventory-add-item')
    await act(async () => {
      fireEvent.changeText(view.getByTestId('input-card-value'), '리스크테이커')
    })
    expect(view.getByTestId('input-card-suggestion-risk_taker_ring@3')).toHaveTextContent('리스크테이커 링 Lv.3')
    await act(async () => {
      fireEvent.press(view.getByTestId('input-card-suggestion-risk_taker_ring@4'))
    })

    expect(view.queryByTestId('inventory-add-quantity')).toBeNull()
    expect(view.queryByTestId('inventory-add-ring-level')).toBeNull()
    expect(view.getByTestId('inventory-add-item')).toHaveTextContent('리스크테이커 링 Lv.4')

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '저장' }))
    })

    expect(actions.addToInventory).toHaveBeenCalledWith({
      accountId: 'maple-a',
      worldKey: 'scania',
      itemKey: 'risk_taker_ring',
      itemKindKey: 'equipment',
      quantity: 1,
      ringLevel: 4,
    })
  })

  it('특수스킬 반지 칸은 레벨 배지를 달고, 장비는 칸과 삭제 확인에 수량을 적지 않는다', async () => {
    useInventory.mockReturnValue({ data: { ...VIEW, cells: [{ ...CELLS[0], ringLevel: 4 }] }, isError: false, refetch: jest.fn() })
    const view = await 열기()

    // 배지는 읽기 도구에서 숨기고 칸의 이름표가 레벨을 읽는다.
    expect(within(view.getByTestId('inventory-cell-0')).getByText('lv4', { includeHiddenElements: true })).toBeTruthy()
    expect(view.getByLabelText('belt 4레벨')).toBeTruthy()

    await 누르기(view, 'inventory-cell-0')
    await 누르기(view, '삭제')
    expect(view.getByText('아이템을 삭제할까요?')).toBeTruthy()
    expect(view.queryByText('1개')).toBeNull()
  })

  it('메이플 ID · 월드 보기는 메이플 ID 이름과 그 월드 대표 캐릭터 두 줄이고, 같은 메이플 ID 라도 월드마다 따로 선다', async () => {
    const view = await 열기()
    await 누르기(view, 'inventory-add-fab')

    await 누르기(view, 'inventory-add-owner-open')

    expect(view.getByTestId('inventory-add-owner-option-maple-a|scania')).toHaveTextContent('메이플ID-maple-a낮잠곰')
    expect(view.getByTestId('inventory-add-owner-option-maple-a|bera')).toHaveTextContent('메이플ID-maple-a단풍줍기')
  })

  // 드롭다운은 열기 전에 높이 auto 상자에서 목록을 재고 자리를 정한다. 보기에 flex-1(기준 크기 0)이 있으면 거기서 접혀 짧게 재지고,
  // 아래에 다 들어간다고 보고 열어 보기 둘에도 스크롤이 생긴다.
  it('메이플 ID · 월드 보기의 상자는 기준 크기가 0 이 아니라 목록을 잴 때 접히지 않는다', async () => {
    const view = await 열기()
    await 누르기(view, 'inventory-add-fab')
    await 누르기(view, 'inventory-add-owner-open')

    for (const row of view.getAllByTestId(/^inventory-add-owner-row-/, { includeHiddenElements: true })) {
      expect(flattenStyle(row.props.style).flexBasis).toBeUndefined()
    }
  })

  it('탭을 고르면 그 종류의 칸만 선다', async () => {
    const view = await 열기()

    await 누르기(view, 'inventory-tabs-equipment')

    expect(view.getByTestId('inventory-cell-0')).toBeTruthy()
    expect(view.queryByTestId('inventory-cell-1')).toBeNull()
  })
})
