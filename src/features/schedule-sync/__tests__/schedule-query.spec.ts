import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import {
  onQueryCacheRestored,
  prefetchSchedules,
  refreshSchedules,
  scheduleRoundOptions,
  syncAddedCharacters,
  type ScheduleRoundResult,
} from '../schedule-query'
import type { CharacterScheduleSync } from '../schedule-sync'

jest.mock('../schedule-sync', () => ({ syncSchedules: jest.fn() }))
const { syncSchedules: syncSchedulesMock } = jest.requireMock('../schedule-sync') as Record<string, jest.Mock>

jest.mock('../stranded-characters', () => ({ resolveStrandedCharacters: jest.fn(async () => []) }))
const { resolveStrandedCharacters: strandedMock } = jest.requireMock('../stranded-characters') as Record<string, jest.Mock>

jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
const { getTrackedCharacterOcids: trackedMock } = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>

jest.mock('../../../storage/scheduler-cache', () => ({ getCachedSchedulerState: jest.fn(async () => null) }))
const { getCachedSchedulerState: legacyScheduleMock } = jest.requireMock('../../../storage/scheduler-cache') as Record<string, jest.Mock>

jest.mock('../../../storage/character-basic-cache', () => ({ getCachedCharacterBasic: jest.fn(async () => null) }))

const NOW = new Date('2026-10-30T05:00:00.000Z')

function synced(ocid: string, syncedAt = NOW.toISOString()): CharacterScheduleSync {
  return {
    ocid,
    characterName: ocid,
    state: { characterName: ocid } as never,
    syncedAt,
    isStale: false,
    error: null,
  }
}

function fallback(ocid: string): CharacterScheduleSync {
  return { ocid, characterName: ocid, state: null, syncedAt: null, isStale: true, error: { kind: 'network' } }
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
  queryClient.clear()
  jest.clearAllMocks()
  trackedMock.mockResolvedValue(['a', 'b'])
  strandedMock.mockResolvedValue([])
})

afterEach(() => {
  jest.useRealTimers()
})

describe('scheduleRound', () => {
  it('회차 하나가 캐릭터 열쇠를 다 채우고, 캐시로 채운 캐릭터는 든 값을 안 덮는다', async () => {
    queryClient.setQueryData(queryKeys.schedule('b'), { state: { characterName: 'old-b' }, syncedAt: '2026-10-29T00:00:00.000Z' })
    syncSchedulesMock.mockResolvedValue([synced('a'), fallback('b')])

    await prefetchSchedules()

    expect(syncSchedulesMock).toHaveBeenCalledWith(['a', 'b'])
    expect(queryClient.getQueryData(queryKeys.schedule('a'))).toEqual({ state: { characterName: 'a' }, syncedAt: NOW.toISOString() })
    expect(queryClient.getQueryData(queryKeys.schedule('b'))).toEqual({ state: { characterName: 'old-b' }, syncedAt: '2026-10-29T00:00:00.000Z' })
    const round = queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())
    expect(round?.ocids).toEqual(['a', 'b'])
    expect(round?.outcomes.b).toEqual({ isStale: true, syncedAt: null, error: { kind: 'network' } })
  })

  it('신선하면 자동 진입은 안 받고 당김은 받는다', async () => {
    syncSchedulesMock.mockResolvedValue([synced('a'), synced('b')])
    await prefetchSchedules()
    await prefetchSchedules()
    expect(syncSchedulesMock).toHaveBeenCalledTimes(1)

    await refreshSchedules()
    expect(syncSchedulesMock).toHaveBeenCalledTimes(2)
  })

  it('추적 목록에 회차가 덮지 않은 캐릭터가 생기면 자동 진입도 받는다', async () => {
    syncSchedulesMock.mockResolvedValue([synced('a'), synced('b')])
    await prefetchSchedules()

    queryClient.setQueryData(queryKeys.trackedOcids(), ['a', 'b', 'c'])
    syncSchedulesMock.mockResolvedValue([synced('a'), synced('b'), synced('c')])
    await prefetchSchedules()

    expect(syncSchedulesMock).toHaveBeenCalledTimes(2)
    expect(syncSchedulesMock).toHaveBeenLastCalledWith(['a', 'b', 'c'])
  })

  it('회차가 던지면 쿼리는 실패로 남고 캐릭터 열쇠는 그대로다. 당김은 던지지 않는다', async () => {
    syncSchedulesMock.mockResolvedValue([synced('a'), synced('b')])
    await prefetchSchedules()
    syncSchedulesMock.mockRejectedValue(new Error('키 없음'))

    await expect(refreshSchedules()).resolves.toBeUndefined()

    expect(queryClient.getQueryState(queryKeys.scheduleRound())?.status).toBe('error')
    expect(queryClient.getQueryData(queryKeys.schedule('a'))).toEqual({ state: { characterName: 'a' }, syncedAt: NOW.toISOString() })
  })
})

