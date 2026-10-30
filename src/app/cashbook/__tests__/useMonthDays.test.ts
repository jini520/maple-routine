// 가계부가 달 단위로 드는 쿼리 묶음. 여기서 보는 것은 셋이다. 층이 채우는 동안 안 읽는 것, 안 든 달과 든 달의 그날 줄을
// 가르는 것, 무효화돼 다시 읽는 동안 옛 값을 그대로 그리는 것.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { createElement, type ReactNode } from 'react'

import type { DayRecord } from '../../../features/cashbook/records'

// 달 읽기만 목이다. 칸 금액으로 접는 `amountsOfDays` 는 진짜라야 줄이 금액이 되는 길을 본다.
jest.mock('../../../features/cashbook/records', () => {
  const actual = jest.requireActual('../../../features/cashbook/records')
  return { amountsOfDays: actual.amountsOfDays, loadMonthDays: jest.fn() }
})

import { useMonthDays } from '../useMonthDays'

const { loadMonthDays } = jest.requireMock('../../../features/cashbook/records') as { loadMonthDays: jest.Mock }

let client: QueryClient

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  return createElement(QueryClientProvider, { client }, children)
}

function 수입줄(dateKey: string, meso: number): DayRecord {
  return {
    kind: 'income',
    characterName: '',
    record: { id: `i-${dateKey}`, earnedOn: dateKey, mesoAmount: meso, pointAmount: null, pointPer100mMeso: null },
  } as unknown as DayRecord
}

/** 오늘이 2026-08 이라 창은 8 · 7 · 6월 셋이다. */
const 입력 = (paused = false) => ({ viewMonthKey: '2026-08', todayMonthKey: '2026-08', paused })

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  loadMonthDays.mockReset().mockResolvedValue({})
})

afterEach(() => {
  client.clear()
})

// 회차가 도는 동안의 DB 는 자라는 중이라 한 칸의 값이 종류가 도착할 때마다 커진다. 다 합산된 뒤에 읽는다.
it('층이 채우는 동안은 안 읽고, 풀리면 창의 달을 보는 달부터 달력 월 범위로 읽는다', async () => {
  const { result, rerender } = await renderHook((input: ReturnType<typeof 입력>) => useMonthDays(input), {
    wrapper,
    initialProps: 입력(true),
  })

  expect(loadMonthDays).not.toHaveBeenCalled()
  expect(result.current.has('2026-08')).toBe(false)

  await rerender(입력(false))

  await waitFor(() => expect(result.current.has('2026-06')).toBe(true))
  expect(loadMonthDays.mock.calls).toEqual([
    ['2026-08-01', '2026-08-31'],
    ['2026-07-01', '2026-07-31'],
    ['2026-06-01', '2026-06-30'],
  ])
})

// 아직 안 읽었다 와 읽었더니 없더라 는 다른 사실이다. 안 가르면 들어오자마자 빈 상태가 한 번 번쩍인다.
it('안 든 달의 날은 null 이고, 든 달은 줄이 없는 날도 빈 목록이다', async () => {
  loadMonthDays.mockImplementation(async (from: string) =>
    from === '2026-08-01' ? { '2026-08-23': [수입줄('2026-08-23', 100)] } : {},
  )

  const { result } = await renderHook(() => useMonthDays(입력()), { wrapper })

  expect(result.current.recordsOn('2026-08-23')).toBeNull()

  await waitFor(() => expect(result.current.has('2026-08')).toBe(true))
  expect(result.current.recordsOn('2026-08-23')).toHaveLength(1)
  expect(result.current.recordsOn('2026-08-24')).toEqual([])
  // 창 밖의 달은 안 든다. 부르는 쪽이 따로 읽는다.
  expect(result.current.recordsOn('2026-09-01')).toBeNull()
  expect(result.current.amounts['2026-08-23']).toEqual({ incomeMeso: 100, expenseMeso: 0 })
})

// 판이 바뀔 때마다 표를 비우면 층이 회차를 끝낼 때마다 격자가 한 번씩 하얘진다.
it('무효화돼 다시 읽는 동안 옛 값을 그대로 그린다', async () => {
  loadMonthDays.mockResolvedValue({ '2026-08-23': [수입줄('2026-08-23', 100)] })
  const { result } = await renderHook(() => useMonthDays(입력()), { wrapper })
  await waitFor(() => expect(result.current.amounts['2026-08-23']?.incomeMeso).toBe(100))

  loadMonthDays.mockReturnValue(new Promise(() => undefined))
  await act(async () => {
    void client.invalidateQueries()
  })

  expect(result.current.amounts['2026-08-23']?.incomeMeso).toBe(100)
  expect(result.current.recordsOn('2026-08-23')).toHaveLength(1)
})
