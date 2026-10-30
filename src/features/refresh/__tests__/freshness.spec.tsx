import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import { latestRealtimeFetchedAt, useRealtimeFetchedAt } from '../freshness'

jest.mock('../../schedule-sync/schedule-query', () => ({
  scheduleRoundOptions: { queryKey: ['schedule-round'], queryFn: jest.fn() },
}))

const ROUND_AT = '2026-10-30T05:03:22.000Z'

describe('latestRealtimeFetchedAt', () => {
  it('둘 중 늦은 쪽이다', () => {
    expect(latestRealtimeFetchedAt(ROUND_AT, '2026-10-30T05:10:00.000Z')).toBe('2026-10-30T05:10:00.000Z')
    expect(latestRealtimeFetchedAt(ROUND_AT, '2026-10-30T05:00:00.000Z')).toBe(ROUND_AT)
  })

  it('한쪽만 있으면 그것이고, 둘 다 없으면 비어 있어 줄을 안 그린다', () => {
    expect(latestRealtimeFetchedAt(null, '2026-10-30T05:10:00.000Z')).toBe('2026-10-30T05:10:00.000Z')
    expect(latestRealtimeFetchedAt(ROUND_AT, undefined)).toBe(ROUND_AT)
    expect(latestRealtimeFetchedAt(null, undefined)).toBeNull()
    expect(latestRealtimeFetchedAt(undefined, undefined)).toBeNull()
  })

  it('못 읽는 값은 버린다', () => {
    expect(latestRealtimeFetchedAt(ROUND_AT, 'garbage')).toBe(ROUND_AT)
    expect(latestRealtimeFetchedAt('garbage', '2026-10-30T05:10:00.000Z')).toBe('2026-10-30T05:10:00.000Z')
  })
})

describe('useRealtimeFetchedAt', () => {
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  beforeEach(() => {
    queryClient.clear()
  })

  // 회차 쿼리의 `dataUpdatedAt` 이 아니라 실제로 받은 시각을 읽는다. 전원이 캐시로 채워진 회차도 쿼리는 성공이라
  // `dataUpdatedAt` 은 오르는데, 그것을 그리면 아무것도 안 받은 진입이 방금 받은 것처럼 보인다.
  it('회차가 실제로 받은 시각을 읽고, 회차를 스스로 받지는 않는다', async () => {
    queryClient.setQueryData(queryKeys.scheduleRound(), { receivedAt: ROUND_AT }, { updatedAt: Date.now() })

    const { result } = await renderHook(() => useRealtimeFetchedAt(), { wrapper })

    expect(result.current).toBe(ROUND_AT)
    expect(queryClient.getQueryState(queryKeys.scheduleRound())?.fetchStatus).toBe('idle')
  })

  it('오늘 강화가 더 늦으면 그 시각이다', async () => {
    queryClient.setQueryData(queryKeys.scheduleRound(), { receivedAt: ROUND_AT })
    queryClient.setQueryData(queryKeys.enhancementToday(), { fetchedAt: '2026-10-30T05:20:00.000Z' })

    const { result } = await renderHook(() => useRealtimeFetchedAt(), { wrapper })

    expect(result.current).toBe('2026-10-30T05:20:00.000Z')
  })
})