describe('syncAddedCharacters', () => {
  it('새 캐릭터만 받아 넣고 회차가 덮은 목록에 더한다', async () => {
    syncSchedulesMock.mockResolvedValue([synced('a'), synced('b')])
    await prefetchSchedules()
    syncSchedulesMock.mockResolvedValue([synced('c')])

    await syncAddedCharacters(['c'])

    expect(syncSchedulesMock).toHaveBeenLastCalledWith(['c'], undefined)
    const round = queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())
    expect(round?.ocids).toEqual(['a', 'b', 'c'])
    expect(round?.outcomes.c?.isStale).toBe(false)
    // 더한 목록이 추적 목록을 덮으므로 다음 자동 진입은 안 받는다.
    queryClient.setQueryData(queryKeys.trackedOcids(), ['a', 'b', 'c'])
    await prefetchSchedules()
    expect(syncSchedulesMock).toHaveBeenCalledTimes(2)
  })
})

describe('onQueryCacheRestored', () => {
  it('옛 Preferences 캐시를 쿼리에 없는 캐릭터만 옮기고, 회차를 만료로 표시한다', async () => {
    queryClient.setQueryData(queryKeys.schedule('a'), { state: { characterName: 'query-a' }, syncedAt: NOW.toISOString() })
    legacyScheduleMock.mockImplementation(async (ocid: string) => ({
      state: { characterName: `legacy-${ocid}` },
      syncedAt: '2026-10-29T00:00:00.000Z',
    }))

    await onQueryCacheRestored()

    expect(queryClient.getQueryData(queryKeys.schedule('a'))).toEqual({ state: { characterName: 'query-a' }, syncedAt: NOW.toISOString() })
    expect(queryClient.getQueryData(queryKeys.schedule('b'))).toEqual({ state: { characterName: 'legacy-b' }, syncedAt: '2026-10-29T00:00:00.000Z' })
    expect(queryClient.getQueryState(queryKeys.schedule('b'))?.dataUpdatedAt).toBe(new Date('2026-10-29T00:00:00.000Z').getTime())
  })

  it('앱을 켜면 10분 안이어도 한 번 받는다', async () => {
    syncSchedulesMock.mockResolvedValue([synced('a'), synced('b')])
    await prefetchSchedules()
    await prefetchSchedules()
    expect(syncSchedulesMock).toHaveBeenCalledTimes(1)

    await onQueryCacheRestored()
    await prefetchSchedules()
    expect(syncSchedulesMock).toHaveBeenCalledTimes(2)
  })
})

describe('scheduleRoundOptions', () => {
  it('넥슨 쿼리라 저장하고 초기화 시각에 무효화되며 복귀마다 받는다', () => {
    expect(scheduleRoundOptions.meta).toEqual({ persist: true, source: 'nexon' })
    expect(scheduleRoundOptions.refetchOnWindowFocus).toBe('always')
  })
})
