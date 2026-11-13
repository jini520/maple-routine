import { act, fireEvent } from '@testing-library/react-native'

jest.mock('../../../features/inventory/query', () => ({ useInventory: jest.fn() }))
jest.mock('../../../features/inventory/actions', () => ({
  loadDropForSale: jest.fn(),
  sellDrop: jest.fn(async () => undefined),
  skipDrop: jest.fn(async () => undefined),
  removeInventoryRemaining: jest.fn(async () => undefined),
  editInventoryRemaining: jest.fn(async () => undefined),
  addToInventory: jest.fn(async () => undefined),
}))

import { renderOverlay } from '../../../components/__tests__/render-atom'
import type { BossDropRecord } from '../../../storage/boss-drops'
import type { InventoryCell } from '../../../features/inventory/cells'
import type { InventoryView } from '../../../features/inventory/load'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { InventoryScreen } from '../InventoryScreen'

const { useInventory } = jest.requireMock('../../../features/inventory/query') as { useInventory: jest.Mock }
const actions = jest.requireMock('../../../features/inventory/actions') as Record<string, jest.Mock>

const 드롭 = { dropRecordId: 'drop-1', ocid: 'ocid-a', itemKey: 'stone', category: 'consumable', quantity: 1 } as BossDropRecord
const 넣은것 = { id: 'item-1', accountId: 'maple-a', worldKey: 'scania', itemKey: 'stone', itemKindKey: 'consumable', quantity: 3, used: 0, remaining: 3 }
const 넣은장비 = { ...넣은것, id: 'item-2', itemKey: 'belt', itemKindKey: 'equipment', quantity: 1, remaining: 1 }

const CELLS: InventoryCell[] = [
  { kind: 'item', item: 넣은장비, itemKey: 'belt', itemKindKey: 'equipment', count: 1, faceOcid: null, tag: null },
  { kind: 'drop', drop: 드롭, itemKey: 'stone', itemKindKey: 'consumable', count: 1, faceOcid: 'ocid-a', tag: null },
  { kind: 'item', item: 넣은것, itemKey: 'stone', itemKindKey: 'consumable', count: 3, faceOcid: null, tag: null },
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

  it('탭을 고르면 그 종류의 칸만 선다', async () => {
    const view = await 열기()

    await 누르기(view, 'inventory-tabs-equipment')

    expect(view.getByTestId('inventory-cell-0')).toBeTruthy()
    expect(view.queryByTestId('inventory-cell-1')).toBeNull()
  })
})
