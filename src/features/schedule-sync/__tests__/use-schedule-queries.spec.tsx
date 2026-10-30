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
import type { CharacterScheduleSync } from '../schedule-sync'

jest.mock('../schedule-sync', () => ({ syncSchedules: jest.fn() }))
const { syncSchedules: syncSchedulesMock } = jest.requireMock('../schedule-sync') as Record<string, jest.Mock>

jest.mock('../stranded-characters', () => ({ resolveStrandedCharacters: jest.fn(async () => []) }))

jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
const { getTrackedCharacterOcids: getTrackedMock } = jest.requireMock('../../../storage/character-selection') as Record<
  string,
  jest.Mock
>

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
  return { state: { characterName } as CachedSchedulerEntry['state'], syncedAt }
}

function synced(ocid: string, characterName: string): CharacterScheduleSync {
  return {
    ocid,
    characterName,
    state: { characterName } as CharacterScheduleSync['state'],
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
