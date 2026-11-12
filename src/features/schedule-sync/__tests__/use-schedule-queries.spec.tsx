/**
 * `useScheduleQueries` · `useTrackedOcids` · `useCharacterProfiles`. 앱의 `queryClient` 를 그대로 `QueryClientProvider`
 * 에 넣어, 회차가 도는 동안과 끝난 뒤, 밖에서 캐릭터 열쇠를 넣었을 때 스냅샷이 어떻게 보이는지를 본다.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { NexonSignInRequiredError } from '../../../nexon/errors'
import type { CachedCharacterBasicEntry } from '../../../storage/character-basic-cache'
import type { CachedSchedulerEntry } from '../../../storage/scheduler-cache'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import { useResetBoundaryTick } from '../../query/reset-timer'
import type { CharacterScheduleSync } from '../schedule-sync'

jest.mock('../schedule-sync', () => ({ syncSchedules: jest.fn() }))
const { syncSchedules: syncSchedulesMock } = jest.requireMock('../schedule-sync') as Record<string, jest.Mock>

jest.mock('../stranded-characters', () => ({ resolveStrandedCharacters: jest.fn(async () => []) }))

jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
const { getTrackedCharacterOcids: getTrackedMock } = jest.requireMock('../../../storage/character-selection') as Record<
  string,
  jest.Mock
>

import { readScheduleSnapshot } from '../read-schedule'
import { useCharacterProfiles, useScheduleQueries, useTrackedOcids } from '../use-schedule-queries'

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function entry(characterName: string, syncedAt = '2026-10-30T05:00:00.000Z'): CachedSchedulerEntry {
  return { state: stateOf(characterName), syncedAt }
}

/** 진행이 비어 있는 상태. 화면에 넘기기 전에 지난 기간의 진행을 비우는 단계가 세 배열을 읽는다. */
function stateOf(characterName: string): CachedSchedulerEntry['state'] {
  return { characterName, dailyContents: [], weeklyContents: [], bossContents: [] } as unknown as CachedSchedulerEntry['state']
}

function synced(ocid: string, characterName: string): CharacterScheduleSync {
  return {
    ocid,
    characterName,
    state: stateOf(characterName),
    syncedAt: '2026-10-30T06:00:00.000Z',
    isStale: false,
    error: null,
  }
}

function basic(name: string): CachedCharacterBasicEntry {
  return { profile: { name, level: 200, imageUrl: '', accessFlag: true }, cachedAt: '2026-10-30T05:00:00.000Z' }
}

beforeEach(() => {
  queryClient.clear()
  getTrackedMock.mockReset().mockResolvedValue(null)
  syncSchedulesMock.mockReset().mockResolvedValue([])
})

describe('useTrackedOcids', () => {
  it('저장소를 읽기 전에는 null 이고 읽으면 그 목록이다', async () => {
    const tracked = deferred<string[] | null>()
    getTrackedMock.mockReturnValue(tracked.promise)

    const { result } = await renderHook(() => useTrackedOcids(), { wrapper })

    expect(result.current).toBeNull()

    await act(async () => {
      tracked.resolve(['a'])
    })

    await waitFor(() => expect(result.current).toEqual(['a']))
  })
})

