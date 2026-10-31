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

jest.mock('../../../storage/scheduler-cache', () => ({
  getCachedSchedulerState: jest.fn(async () => null),
  clearCachedSchedulerState: jest.fn(async () => undefined),
}))
const { getCachedSchedulerState: legacyScheduleMock, clearCachedSchedulerState: clearScheduleMock } = jest.requireMock(
  '../../../storage/scheduler-cache',
) as Record<string, jest.Mock>

jest.mock('../../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: jest.fn(async () => null),
  clearCachedCharacterBasic: jest.fn(async () => undefined),
}))
const { clearCachedCharacterBasic: clearBasicMock } = jest.requireMock('../../../storage/character-basic-cache') as Record<
  string,
  jest.Mock
>

jest.mock('../../../storage/legacy-cleanup', () => ({ runLegacyCleanupOnce: jest.fn() }))
const { runLegacyCleanupOnce: cleanupMock } = jest.requireMock('../../../storage/legacy-cleanup') as Record<string, jest.Mock>

jest.mock('../../boss-profit/round-record', () => ({ recordBossProfitFromRound: jest.fn(async () => undefined) }))
const { recordBossProfitFromRound: recordMock } = jest.requireMock('../../boss-profit/round-record') as Record<string, jest.Mock>
jest.mock('../../boss-profit/defeat-dates', () => ({ resolveDefeatDates: jest.fn(async () => 0) }))
const { resolveDefeatDates: defeatDatesMock } = jest.requireMock('../../boss-profit/defeat-dates') as Record<string, jest.Mock>

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
  recordMock.mockResolvedValue(undefined)
  defeatDatesMock.mockResolvedValue(0)
  cleanupMock.mockImplementation(async (seed: () => Promise<void>) => seed())
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

  // 없는 기록은 날짜를 캘 수 없다. 그래서 동기화 → 기록 → 날짜 순이다.
  it('동기화 뒤에 보스 수익을 기록하고 그다음 처치 날짜를 캔다', async () => {
    const order: string[] = []
    const results = [synced('a'), fallback('b')]
    syncSchedulesMock.mockImplementation(async () => {
      order.push('sync')
      return results
    })
    recordMock.mockImplementation(async () => void order.push('record'))
    defeatDatesMock.mockImplementation(async () => {
      order.push('dates')
      return 0
    })

    await prefetchSchedules()

    expect(order).toEqual(['sync', 'record', 'dates'])
    expect(recordMock).toHaveBeenCalledWith(['a', 'b'], results, expect.any(Date))
    expect(defeatDatesMock).toHaveBeenCalledWith(['a', 'b'], expect.any(Date))
  })

  it('기록이나 날짜 캐기가 던져도 회차는 선다. 받은 스케줄은 이미 캐시에 들었다', async () => {
    syncSchedulesMock.mockResolvedValue([synced('a'), synced('b')])
    recordMock.mockRejectedValue(new Error('sqlite'))
    defeatDatesMock.mockRejectedValue(new Error('network'))

    await prefetchSchedules()

    expect(queryClient.getQueryState(queryKeys.scheduleRound())?.status).toBe('success')
    expect(defeatDatesMock).toHaveBeenCalled()
  })

  // 401 · 429 · 점검이면 전원이 캐시로 채워진다. 그 회차도 쿼리는 성공이라 머리 시각이 거기서 오르면 안 받은 것을 받은 것처럼 말한다.
  it('실제로 받은 시각만 `receivedAt` 에 들고, 전원 캐시 폴백이면 이전 값을 지킨다', async () => {
    syncSchedulesMock.mockResolvedValue([synced('a', '2026-10-30T04:00:00.000Z'), synced('b', '2026-10-30T04:30:00.000Z')])
    await prefetchSchedules()
    expect(queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())?.receivedAt).toBe('2026-10-30T04:30:00.000Z')

    syncSchedulesMock.mockResolvedValue([fallback('a'), fallback('b')])
    await refreshSchedules()
    expect(queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())?.receivedAt).toBe('2026-10-30T04:30:00.000Z')
  })

  it('추적이 없으면 기록도 날짜도 안 부른다', async () => {
    trackedMock.mockResolvedValue([])

    await prefetchSchedules()

    expect(recordMock).not.toHaveBeenCalled()
    expect(defeatDatesMock).not.toHaveBeenCalled()
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
    // 새 캐릭터의 완료도 그 자리에서 기록한다.
    expect(recordMock).toHaveBeenLastCalledWith(['c'], [synced('c')], expect.any(Date))
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

  // 옮긴 뒤에는 아무도 안 읽는다. 남겨 두면 Preferences 에 큰 JSON 이 캐릭터 수만큼 영영 남는다.
  it('옛 캐시를 옮긴 뒤 그 키를 지운다', async () => {
    await onQueryCacheRestored()

    expect(clearScheduleMock.mock.calls.map(([ocid]) => ocid).sort()).toEqual(['a', 'b'])
    expect(clearBasicMock.mock.calls.map(([ocid]) => ocid).sort()).toEqual(['a', 'b'])
  })

  // 지우기를 삼키면 표식이 남아 그 키를 지울 기회가 다시 안 온다.
  it('옛 키를 못 지우면 정리가 던진다', async () => {
    clearScheduleMock.mockRejectedValueOnce(new Error('지우기 실패'))
    let thrown: unknown = null
    cleanupMock.mockImplementation(async (seed: () => Promise<void>) => {
      thrown = await seed().catch((error: unknown) => error)
    })

    await onQueryCacheRestored()

    expect(thrown).toEqual(new Error('지우기 실패'))
  })

  it('표식이 있어 정리가 안 돌면 옛 캐시를 읽지 않아도 회차를 만료로 표시한다', async () => {
    cleanupMock.mockImplementation(async () => undefined)
    syncSchedulesMock.mockResolvedValue([synced('a'), synced('b')])
    await prefetchSchedules()

    await onQueryCacheRestored()

    expect(legacyScheduleMock).not.toHaveBeenCalled()
    expect(queryClient.getQueryState(queryKeys.scheduleRound())?.isInvalidated).toBe(true)
  })

  it('정리가 던져도 회차를 만료로 표시한다', async () => {
    cleanupMock.mockRejectedValue(new Error('정리 실패'))
    syncSchedulesMock.mockResolvedValue([synced('a'), synced('b')])
    await prefetchSchedules()

    await expect(onQueryCacheRestored()).resolves.toBeUndefined()

    expect(queryClient.getQueryState(queryKeys.scheduleRound())?.isInvalidated).toBe(true)
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
