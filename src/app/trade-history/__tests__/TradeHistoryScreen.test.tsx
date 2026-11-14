// 거래 내역 화면. 사고판 기록을 날짜 제목 아래 최신 순으로 세우고, 줄을 누르면 읽기 전용 상세 시트가 열린다.
import type { ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

import type { ManualDayRecord } from '../../../features/cashbook/records'
import type { IncomeRecord } from '../../../storage/income'
import type { SpendRecord } from '../../../storage/spend'

const mockOpenTab = jest.fn()
jest.mock('../../../hooks/useOpenTab', () => ({ useOpenTab: () => mockOpenTab }))
jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: () => ({ goBack: jest.fn() }) }))
jest.mock('../../../features/refresh/freshness', () => ({ useRealtimeFetchedAt: jest.fn(() => null) }))
jest.mock('../../../features/cashbook/records', () => ({
  ...jest.requireActual('../../../features/cashbook/records'),
  loadTrackedCharacters: jest.fn(async () => []),
}))
let mockData: unknown = null
jest.mock('../../../features/trade-history/query', () => ({ useTradeHistory: () => mockData }))

// 시트 껍데기는 `CashbookScreen.test.tsx` 와 같은 방식으로 세운다.
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) => React.createElement(ReactNative.View, { testID: 'sheet-backdrop', ...props }),
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
import { tradeOwnerOptionsOf, tradeRowsOf } from '../../../features/trade-history/rows'
import { TradeHistoryScreen } from '../TradeHistoryScreen'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

// KST 2026-11-14(토) 14:00.
const 지금 = Date.parse('2026-11-14T05:00:00Z')

const income = (over: Partial<IncomeRecord> & Pick<IncomeRecord, 'id' | 'category'>): ManualDayRecord => ({
  kind: 'income',
  characterName: '단풍잎',
  record: {
    ocid: 'ocid-maple', earnedOn: '2026-11-14', item: null, itemKey: null, mesoAmount: 0, pointAmount: null, pointPer100mMeso: null,
    cashAmount: null, quantity: null, itemKind: null, saleFeePercent: null, saleFeeMeso: null, saleFeeAuto: false, hunt: null,
    recordedAt: '2026-11-14T03:00:00Z', ...over,
  },
})

const spend = (over: Partial<SpendRecord> & Pick<SpendRecord, 'id' | 'category'>): ManualDayRecord => ({
  kind: 'spend',
  characterName: '단풍잎',
  record: {
    ocid: 'ocid-maple', spentOn: '2026-11-14', item: null, itemKey: null, formItemKeys: null, itemKind: null, levelFrom: null,
    levelTo: null, quantity: null, mesoAmount: 0, tariffMeso: null, pointAmount: null, pointPer100mMeso: null,
    mesoMarketFeePercent: null, cashAmount: null, hexa: null, recordedAt: '2026-11-14T02:00:00Z', ...over,
  },
})

const 판매 = income({
  id: 'sale', category: 'item_sale', itemKey: 'spell_trace', itemKind: 'etc', quantity: 3000, mesoAmount: 99_750_000,
  saleFeeMeso: 5_250_000, saleFeePercent: 5, memo: '작업장 남은 흔적 정리',
})
const 구매 = spend({ id: 'buy', category: 'item_purchase', itemKey: 'dreamy_belt', itemKind: 'equipment', mesoAmount: 3_200_000_000, spentOn: '2026-11-13' })

function 데이터(entries: ManualDayRecord[]): void {
  const rows = tradeRowsOf(entries, [])
  mockData = { rows, owners: tradeOwnerOptionsOf(rows, ['ocid-maple'], []), floorDateKey: '2025-04-24' }
}

async function 그리기(): Promise<Rendered> {
  const view = await renderOverlay(<TradeHistoryScreen />)
  await act(async () => {})
  return view
}

beforeEach(() => {
  jest.useFakeTimers({ now: 지금 })
  mockOpenTab.mockReset()
  데이터([판매, 구매])
})

afterEach(() => {
  jest.useRealTimers()
})

