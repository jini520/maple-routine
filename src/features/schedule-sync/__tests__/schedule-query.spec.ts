import { focusManager } from '@tanstack/react-query'

import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import {
  onQueryCacheRestored,
  prefetchSchedules,
  refreshSchedules,
  refreshSchedulesInBackground,
  scheduleRoundOptions,
  subscribeScheduleRoundReceived,
  syncAddedCharacters,
  type ScheduleRoundResult,
} from '../schedule-query'
import type { CharacterScheduleSync } from '../schedule-sync'

jest.mock('../schedule-sync', () => ({ syncSchedules: jest.fn() }))
jest.mock('../../query/app-focus', () => ({ backgroundedAt: jest.fn(() => null), installAppStateFocus: jest.fn() }))
const { backgroundedAt: backgroundedAtMock } = jest.requireMock('../../query/app-focus') as Record<string, jest.Mock>
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

jest.mock('../../../storage/legacy-cleanup', () => ({
  runLegacyCleanupOnce: jest.fn(),
  readLegacyMesoRates: jest.fn(),
  readLegacyEventWorldNames: jest.fn(),
}))
const {
  runLegacyCleanupOnce: cleanupMock,
  readLegacyMesoRates: legacyRatesMock,
  readLegacyEventWorldNames: legacyNamesMock,
} = jest.requireMock('../../../storage/legacy-cleanup') as Record<string, jest.Mock>

jest.mock('../../boss-profit/round-record', () => ({ recordBossProfitFromRound: jest.fn(async () => undefined) }))
const { recordBossProfitFromRound: recordMock } = jest.requireMock('../../boss-profit/round-record') as Record<string, jest.Mock>
jest.mock('../../boss-profit/defeat-dates', () => ({ resolveDefeatDates: jest.fn(async () => 0) }))
const { resolveDefeatDates: defeatDatesMock } = jest.requireMock('../../boss-profit/defeat-dates') as Record<string, jest.Mock>

jest.mock('../../settlement/store', () => ({ readSettlementBeforeRound: jest.fn(async () => undefined) }))
const { readSettlementBeforeRound: settlementFirstMock } = jest.requireMock('../../settlement/store') as Record<string, jest.Mock>

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
  legacyRatesMock.mockResolvedValue(new Map())
  legacyNamesMock.mockResolvedValue(null)
})

