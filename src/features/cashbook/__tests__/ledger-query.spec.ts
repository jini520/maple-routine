// 가계부의 날짜별 줄 쿼리. 범위가 열쇠이고, 다섯 기록 표의 판이 오르면 다시 읽으며, 꺼 두면 안 읽는다.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { createElement, type ReactNode } from 'react'

jest.mock('../records', () => ({ loadMonthDays: jest.fn() }))
jest.mock('../../../storage/boss-profit', () => ({ subscribeBossProfitRecordsRevision: jest.fn() }))
jest.mock('../../../storage/boss-drops', () => ({ subscribeBossDropRecordsRevision: jest.fn() }))
jest.mock('../../../storage/income', () => ({ subscribeIncomeRecordsRevision: jest.fn() }))
jest.mock('../../../storage/spend', () => ({ subscribeSpendRecordsRevision: jest.fn() }))
jest.mock('../../../storage/enhancement-totals', () => ({ subscribeEnhancementTotalsRevision: jest.fn() }))
jest.mock('../../../storage/schedule-probe-ledger', () => ({ subscribeScheduleProbeLedgerRevision: jest.fn() }))

import { startRecordInvalidation } from '../../query/invalidation'
import { useLedgerDays } from '../ledger-query'

const { loadMonthDays } = jest.requireMock('../records') as { loadMonthDays: jest.Mock }

const subscribers = {
  boss_profit_records: jest.requireMock('../../../storage/boss-profit').subscribeBossProfitRecordsRevision as jest.Mock,
  boss_drop_records: jest.requireMock('../../../storage/boss-drops').subscribeBossDropRecordsRevision as jest.Mock,
  income_records: jest.requireMock('../../../storage/income').subscribeIncomeRecordsRevision as jest.Mock,
  spend_records: jest.requireMock('../../../storage/spend').subscribeSpendRecordsRevision as jest.Mock,
  enhancement_totals: jest.requireMock('../../../storage/enhancement-totals').subscribeEnhancementTotalsRevision as jest.Mock,
  schedule_probe_ledger: jest.requireMock('../../../storage/schedule-probe-ledger')
    .subscribeScheduleProbeLedgerRevision as jest.Mock,
}

/** 구독 함수가 받은 리스너. 표의 판이 올랐다고 알리는 데 쓴다. */
function 판이오른다(table: keyof typeof subscribers): () => void {
  return subscribers[table].mock.calls[0][0] as () => void
}

let client: QueryClient
let stop: () => void

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  return createElement(QueryClientProvider, { client }, children)
}

const 시월 = { from: '2026-10-01', to: '2026-10-31' }
const 하루 = { from: '2026-10-29', to: '2026-10-29' }

beforeEach(() => {
  jest.clearAllMocks()
  for (const subscribe of Object.values(subscribers)) subscribe.mockReturnValue(() => undefined)
  loadMonthDays.mockResolvedValue({})
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  stop = startRecordInvalidation(client)
})

afterEach(() => {
  stop()
  client.clear()
})

// today 의 이번 주 · 가계부의 달 · 통계의 전 기간이 같은 열쇠 이름을 쓴다. 범위가 갈라 주지 않으면 서로의 값을 덮는다.
it('범위가 열쇠다. 다른 범위는 따로 읽고 같은 범위는 한 번만 읽어 같은 값을 본다', async () => {
  const { result } = await renderHook(
    () => [useLedgerDays(시월), useLedgerDays(하루), useLedgerDays({ ...시월 })] as const,
    { wrapper },
  )

  await waitFor(() => expect(result.current[1].days).not.toBeNull())

  expect(loadMonthDays.mock.calls).toEqual([
    ['2026-10-01', '2026-10-31'],
    ['2026-10-29', '2026-10-29'],
  ])
  expect(result.current[0].days).toBe(result.current[2].days)
})

// 보스 결정석 · 드롭 판매 · 수입 · 지출 · 강화 지출이 한 줄 묶음에 든다. 하나라도 빠지면 그 표를 쓴 화면이 옛 숫자에 굳는다.
// 조회 원장은 지난 기간의 상태만 바꾸는 표라 이 줄과 무관하다.
it('다섯 기록 표 어느 판이 올라도 다시 읽고, 조회 원장의 판은 안 본다', async () => {
  const { result } = await renderHook(() => useLedgerDays(시월), { wrapper })
  await waitFor(() => expect(result.current.days).not.toBeNull())

  for (const table of [
    'boss_profit_records',
    'boss_drop_records',
    'income_records',
    'spend_records',
    'enhancement_totals',
  ] as const) {
    const 전 = loadMonthDays.mock.calls.length
    await act(async () => {
      판이오른다(table)()
    })
    await waitFor(() => expect(loadMonthDays.mock.calls.length).toBe(전 + 1))
  }

  const 전 = loadMonthDays.mock.calls.length
  await act(async () => {
    판이오른다('schedule_probe_ledger')()
  })
  expect(loadMonthDays.mock.calls.length).toBe(전)
})

// 층이 기록을 채우는 동안 읽으면 자라는 중인 값을 받아 버린다. 그동안은 묻지 않는다.
it('꺼 두면 안 읽고 days 가 null 이다. 켜면 그때 읽는다', async () => {
  const { result, rerender } = await renderHook((enabled: boolean) => useLedgerDays(하루, enabled), {
    wrapper,
    initialProps: false,
  })

  expect(loadMonthDays).not.toHaveBeenCalled()
  expect(result.current.days).toBeNull()

  await rerender(true)

  await waitFor(() => expect(result.current.days).toEqual({}))
  expect(loadMonthDays).toHaveBeenCalledWith('2026-10-29', '2026-10-29')
})
