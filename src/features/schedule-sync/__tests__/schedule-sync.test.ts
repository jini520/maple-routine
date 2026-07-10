import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount, MapleCharacter, SchedulerCharacterState } from '../../../types'
import { NexonAuthError, NexonNetworkError, NexonRateLimitError } from '../../../nexon/errors'

const { fetchCharacterListMock, fetchSchedulerCharacterStateMock } = vi.hoisted(() => ({
  fetchCharacterListMock: vi.fn(),
  fetchSchedulerCharacterStateMock: vi.fn(),
}))

const { getAuthConfigMock } = vi.hoisted(() => ({
  getAuthConfigMock: vi.fn(),
}))

const { getCachedSchedulerStateMock, setCachedSchedulerStateMock } = vi.hoisted(() => ({
  getCachedSchedulerStateMock: vi.fn(),
  setCachedSchedulerStateMock: vi.fn(),
}))

vi.mock('../../../nexon/character', () => ({
  fetchCharacterList: fetchCharacterListMock,
}))

vi.mock('../../../nexon/schedule', () => ({
  fetchSchedulerCharacterState: fetchSchedulerCharacterStateMock,
}))

vi.mock('../../../storage/api-key', () => ({
  getAuthConfig: getAuthConfigMock,
}))

vi.mock('../../../storage/scheduler-cache', () => ({
  getCachedSchedulerState: getCachedSchedulerStateMock,
  setCachedSchedulerState: setCachedSchedulerStateMock,
}))

import { getRegisteredCharacters, syncAllSchedules } from '../schedule-sync'

function character(ocid: string): MapleCharacter {
  return {
    ocid,
    name: `캐릭터-${ocid}`,
    world: '베라',
    jobClass: '렌',
    level: 200,
  }
}

function account(accountId: string, characters: MapleCharacter[]): MapleAccount {
  return { accountId, characters }
}

function schedulerState(characterName: string): SchedulerCharacterState {
  return {
    asOf: '2026-07-09T00:00+09:00',
    characterName,
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

const NOW = '2026-07-11T00:00:00.000Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: 'acc-1' })
  getCachedSchedulerStateMock.mockResolvedValue(null)
  setCachedSchedulerStateMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('getRegisteredCharacters', () => {
  it('API 키가 저장돼 있지 않으면 에러를 던진다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await expect(getRegisteredCharacters()).rejects.toThrow()
    expect(fetchCharacterListMock).not.toHaveBeenCalled()
  })

  it('선택된 계정이 없으면 에러를 던진다', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })

    await expect(getRegisteredCharacters()).rejects.toThrow()
    expect(fetchCharacterListMock).not.toHaveBeenCalled()
  })

  it('fetchCharacterList 응답에 선택된 계정이 없으면 에러를 던진다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('other-acc', [character('ocid-1')])])

    await expect(getRegisteredCharacters()).rejects.toThrow()
  })

  it('선택된 계정의 캐릭터 목록을 반환한다', async () => {
    const characters = [character('ocid-1'), character('ocid-2')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])

    await expect(getRegisteredCharacters()).resolves.toEqual(characters)
    expect(fetchCharacterListMock).toHaveBeenCalledWith('key-1')
  })
})