afterEach(() => {
  jest.useRealTimers()
  focusManager.setFocused(undefined)
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

  // 0시 ~ 2시 당김은 결산 답을 먼저 받아야 회차가 처음부터 어제를 뺀다. 답을 기다리는 동안 회차가 먼저 나가면 안 된다.
  it('당김은 결산 답을 받은 뒤 회차를 시작한다', async () => {
    let answer: () => void = () => undefined
    settlementFirstMock.mockReturnValueOnce(new Promise<void>((done) => (answer = done)))
    syncSchedulesMock.mockResolvedValue([synced('a'), synced('b')])

    const pulling = refreshSchedules()
    await jest.advanceTimersByTimeAsync(0)
    expect(settlementFirstMock).toHaveBeenCalledWith(NOW)
    expect(syncSchedulesMock).not.toHaveBeenCalled()

    answer()
    await pulling
    expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
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
    expect(recordMock).toHaveBeenCalledWith(['a', 'b'], results, expect.any(Date), expect.any(Date))
    expect(defeatDatesMock).toHaveBeenCalledWith(['a', 'b'], expect.any(Date))
  })

  // 기록하는 시각의 기간과 견줄 시각이다. 넥슨이 답한 뒤나 기록 직전에 재면, 수요일 밤에 받은 완료가 목요일 기록이 된다.
  it('기록에 넥슨에 묻기 직전의 시각과 기록하는 시각을 함께 넘긴다', async () => {
    const before = new Date('2026-11-11T23:59:00+09:00')
    const after = new Date('2026-11-12T00:30:00+09:00')
    jest.setSystemTime(before)
    syncSchedulesMock.mockImplementation(async () => {
      jest.setSystemTime(after)
      return [synced('a')]
    })

    await prefetchSchedules()

    expect(recordMock).toHaveBeenCalledWith(['a', 'b'], [synced('a')], after, before)
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

// 회차가 넥슨에서 받을 때마다 서버 기록도 받는다. 받는 때를 따로 두면 새로고침 한 번에 넥슨 데이터만 최신이 된다.
describe('서버 동기화', () => {
  it('회차가 넥슨에서 받으면 받은 스케줄을 넣은 뒤 동기화를 깨우고, 회차는 동기화를 기다리지 않는다', async () => {
    syncSchedulesMock.mockResolvedValue([synced('a'), fallback('b')])
    const seen: unknown[] = []
    const stop = subscribeScheduleRoundReceived(() => {
      seen.push(queryClient.getQueryData(queryKeys.schedule('a')))
    })

    await refreshSchedules()
    stop()

    expect(seen).toEqual([{ state: { characterName: 'a' }, syncedAt: NOW.toISOString() }])
  })

  it('하나도 받지 못한 회차와 OS 가 깨운 배경 실행의 회차는 깨우지 않는다', async () => {
    const listener = jest.fn()
    const stop = subscribeScheduleRoundReceived(listener)

    syncSchedulesMock.mockResolvedValue([fallback('a'), fallback('b')])
    await refreshSchedules()
    syncSchedulesMock.mockResolvedValue([synced('a'), synced('b')])
    await refreshSchedulesInBackground()
    stop()
    await refreshSchedules()

    expect(syncSchedulesMock).toHaveBeenCalledTimes(3)
    expect(listener).not.toHaveBeenCalled()
  })
})

// iOS 는 앱이 배경에 가면 진행 중인 요청의 연결을 끊는다. 그 실패를 회차에 남기면 잠깐 나갔다 온 것만으로 `동기화 실패` 배지가 선다.
describe('배경에 가서 끊긴 회차', () => {
  const previousRound = async () => {
    syncSchedulesMock.mockResolvedValueOnce([synced('a'), synced('b')])
    await refreshSchedules()
    return queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())
  }
  /** 회차를 부른 뒤 배경에 간다. 부르는 동안 배경에 간 시각이 회차를 시작한 시각보다 늦다. */
  const leaveDuringRound = (results: CharacterScheduleSync[]) => {
    syncSchedulesMock.mockImplementationOnce(async () => {
      backgroundedAtMock.mockReturnValue(Date.now() + 1)
      return results
    })
  }

  beforeEach(() => {
    backgroundedAtMock.mockReturnValue(null)
  })
  afterEach(() => {
    syncSchedulesMock.mockReset()
    backgroundedAtMock.mockReturnValue(null)
  })

  it('앱이 아직 배경에 있을 때 끝나면 앞 회차의 결과를 그대로 둔다. 돌아오면 복귀 규칙이 새 회차를 돌린다', async () => {
    const previous = await previousRound()
    leaveDuringRound([synced('a'), fallback('b')])
    focusManager.setFocused(false)

    await refreshSchedules()

    expect(syncSchedulesMock).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())?.outcomes).toEqual(previous?.outcomes)
  })

  it('앱이 이미 돌아온 뒤에 끝나면 그 자리에서 회차를 한 번 더 돌려 그 결과를 남긴다', async () => {
    await previousRound()
    leaveDuringRound([synced('a'), fallback('b')])
    syncSchedulesMock.mockResolvedValueOnce([synced('a'), synced('b')])
    focusManager.setFocused(true)

    await refreshSchedules()

    expect(syncSchedulesMock).toHaveBeenCalledTimes(3)
    expect(queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())?.outcomes.b?.isStale).toBe(false)
  })

  // 다시 돌린 회차도 끊기면 또 돌리지 않는다. 배경을 오가는 동안 회차가 끝없이 돌지 않게 하려는 것이다.
  it('다시 돌린 회차도 끊기면 그 결과를 그대로 남긴다', async () => {
    await previousRound()
    leaveDuringRound([synced('a'), fallback('b')])
    leaveDuringRound([synced('a'), fallback('b')])
    focusManager.setFocused(true)

    await refreshSchedules()

    expect(syncSchedulesMock).toHaveBeenCalledTimes(3)
    expect(queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())?.outcomes.b?.error).toEqual({ kind: 'network' })
  })

  it('배경에 가지 않았거나 회차를 시작하기 전에 갔으면 네트워크 실패를 그대로 남긴다', async () => {
    await previousRound()
    focusManager.setFocused(true)
    for (const leftAt of [null, NOW.getTime() - 1]) {
      backgroundedAtMock.mockReturnValue(leftAt)
      syncSchedulesMock.mockResolvedValueOnce([synced('a'), fallback('b')])

      await refreshSchedules()

      expect(queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())?.outcomes.b?.error).toEqual({ kind: 'network' })
    }
    expect(syncSchedulesMock).toHaveBeenCalledTimes(3)
  })

  it('배경에 갔어도 네트워크가 아닌 실패는 그대로 남긴다', async () => {
    await previousRound()
    leaveDuringRound([synced('a'), { ...fallback('b'), error: { kind: 'rateLimited' } }])
    focusManager.setFocused(false)

    await refreshSchedules()

    expect(syncSchedulesMock).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())?.outcomes.b?.error).toEqual({ kind: 'rateLimited' })
  })

  // OS 가 깨운 배경 실행은 배경에서 시작한 회차다. 배경에 간 것 때문에 끊겼다고 볼 수 없다.
  it('OS 가 깨운 배경 실행의 회차는 끊긴 것으로 보지 않는다', async () => {
    await previousRound()
    leaveDuringRound([synced('a'), fallback('b')])
    focusManager.setFocused(false)

    await refreshSchedulesInBackground()

    expect(syncSchedulesMock).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())?.outcomes.b?.error).toEqual({ kind: 'network' })
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
    expect(recordMock).toHaveBeenLastCalledWith(['c'], [synced('c')], expect.any(Date), expect.any(Date))
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

  it('옛 메소 획득량과 이벤트 월드 이름을 쿼리에 심는다. 0 과 빈 배열도 값이다', async () => {
    legacyRatesMock.mockResolvedValue(new Map([['a', 149], ['b', 0]]))
    legacyNamesMock.mockResolvedValue([])

    await onQueryCacheRestored()

    expect(queryClient.getQueryData(queryKeys.mesoRate('a'))).toBe(149)
    expect(queryClient.getQueryData(queryKeys.mesoRate('b'))).toBe(0)
    expect(queryClient.getQueryData(queryKeys.eventWorldNames())).toEqual([])
  })

  // 앞 실행이 심은 뒤 지우다 실패했으면 쿼리에는 그 뒤 받은 새 값이 든다.
  it('쿼리에 든 메소 획득량과 이벤트 월드 이름은 덮지 않는다', async () => {
    queryClient.setQueryData(queryKeys.mesoRate('a'), 161)
    queryClient.setQueryData(queryKeys.eventWorldNames(), ['새이름'])
    legacyRatesMock.mockResolvedValue(new Map([['a', 149]]))
    legacyNamesMock.mockResolvedValue(['옛이름'])

    await onQueryCacheRestored()

    expect(queryClient.getQueryData(queryKeys.mesoRate('a'))).toBe(161)
    expect(queryClient.getQueryData(queryKeys.eventWorldNames())).toEqual(['새이름'])
  })

  it('옛 이벤트 월드 이름이 없으면 쿼리를 만들지 않는다. 없는 것과 빈 집합은 다르다', async () => {
    await onQueryCacheRestored()

    expect(queryClient.getQueryData(queryKeys.eventWorldNames())).toBeUndefined()
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

  it('앱을 켜면 신선해도 한 번 받는다', async () => {
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
