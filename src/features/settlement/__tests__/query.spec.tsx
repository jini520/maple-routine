import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

jest.mock('../../../server/settlement', () => ({ fetchSettlement: jest.fn() }))
jest.mock('../../../storage/settlement-banner', () => ({
  getDismissedSettlementAt: jest.fn(async () => null),
  dismissSettlement: jest.fn(async () => undefined),
}))

import { queryClient } from '../../query/client'
import { isSettlementVisible, refreshSettlement, settlementOptions, useSettlementBanner } from '../query'
import { resetSettlementDismissalForTests } from '../store'

const { fetchSettlement: fetchMock } = jest.requireMock('../../../server/settlement') as Record<string, jest.Mock>
const { getDismissedSettlementAt: dismissedMock, dismissSettlement: dismissMock } = jest.requireMock(
  '../../../storage/settlement-banner',
) as Record<string, jest.Mock>

const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  queryClient.clear()
  resetSettlementDismissalForTests()
  jest.clearAllMocks()
  dismissedMock.mockResolvedValue(null)
  fetchMock.mockResolvedValue({ settling: true, startedAt: '2026-10-31T17:00:00.000Z' })
})

it('서버 쿼리라 복귀마다 받는다', () => {
  expect(settlementOptions.refetchOnWindowFocus).toBe('always')
  expect(settlementOptions.meta).toEqual({ source: 'server' })
})

it('결산 중이고 이번 결산을 안 닫았을 때만 줄을 세운다. 못 받은 것도 안 세운다', () => {
  expect(isSettlementVisible({ settling: true, startedAt: 'a' }, null)).toBe(true)
  expect(isSettlementVisible({ settling: true, startedAt: 'a' }, 'a')).toBe(false)
  expect(isSettlementVisible({ settling: false, startedAt: null }, null)).toBe(false)
  expect(isSettlementVisible(null, null)).toBe(false)
  expect(isSettlementVisible(undefined, null)).toBe(false)
})

it('닫으면 그 결산의 시작 시각을 기기에 적고, 다음 결산은 시각이 달라 다시 선다', async () => {
  const { result } = await renderHook(() => useSettlementBanner(), { wrapper })
  await waitFor(() => expect(result.current.visible).toBe(true))

  await act(() => result.current.dismiss())
  expect(dismissMock).toHaveBeenCalledWith('2026-10-31T17:00:00.000Z')
  expect(result.current.visible).toBe(false)

  fetchMock.mockResolvedValue({ settling: true, startedAt: '2026-11-01T17:00:00.000Z' })
  await act(() => refreshSettlement())
  await waitFor(() => expect(result.current.visible).toBe(true))
})

// 앱을 다시 켠 뒤 첫 회차가 닫은 기록을 모르면 이미 닫은 줄이 한 번 선다.
it('기기에 닫은 기록이 있으면 처음부터 안 세운다', async () => {
  dismissedMock.mockResolvedValue('2026-10-31T17:00:00.000Z')

  const { result } = await renderHook(() => useSettlementBanner(), { wrapper })
  await waitFor(() => expect(queryClient.getQueryData(settlementOptions.queryKey)).toBeDefined())

  expect(result.current.visible).toBe(false)
})

it('회차가 겹쳐 물어도 서버는 한 번만 부른다', async () => {
  let resolve: (value: unknown) => void = () => undefined
  fetchMock.mockReturnValue(new Promise((done) => (resolve = done)))

  const first = refreshSettlement()
  const second = refreshSettlement()
  resolve({ settling: false, startedAt: null })
  await Promise.all([first, second])

  expect(fetchMock).toHaveBeenCalledTimes(1)
})