describe('useScheduleQueries', () => {
  it('추적 목록을 읽기 전에는 trackedOcids 가 null 이고 ocids 가 빈 배열이다', async () => {
    const tracked = deferred<string[] | null>()
    getTrackedMock.mockReturnValue(tracked.promise)

    const { result } = await renderHook(() => useScheduleQueries(), { wrapper })

    expect(result.current.trackedOcids).toBeNull()
    expect(result.current.snapshot.ocids).toEqual([])

    await act(async () => {
      tracked.resolve(['a'])
    })

    await waitFor(() => expect(result.current.trackedOcids).toEqual(['a']))
    expect(result.current.snapshot.ocids).toEqual(['a'])
  })

  it('회차가 도는 동안 status 는 loading 이고 캐릭터 열쇠의 값은 그대로 보인다. 끝나면 loaded 다', async () => {
    queryClient.setQueryData(queryKeys.trackedOcids(), ['a'])
    queryClient.setQueryData(queryKeys.schedule('a'), entry('옛이름'))
    const round = deferred<CharacterScheduleSync[]>()
    syncSchedulesMock.mockReturnValue(round.promise)

    const { result } = await renderHook(() => useScheduleQueries(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('loading'))
    expect(result.current.snapshot.schedules.get('a')).toEqual(entry('옛이름'))
    expect(result.current.snapshot.round).toBeUndefined()

    await act(async () => {
      round.resolve([synced('a', '새이름')])
    })

    await waitFor(() => expect(result.current.status).toBe('loaded'))
    expect(result.current.snapshot.schedules.get('a')?.state.characterName).toBe('새이름')
    expect(result.current.snapshot.round?.outcomes.a).toEqual({
      isStale: false,
      syncedAt: '2026-10-30T06:00:00.000Z',
      error: null,
    })
    expect(result.current.error).toBeNull()
  })

  it('syncSchedules 가 던지면 status 는 error 이고 종류는 toScheduleSyncError 가 정한다', async () => {
    queryClient.setQueryData(queryKeys.trackedOcids(), ['a'])
    queryClient.setQueryData(queryKeys.schedule('a'), entry('캐릭터'))
    syncSchedulesMock.mockRejectedValue(new NexonSignInRequiredError('세션 만료'))

    const { result } = await renderHook(() => useScheduleQueries(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toEqual({ kind: 'signInRequired' })
    // 회차가 실패해도 캐릭터 열쇠의 값은 그대로다.
    expect(result.current.snapshot.schedules.get('a')).toEqual(entry('캐릭터'))
  })

  it('밖에서 schedule(ocid) 를 넣으면 스냅샷이 그 자리에서 바뀐다', async () => {
    queryClient.setQueryData(queryKeys.trackedOcids(), ['a', 'b'])

    const { result } = await renderHook(() => useScheduleQueries(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('loaded'))
    expect(result.current.snapshot.schedules.has('b')).toBe(false)

    await act(async () => {
      queryClient.setQueryData(queryKeys.schedule('b'), entry('비'))
    })

    await waitFor(() => expect(result.current.snapshot.schedules.get('b')).toEqual(entry('비')))
  })

  it('아무것도 바뀌지 않은 다시 렌더에서 스냅샷 참조가 같다', async () => {
    queryClient.setQueryData(queryKeys.trackedOcids(), ['a'])
    queryClient.setQueryData(queryKeys.schedule('a'), entry('캐릭터'))

    const { result, rerender } = await renderHook(() => useScheduleQueries(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('loaded'))
    const before = result.current.snapshot

    await rerender(undefined)

    expect(result.current.snapshot).toBe(before)
  })
})

describe('useCharacterProfiles', () => {
  it('캐시에 기본 정보가 있는 캐릭터만 들고, 넣으면 그 자리에서 바뀐다', async () => {
    queryClient.setQueryData(queryKeys.trackedOcids(), ['a', 'b'])
    queryClient.setQueryData(queryKeys.characterBasic('a'), basic('에이'))

    const { result } = await renderHook(() => useCharacterProfiles(), { wrapper })

    await waitFor(() => expect(Object.keys(result.current)).toEqual(['a']))
    expect(result.current.a.name).toBe('에이')

    await act(async () => {
      queryClient.setQueryData(queryKeys.characterBasic('b'), basic('비'))
    })

    await waitFor(() => expect(Object.keys(result.current)).toEqual(['a', 'b']))
    expect(result.current.b.name).toBe('비')
  })
})

describe('받은 뒤 초기화를 넘긴 캐시', () => {
  const NOT_FAKED = [
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask',
    'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'hrtime',
  ] as never
  const WEDNESDAY_NIGHT = '2026-11-11T23:50:00+09:00'
  const THURSDAY = new Date('2026-11-12T00:30:00+09:00')

  /** 수요일 밤에 받은, 스우를 잡은 캐시. */
  function lotusCleared(): CachedSchedulerEntry {
    return {
      syncedAt: new Date(WEDNESDAY_NIGHT).toISOString(),
      state: {
        ...stateOf('캐릭터'),
        bossContents: [
          { bossKey: 'lotus', apiName: '스우', difficulty: 'hard', cycle: 'weekly', isRegistered: true, isComplete: true, ownComplete: true },
        ],
      },
    }
  }

  function lotusOf(snapshot: { schedules: ReadonlyMap<string, CachedSchedulerEntry> }): boolean | undefined {
    return snapshot.schedules.get('a')?.state.bossContents[0]?.isComplete
  }

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: NOT_FAKED })
    queryClient.setQueryData(queryKeys.trackedOcids(), ['a'])
    queryClient.setQueryData(queryKeys.schedule('a'), lotusCleared())
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('수요일 밤에 받은 캐시를 목요일에 읽으면 훅과 readScheduleSnapshot 둘 다 주간 보스가 미완료다. 캐시는 그대로 둔다', async () => {
    jest.setSystemTime(THURSDAY)

    const { result } = await renderHook(() => useScheduleQueries(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('loaded'))

    expect(lotusOf(result.current.snapshot)).toBe(false)
    expect(lotusOf(readScheduleSnapshot())).toBe(false)
    // 다음 회차의 병합이 이 값을 이전 상태로 읽는다.
    expect(queryClient.getQueryData<CachedSchedulerEntry>(queryKeys.schedule('a'))?.state.bossContents[0].isComplete).toBe(true)
  })

  it('화면이 열린 채 목요일 0시의 틱이 오르면 훅이 다시 비운다', async () => {
    jest.setSystemTime(new Date('2026-11-11T23:55:00+09:00'))
    const { result } = await renderHook(() => useScheduleQueries(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('loaded'))
    expect(lotusOf(result.current.snapshot)).toBe(true)

    jest.setSystemTime(THURSDAY)
    await act(async () => {
      useResetBoundaryTick.setState((state) => ({ tick: state.tick + 1 }))
    })

    expect(lotusOf(result.current.snapshot)).toBe(false)
  })
})
