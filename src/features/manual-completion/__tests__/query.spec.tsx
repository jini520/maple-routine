import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

jest.mock('../../../server/manual-completion', () => ({ fetchManualCompletionBosses: jest.fn() }))
jest.mock('../../../storage/manual-completion-banner', () => ({
  getDismissedManualCompletionWeek: jest.fn(async () => null),
  dismissManualCompletion: jest.fn(async () => undefined),
}))

import { getCurrentBossProfitPeriod } from '../../../lib/boss/boss-profit-period'
import { queryClient } from '../../query/client'
import { isManualCompletionVisible, manualCompletionOptions, useManualCompletionBanner, useManualCompletionBosses } from '../query'
import { resetManualCompletionDismissalForTests } from '../store'

const { fetchManualCompletionBosses: fetchMock } = jest.requireMock('../../../server/manual-completion') as Record<string, jest.Mock>
const { getDismissedManualCompletionWeek: dismissedMock, dismissManualCompletion: dismissMock } = jest.requireMock(
  '../../../storage/manual-completion-banner',
) as Record<string, jest.Mock>

const NOW = new Date('2026-10-31T05:00:00.000Z')
const THIS_WEEK = getCurrentBossProfitPeriod('weekly', NOW).periodKey
const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
  queryClient.clear()
  resetManualCompletionDismissalForTests()
  jest.clearAllMocks()
  dismissedMock.mockResolvedValue(null)
  fetchMock.mockResolvedValue([{ boss: 'lotus', from: '2026-10-30' }])
})

afterEach(() => {
  jest.useRealTimers()
})

it('진입마다 묻는 서버 쿼리다', () => {
  expect(manualCompletionOptions.staleTime).toBe(0)
  expect(manualCompletionOptions.refetchOnWindowFocus).toBe('always')
  expect(manualCompletionOptions.meta).toEqual({ source: 'server' })
})

it('열린 보스가 있고 이번 주에 안 닫았을 때만 줄을 세운다. 못 받은 것(`null`)은 안 세운다', () => {
  expect(isManualCompletionVisible([{ boss: 'lotus', from: '2026-10-30' }], null, NOW)).toBe(true)
  expect(isManualCompletionVisible([{ boss: 'lotus', from: '2026-10-30' }], THIS_WEEK, NOW)).toBe(false)
  expect(isManualCompletionVisible([{ boss: 'lotus', from: '2026-10-30' }], '2026-10-22', NOW)).toBe(true)
  expect(isManualCompletionVisible([], null, NOW)).toBe(false)
  expect(isManualCompletionVisible(null, null, NOW)).toBe(false)
})

it('닫으면 이번 주 키를 기기에 적고 줄이 내려간다. 줄이 안 서 있으면 닫을 것도 없다', async () => {
  const { result } = await renderHook(() => useManualCompletionBanner(), { wrapper })
  await waitFor(() => expect(result.current.visible).toBe(true))

  await act(() => result.current.dismiss())
  expect(dismissMock).toHaveBeenCalledWith(THIS_WEEK)
  expect(result.current.visible).toBe(false)

  await act(() => result.current.dismiss())
  expect(dismissMock).toHaveBeenCalledTimes(1)
})

it('단추가 보는 목록은 같은 쿼리다. 못 받았으면 `null` 이다', async () => {
  fetchMock.mockResolvedValue(null)
  const { result } = await renderHook(() => useManualCompletionBosses(), { wrapper })
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(result.current).toBeNull()
})