describe('syncAllSchedules', () => {
  it('모든 캐릭터가 성공하면 캐시를 갱신하고 isStale: false로 채워진 결과를 반환한다', async () => {
    const characters = [character('ocid-1'), character('ocid-2')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock
      .mockResolvedValueOnce(schedulerState('캐릭터1'))
      .mockResolvedValueOnce(schedulerState('캐릭터2'))

    const results = await syncAllSchedules()

    expect(results).toEqual([
      {
        ocid: 'ocid-1',
        characterName: '캐릭터-ocid-1',
        state: schedulerState('캐릭터1'),
        syncedAt: NOW,
        isStale: false,
        error: null,
      },
      {
        ocid: 'ocid-2',
        characterName: '캐릭터-ocid-2',
        state: schedulerState('캐릭터2'),
        syncedAt: NOW,
        isStale: false,
        error: null,
      },
    ])
    expect(setCachedSchedulerStateMock).toHaveBeenCalledWith('ocid-1', {
      state: schedulerState('캐릭터1'),
      syncedAt: NOW,
    })
    expect(setCachedSchedulerStateMock).toHaveBeenCalledWith('ocid-2', {
      state: schedulerState('캐릭터2'),
      syncedAt: NOW,
    })
  })

  it('캐릭터를 병렬이 아니라 순차적으로 호출한다', async () => {
    const characters = [character('ocid-1'), character('ocid-2'), character('ocid-3')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])

    const resolvers: Array<(state: SchedulerCharacterState) => void> = []
    fetchSchedulerCharacterStateMock.mockImplementation(
      () =>
        new Promise<SchedulerCharacterState>((resolve) => {
          resolvers.push(resolve)
        }),
    )

    const promise = syncAllSchedules()

    await vi.waitFor(() => expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(1))
    expect(resolvers).toHaveLength(1)
    resolvers[0](schedulerState('캐릭터1'))

    await vi.waitFor(() => expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(2))
    resolvers[1](schedulerState('캐릭터2'))

    await vi.waitFor(() => expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(3))
    resolvers[2](schedulerState('캐릭터3'))

    const results = await promise
    expect(results.map((r) => r.characterName)).toEqual(['캐릭터-ocid-1', '캐릭터-ocid-2', '캐릭터-ocid-3'])
  })

  it('네트워크 에러가 나고 캐시가 있으면 캐시 값으로 폴백하고 isStale: true, error: network를 채운다', async () => {
    const characters = [character('ocid-1')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock.mockRejectedValue(new NexonNetworkError('timeout'))
    getCachedSchedulerStateMock.mockResolvedValue({
      state: schedulerState('캐시된-캐릭터1'),
      syncedAt: '2026-07-10T00:00:00.000Z',
    })

    const results = await syncAllSchedules()

    expect(results).toEqual([
      {
        ocid: 'ocid-1',
        characterName: '캐릭터-ocid-1',
        state: schedulerState('캐시된-캐릭터1'),
        syncedAt: '2026-07-10T00:00:00.000Z',
        isStale: true,
        error: { kind: 'network' },
      },
    ])
    expect(setCachedSchedulerStateMock).not.toHaveBeenCalled()
  })

  it('네트워크 에러가 나고 캐시도 없으면 state/syncedAt이 null인 채로 isStale: true를 반환한다', async () => {
    const characters = [character('ocid-1')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock.mockRejectedValue(new NexonNetworkError('timeout'))
    getCachedSchedulerStateMock.mockResolvedValue(null)

    const results = await syncAllSchedules()

    expect(results).toEqual([
      {
        ocid: 'ocid-1',
        characterName: '캐릭터-ocid-1',
        state: null,
        syncedAt: null,
        isStale: true,
        error: { kind: 'network' },
      },
    ])
  })

  it('한 캐릭터의 네트워크 에러는 다른 캐릭터 조회를 막지 않는다', async () => {
    const characters = [character('ocid-1'), character('ocid-2')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock
      .mockRejectedValueOnce(new NexonNetworkError('timeout'))
      .mockResolvedValueOnce(schedulerState('캐릭터2'))

    const results = await syncAllSchedules()

    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(2)
    expect(results[0].error).toEqual({ kind: 'network' })
    expect(results[1]).toEqual({
      ocid: 'ocid-2',
      characterName: '캐릭터-ocid-2',
      state: schedulerState('캐릭터2'),
      syncedAt: NOW,
      isStale: false,
      error: null,
    })
  })

  it('첫 캐릭터에서 401(NexonAuthError)이 발생하면 이후 캐릭터는 API를 호출하지 않고 캐시 폴백만 한다', async () => {
    const characters = [character('ocid-1'), character('ocid-2'), character('ocid-3')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock.mockRejectedValueOnce(new NexonAuthError('invalid'))
    getCachedSchedulerStateMock.mockResolvedValue(null)

    const results = await syncAllSchedules()

    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(1)
    expect(getCachedSchedulerStateMock).toHaveBeenCalledTimes(3)
    for (const result of results) {
      expect(result.error).toEqual({ kind: 'invalidApiKey' })
      expect(result.isStale).toBe(true)
    }
  })

  it('첫 캐릭터에서 429(NexonRateLimitError)가 발생하면 이후 캐릭터는 API를 호출하지 않고 캐시 폴백만 한다', async () => {
    const characters = [character('ocid-1'), character('ocid-2')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock.mockRejectedValueOnce(new NexonRateLimitError('rate limited'))
    getCachedSchedulerStateMock.mockResolvedValue(null)

    const results = await syncAllSchedules()

    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(1)
    for (const result of results) {
      expect(result.error).toEqual({ kind: 'rateLimited' })
      expect(result.isStale).toBe(true)
    }
  })

  it('두 번째 캐릭터에서 401이 발생하면 첫 캐릭터는 정상 결과를 유지하고 세 번째 캐릭터는 API를 호출하지 않는다', async () => {
    const characters = [character('ocid-1'), character('ocid-2'), character('ocid-3')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock
      .mockResolvedValueOnce(schedulerState('캐릭터1'))
      .mockRejectedValueOnce(new NexonAuthError('invalid'))
    getCachedSchedulerStateMock.mockResolvedValue(null)

    const results = await syncAllSchedules()

    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(2)
    expect(results[0].isStale).toBe(false)
    expect(results[0].error).toBeNull()
    expect(results[1].error).toEqual({ kind: 'invalidApiKey' })
    expect(results[2].error).toEqual({ kind: 'invalidApiKey' })
    expect(results[2].isStale).toBe(true)
  })
})
