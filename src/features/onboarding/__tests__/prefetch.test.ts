import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterBasicProfile, MapleCharacter, SchedulerCharacterState } from '../../../types'
import { NexonAuthError, NexonNetworkError, NexonRateLimitError } from '../../../nexon/errors'

const { fetchCharacterBasicMock, fetchSchedulerCharacterStateMock } = vi.hoisted(() => ({
  fetchCharacterBasicMock: vi.fn(),
  fetchSchedulerCharacterStateMock: vi.fn(),
}))

const { setCachedCharacterBasicMock, setCachedSchedulerStateMock } = vi.hoisted(() => ({
  setCachedCharacterBasicMock: vi.fn(),
  setCachedSchedulerStateMock: vi.fn(),
}))

vi.mock('../../../nexon/character', () => ({
  fetchCharacterBasic: fetchCharacterBasicMock,
}))

vi.mock('../../../nexon/schedule', () => ({
  fetchSchedulerCharacterState: fetchSchedulerCharacterStateMock,
}))

vi.mock('../../../storage/character-basic-cache', () => ({
  setCachedCharacterBasic: setCachedCharacterBasicMock,
}))

vi.mock('../../../storage/scheduler-cache', () => ({
  setCachedSchedulerState: setCachedSchedulerStateMock,
}))

import { prefetchAccountData } from '../prefetch'

function character(ocid: string): MapleCharacter {
  return { ocid, name: `캐릭터-${ocid}`, world: '베라', jobClass: '렌', level: 200 }
}

function profile(overrides: Partial<CharacterBasicProfile> = {}): CharacterBasicProfile {
  return { name: '낟낟', level: 293, imageUrl: 'https://example.com/1.png', accessFlag: true, ...overrides }
}

function schedulerState(): SchedulerCharacterState {
  return {
    asOf: '2026-07-12T00:00+09:00',
    characterName: '낟낟',
    world: '엘리시움',
    level: 293,
    jobClass: '렌',
    dailyContents: [],
    weeklyContents: [],
    bossContents: [],
    weeklyBossClearCount: 0,
    weeklyBossClearLimitCount: 0,
  }
}

beforeEach(() => {
  setCachedCharacterBasicMock.mockResolvedValue(undefined)
  setCachedSchedulerStateMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('prefetchAccountData', () => {
  it('캐릭터가 없으면 아무 API도 호출하지 않고 progress {0,0}만 보고한다', async () => {
    const onProgress = vi.fn()
    await prefetchAccountData('key-1', [], onProgress)

    expect(fetchCharacterBasicMock).not.toHaveBeenCalled()
    expect(onProgress).toHaveBeenCalledWith({ completed: 0, total: 0 })
  })

  it('access_flag: true인 캐릭터는 basic+schedule 둘 다 조회하고 캐시에 기록한다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile({ accessFlag: true }))
    fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())

    const onProgress = vi.fn()
    await prefetchAccountData('key-1', [character('ocid-1')], onProgress)

    expect(fetchCharacterBasicMock).toHaveBeenCalledWith('key-1', 'ocid-1')
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledWith('key-1', 'ocid-1')
    expect(setCachedCharacterBasicMock).toHaveBeenCalledWith(
      'ocid-1',
      expect.objectContaining({ profile: profile({ accessFlag: true }) }),
    )
    expect(setCachedSchedulerStateMock).toHaveBeenCalledWith(
      'ocid-1',
      expect.objectContaining({ state: schedulerState() }),
    )
    const last = onProgress.mock.calls.at(-1)?.[0]
    expect(last).toEqual({ completed: 2, total: 2 })
  })

  it('access_flag: false인 캐릭터는 schedule을 조회하지 않고 total에서도 그만큼 뺀다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile({ accessFlag: false }))

    const onProgress = vi.fn()
    await prefetchAccountData('key-1', [character('ocid-1')], onProgress)

    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
    expect(setCachedSchedulerStateMock).not.toHaveBeenCalled()
    const last = onProgress.mock.calls.at(-1)?.[0]
    expect(last).toEqual({ completed: 1, total: 1 })
  })

  it('character/basic 조회가 실패하면 캐시 없이 넘어가고 schedule도 조회하지 않는다', async () => {
    fetchCharacterBasicMock.mockRejectedValue(new NexonNetworkError('timeout'))

    const onProgress = vi.fn()
    await prefetchAccountData('key-1', [character('ocid-1')], onProgress)

    expect(setCachedCharacterBasicMock).not.toHaveBeenCalled()
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
    const last = onProgress.mock.calls.at(-1)?.[0]
    expect(last).toEqual({ completed: 1, total: 1 })
  })

  it('scheduler 조회가 실패해도 그 캐릭터만 캐시 없이 넘어가고 진행은 계속된다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile({ accessFlag: true }))
    fetchSchedulerCharacterStateMock.mockRejectedValue(new NexonNetworkError('timeout'))

    const onProgress = vi.fn()
    await prefetchAccountData('key-1', [character('ocid-1')], onProgress)

    expect(setCachedSchedulerStateMock).not.toHaveBeenCalled()
    const last = onProgress.mock.calls.at(-1)?.[0]
    expect(last).toEqual({ completed: 2, total: 2 })
  })

  it('401/429 같은 전역성 에러가 나도 그 캐릭터만 실패로 넘어가고 예외를 던지지 않는다', async () => {
    fetchCharacterBasicMock
      .mockRejectedValueOnce(new NexonAuthError('invalid'))
      .mockResolvedValueOnce(profile({ accessFlag: true }))
    fetchSchedulerCharacterStateMock.mockRejectedValue(new NexonRateLimitError('rate limited'))

    const onProgress = vi.fn()
    await expect(
      prefetchAccountData('key-1', [character('ocid-1'), character('ocid-2')], onProgress),
    ).resolves.toBeUndefined()
  })

  it('여러 캐릭터를 Promise.all로 뭉쳐 기다리지 않고 각자 끝나는 대로 진행률을 갱신한다', async () => {
    const resolvers: Array<(profile: CharacterBasicProfile) => void> = []
    fetchCharacterBasicMock.mockImplementation(
      () =>
        new Promise<CharacterBasicProfile>((resolve) => {
          resolvers.push(resolve)
        }),
    )
    fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())

    const onProgress = vi.fn()
    const promise = prefetchAccountData(
      'key-1',
      [character('ocid-1'), character('ocid-2'), character('ocid-3')],
      onProgress,
    )

    await vi.waitFor(() => expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(3))

    resolvers[0](profile({ accessFlag: false }))
    await vi.waitFor(() =>
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ completed: 1 })),
    )

    resolvers[1](profile({ accessFlag: false }))
    resolvers[2](profile({ accessFlag: false }))
    await promise

    const last = onProgress.mock.calls.at(-1)?.[0]
    expect(last).toEqual({ completed: 3, total: 3 })
  })
})