describe('TradeHistoryScreen', () => {
  // 처음 기간은 오늘부터 3개월 전 같은 날까지다.
  it('기간 칸은 3개월 전 같은 날부터 오늘까지로 열린다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('trade-history-from')).toHaveTextContent('8월 14일')
    expect(view.getByTestId('trade-history-to')).toHaveTextContent('11월 14일')
  })

  // 판매 · 구매 글자, 이름, 개수가 한 줄이고 장비는 개수가 없다. 메모는 줄 카드 안 칸에 본문이 선다.
  it('줄은 판매 · 구매 글자와 이름 · 개수이고, 장비는 개수가 없으며 메모 본문이 선다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('trade-row-side-sale')).toHaveTextContent('판매')
    expect(view.getByTestId('trade-row-name-sale')).toHaveTextContent('주문의 흔적')
    expect(view.getByTestId('trade-row-quantity-sale')).toHaveTextContent('3,000개')
    expect(view.getByTestId('trade-row-memo-sale')).toHaveTextContent('작업장 남은 흔적 정리')
    expect(view.getByTestId('trade-row-side-buy')).toHaveTextContent('구매')
    expect(view.queryByTestId('trade-row-quantity-buy')).toBeNull()
    expect(view.getByTestId('trade-history-day-2026-11-13')).toHaveTextContent(/^11월 13일 \(금\)/)
  })

  it('세그먼트와 검색이 목록을 좁힌다', async () => {
    const view = await 그리기()

    await fireEvent.press(view.getByRole('button', { name: '구매' }))
    expect(view.queryByTestId('trade-row-sale')).toBeNull()
    expect(view.getByTestId('trade-row-buy')).toBeTruthy()

    await fireEvent.press(view.getByRole('button', { name: '전체' }))
    await fireEvent.changeText(view.getByTestId('trade-history-search'), '흔적')
    expect(view.getByTestId('trade-row-sale')).toBeTruthy()
    expect(view.queryByTestId('trade-row-buy')).toBeNull()
  })

  // 상세 시트는 읽기 전용이다. 날짜는 화살표 없는 알약이라 누를 수 없고, 버튼은 `거래로 이동` 하나다.
  it('줄을 누르면 읽기 전용 상세 시트가 열리고 `거래로 이동` 이 가계부에 그 기록을 넘긴다', async () => {
    const view = await 그리기()

    await fireEvent.press(view.getByTestId('trade-row-sale'))
    await act(async () => {})

    expect(view.getByTestId('trade-detail-title')).toHaveTextContent('아이템 판매')
    expect(view.getByTestId('trade-detail-date')).toHaveTextContent('11월 14일 (토)')
    expect(view.queryByRole('button', { name: /거래한 날/ })).toBeNull()
    expect(view.queryByRole('button', { name: /수정|삭제|지우기/ })).toBeNull()
    expect(view.getByTestId('trade-detail-cell-단가')).toHaveTextContent('단가35,000메소')
    expect(view.getByTestId('trade-detail-memo-body')).toHaveTextContent('작업장 남은 흔적 정리')

    await fireEvent.press(view.getByTestId('trade-detail-go'))

    expect(mockOpenTab).toHaveBeenCalledWith('Cashbook', {
      trade: { kind: 'entry', dateKey: '2026-11-14', entry: 판매 },
    })
  })

  // 읽기 전에는 빈 목록이라고 말하지 않는다. 아직 모르는 것을 없다고 말하게 된다.
  it('읽기 전에는 빈 목록 문구가 없다', async () => {
    mockData = null
    const view = await 그리기()

    expect(view.queryByTestId('empty-state-title')).toBeNull()
  })

  // 기록이 아예 없을 때와 필터에 맞는 기록이 없을 때 같은 문구다.
  it('기록이 없으면 `아직 기록이 없어요` 다', async () => {
    데이터([])
    const view = await 그리기()

    expect(view.getByTestId('empty-state-title')).toHaveTextContent('아직 기록이 없어요')
  })

  it('필터에 맞는 기록이 없어도 `아직 기록이 없어요` 다', async () => {
    const view = await 그리기()

    await fireEvent.changeText(view.getByTestId('trade-history-search'), '케이프')

    expect(view.getByTestId('empty-state-title')).toHaveTextContent('아직 기록이 없어요')
  })

  it('메모가 없는 기록의 상세 시트에는 메모 칸이 없다', async () => {
    const view = await 그리기()

    await fireEvent.press(view.getByTestId('trade-row-buy'))
    await act(async () => {})

    expect(view.getByTestId('trade-detail-title')).toHaveTextContent('아이템 구매')
    expect(view.queryByTestId('trade-detail-memo')).toBeNull()
  })
})
