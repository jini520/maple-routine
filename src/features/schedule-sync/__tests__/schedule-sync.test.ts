import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount, MapleCharacter, SchedulerCharacterState } from '../../../types'
import { NexonAuthError, NexonNetworkError, NexonRateLimitError } from '../../../nexon/errors'

const { fetchCharacterListMock, fetchCharacterBasicMock, fetchSchedulerCharacterStateMock } = vi.hoisted(() => ({
  fetchCharacterListMock: vi.fn(),
  fetchCharacterBasicMock: vi.fn(),
  fetchSchedulerCharacterStateMock: vi.fn(),
}))

const { getAuthConfigMock } = vi.hoisted(() => ({
  getAuthConfigMock: vi.fn(),
}))

const { getCachedSchedulerStateMock, setCachedSchedulerStateMock } = vi.hoisted(() => ({
  getCachedSchedulerStateMock: vi.fn(),
  setCachedSchedulerStateMock: vi.fn(),
}))

const { getCachedCharacterBasicMock, setCachedCharacterBasicMock, getAllCachedCharacterBasicOcidsMock } =
  vi.hoisted(() => ({
    getCachedCharacterBasicMock: vi.fn(),
    setCachedCharacterBasicMock: vi.fn(),
    getAllCachedCharacterBasicOcidsMock: vi.fn(),
  }))

vi.mock('../../../nexon/character', () => ({
  fetchCharacterList: fetchCharacterListMock,
  fetchCharacterBasic: fetchCharacterBasicMock,
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

vi.mock('../../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: getCachedCharacterBasicMock,
  setCachedCharacterBasic: setCachedCharacterBasicMock,
  getAllCachedCharacterBasicOcids: getAllCachedCharacterBasicOcidsMock,
}))

import { getCharacterPickerRoster, getRegisteredCharacters, syncSchedules } from '../schedule-sync'

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

function basicProfile(overrides: { name: string; level: number; imageUrl?: string }): {
  name: string
  level: number
  imageUrl: string
  accessFlag: boolean
} {
  return {
    name: overrides.name,
    level: overrides.level,
    imageUrl: overrides.imageUrl ?? `https://open.api.nexon.com/static/maplestory/character/look/${overrides.name}`,
    accessFlag: true,
  }
}

const NOW = '2026-07-11T00:00:00.000Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: 'acc-1' })
  getCachedSchedulerStateMock.mockResolvedValue(null)
  setCachedSchedulerStateMock.mockResolvedValue(undefined)
  getCachedCharacterBasicMock.mockResolvedValue(null)
  setCachedCharacterBasicMock.mockResolvedValue(undefined)
  getAllCachedCharacterBasicOcidsMock.mockResolvedValue([])
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

describe('syncSchedules', () => {
  it('ocids가 빈 배열이면 fetchCharacterList를 호출하지 않고 빈 배열을 반환한다', async () => {
    const results = await syncSchedules([])

    expect(results).toEqual([])
    expect(fetchCharacterListMock).not.toHaveBeenCalled()
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
  })

  it('계정에 캐릭터가 5명 있어도 ocids로 지정한 2명에 대해서만 스케줄 API를 호출한다', async () => {
    const characters = [
      character('ocid-1'),
      character('ocid-2'),
      character('ocid-3'),
      character('ocid-4'),
      character('ocid-5'),
    ]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock
      .mockResolvedValueOnce(schedulerState('캐릭터2'))
      .mockResolvedValueOnce(schedulerState('캐릭터4'))

    const results = await syncSchedules(['ocid-2', 'ocid-4'])

    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(2)
    expect(fetchSchedulerCharacterStateMock).toHaveBeenNthCalledWith(1, 'key-1', 'ocid-2')
    expect(fetchSchedulerCharacterStateMock).toHaveBeenNthCalledWith(2, 'key-1', 'ocid-4')
    expect(results.map((r) => r.ocid)).toEqual(['ocid-2', 'ocid-4'])
  })

  it('ocids에 있지만 실제 계정 캐릭터 목록에는 없는 ocid는 조용히 결과에서 빠진다', async () => {
    const characters = [character('ocid-1'), character('ocid-2')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock.mockResolvedValueOnce(schedulerState('캐릭터1'))

    const results = await syncSchedules(['ocid-1', 'ocid-does-not-exist'])

    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(1)
    expect(results.map((r) => r.ocid)).toEqual(['ocid-1'])
  })

  it('모든 캐릭터가 성공하면 캐시를 갱신하고 isStale: false로 채워진 결과를 반환한다', async () => {
    const characters = [character('ocid-1'), character('ocid-2')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock
      .mockResolvedValueOnce(schedulerState('캐릭터1'))
      .mockResolvedValueOnce(schedulerState('캐릭터2'))

    const results = await syncSchedules(['ocid-1', 'ocid-2'])

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

    const promise = syncSchedules(['ocid-1', 'ocid-2', 'ocid-3'])

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

    const results = await syncSchedules(['ocid-1'])

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

    const results = await syncSchedules(['ocid-1'])

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

    const results = await syncSchedules(['ocid-1', 'ocid-2'])

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

    const results = await syncSchedules(['ocid-1', 'ocid-2', 'ocid-3'])

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

    const results = await syncSchedules(['ocid-1', 'ocid-2'])

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

    const results = await syncSchedules(['ocid-1', 'ocid-2', 'ocid-3'])

    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(2)
    expect(results[0].isStale).toBe(false)
    expect(results[0].error).toBeNull()
    expect(results[1].error).toEqual({ kind: 'invalidApiKey' })
    expect(results[2].error).toEqual({ kind: 'invalidApiKey' })
    expect(results[2].isStale).toBe(true)
  })
})

describe('getCharacterPickerRoster (ADR-016: 캐시 우선 + 스트리밍 갱신)', () => {
  describe('ADR-017 결정 6: 캐싱된 전체 캐릭터 stub으로 character/list 대기 중에도 즉시 표시', () => {
    it('character-basic-cache 인덱스에 캐시가 있으면 character/list 응답 전에 stub 목록으로 먼저 onUpdate한다', async () => {
      fetchCharacterListMock.mockImplementation(() => new Promise(() => {})) // 절대 resolve 안 함
      getAllCachedCharacterBasicOcidsMock.mockResolvedValue(['ocid-1'])
      getCachedCharacterBasicMock.mockImplementation(async (ocid: string) =>
        ocid === 'ocid-1'
          ? { profile: basicProfile({ name: '캐싱된캐릭', level: 180 }), cachedAt: '2026-07-11T00:00:00.000Z' }
          : null,
      )

      const onUpdate = vi.fn()
      void getCharacterPickerRoster(onUpdate)

      await vi.waitFor(() => expect(onUpdate).toHaveBeenCalled())
      expect(onUpdate).toHaveBeenCalledWith([
        { ocid: 'ocid-1', name: '캐싱된캐릭', level: 180, imageUrl: basicProfile({ name: '캐싱된캐릭', level: 180 }).imageUrl },
      ])
      expect(fetchCharacterListMock).toHaveBeenCalled()
    })

    it('추적 여부와 무관하게 인덱스에 있는 모든 ocid가 stub 목록에 포함된다', async () => {
      fetchCharacterListMock.mockImplementation(() => new Promise(() => {}))
      getAllCachedCharacterBasicOcidsMock.mockResolvedValue(['ocid-1', 'ocid-2'])
      getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
        profile: basicProfile({ name: `캐릭-${ocid}`, level: 100 }),
        cachedAt: '2026-07-11T00:00:00.000Z',
      }))

      const onUpdate = vi.fn()
      void getCharacterPickerRoster(onUpdate)

      await vi.waitFor(() => expect(onUpdate).toHaveBeenCalled())
      const stub = onUpdate.mock.calls[0][0] as Array<{ ocid: string }>
      expect(stub.map((entry) => entry.ocid).sort()).toEqual(['ocid-1', 'ocid-2'])
    })

    it('인덱스상 캐시된 캐릭터의 access_flag가 false면 stub 목록에서 제외된다', async () => {
      fetchCharacterListMock.mockImplementation(() => new Promise(() => {}))
      getAllCachedCharacterBasicOcidsMock.mockResolvedValue(['ocid-1'])
      getCachedCharacterBasicMock.mockResolvedValue({
        profile: { ...basicProfile({ name: '비공개', level: 999 }), accessFlag: false },
        cachedAt: '2026-07-11T00:00:00.000Z',
      })

      const onUpdate = vi.fn()
      void getCharacterPickerRoster(onUpdate)

      await vi.waitFor(() => expect(getCachedCharacterBasicMock).toHaveBeenCalled())
      expect(onUpdate).not.toHaveBeenCalled()
    })

    it('인덱스가 비어있으면 stub 단계에서 onUpdate를 호출하지 않고 곧바로 character/list를 기다린다', async () => {
      fetchCharacterListMock.mockResolvedValue([account('acc-1', [])])
      getAllCachedCharacterBasicOcidsMock.mockResolvedValue([])

      await getCharacterPickerRoster(vi.fn())

      expect(getCachedCharacterBasicMock).not.toHaveBeenCalled()
    })

    it('character/list 응답이 도착하면 stub 목록이 계정 전체 후보 목록으로 교체된다', async () => {
      const characters = [character('ocid-1'), character('ocid-2')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      getAllCachedCharacterBasicOcidsMock.mockResolvedValue(['ocid-1'])
      getCachedCharacterBasicMock.mockImplementation(async (ocid: string) =>
        ocid === 'ocid-1'
          ? { profile: basicProfile({ name: '캐싱된캐릭', level: 180 }), cachedAt: '2026-07-11T00:00:00.000Z' }
          : null,
      )
      fetchCharacterBasicMock.mockImplementation(() => new Promise(() => {}))

      const onUpdate = vi.fn()
      void getCharacterPickerRoster(onUpdate)

      await vi.waitFor(() => expect(onUpdate.mock.calls.length).toBeGreaterThanOrEqual(2))
      const afterCharacterList = onUpdate.mock.calls.at(-1)?.[0] as Array<{ ocid: string }>
      expect(afterCharacterList.map((entry) => entry.ocid).sort()).toEqual(['ocid-1', 'ocid-2'])
    })
  })

  it('계정에 캐릭터가 없으면 character/basic을 호출하지 않고 onUpdate([])를 한 번 호출한다', async () => {
    fetchCharacterListMock.mockResolvedValue([account('acc-1', [])])
    const onUpdate = vi.fn()

    await getCharacterPickerRoster(onUpdate)

    expect(onUpdate).toHaveBeenCalledWith([])
    expect(fetchCharacterBasicMock).not.toHaveBeenCalled()
  })

  it('캐시된 캐릭터는 character/basic 응답을 기다리지 않고 첫 onUpdate에 즉시 포함된다', async () => {
    const characters = [character('ocid-1')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    getCachedCharacterBasicMock.mockResolvedValue({
      profile: basicProfile({ name: '캐시캐릭', level: 150 }),
      cachedAt: '2026-07-11T00:00:00.000Z',
    })
    fetchCharacterBasicMock.mockImplementation(() => new Promise(() => {})) // 절대 resolve 안 함

    const onUpdate = vi.fn()
    void getCharacterPickerRoster(onUpdate)

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalled())
    expect(onUpdate.mock.calls[0][0]).toEqual([
      { ocid: 'ocid-1', name: '캐시캐릭', level: 150, imageUrl: basicProfile({ name: '캐시캐릭', level: 150 }).imageUrl, world: '베라' },
    ])
  })

  it('캐시가 없는 캐릭터는 character/list의 이름/레벨로 imageUrl: null인 채 첫 onUpdate에 포함된다', async () => {
    const characters = [character('ocid-1')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    getCachedCharacterBasicMock.mockResolvedValue(null)
    fetchCharacterBasicMock.mockImplementation(() => new Promise(() => {}))

    const onUpdate = vi.fn()
    void getCharacterPickerRoster(onUpdate)

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalled())
    expect(onUpdate.mock.calls[0][0]).toEqual([
      { ocid: 'ocid-1', name: '캐릭터-ocid-1', level: 200, imageUrl: null, world: '베라' },
    ])
  })

  it('캐시상 access_flag가 false인 캐릭터는 첫 onUpdate에서부터 제외된다', async () => {
    const characters = [character('ocid-1')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    getCachedCharacterBasicMock.mockResolvedValue({
      profile: { ...basicProfile({ name: '비공개', level: 999 }), accessFlag: false },
      cachedAt: '2026-07-11T00:00:00.000Z',
    })
    fetchCharacterBasicMock.mockImplementation(() => new Promise(() => {}))

    const onUpdate = vi.fn()
    void getCharacterPickerRoster(onUpdate)

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalled())
    expect(onUpdate.mock.calls[0][0]).toEqual([])
  })

  it('character/basic 응답이 도착하면 값을 갱신하고 캐시에 기록한다', async () => {
    const characters = [character('ocid-1')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchCharacterBasicMock.mockResolvedValue(basicProfile({ name: '최신캐릭', level: 293 }))

    const onUpdate = vi.fn()
    await getCharacterPickerRoster(onUpdate)

    const last = onUpdate.mock.calls.at(-1)?.[0]
    expect(last).toEqual([
      { ocid: 'ocid-1', name: '최신캐릭', level: 293, imageUrl: basicProfile({ name: '최신캐릭', level: 293 }).imageUrl, world: '베라' },
    ])
    expect(setCachedCharacterBasicMock).toHaveBeenCalledWith(
      'ocid-1',
      expect.objectContaining({ profile: basicProfile({ name: '최신캐릭', level: 293 }) }),
    )
  })

  it('character/basic 응답이 access_flag: false면 이후 목록에서 제외된다', async () => {
    const characters = [character('ocid-1')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchCharacterBasicMock.mockResolvedValue({ ...basicProfile({ name: '숨김', level: 100 }), accessFlag: false })

    const onUpdate = vi.fn()
    await getCharacterPickerRoster(onUpdate)

    const last = onUpdate.mock.calls.at(-1)?.[0]
    expect(last).toEqual([])
  })

  it('character/basic을 Promise.all로 뭉치지 않고 하나씩 끝나는 대로 onUpdate한다', async () => {
    const characters = [character('ocid-1'), character('ocid-2'), character('ocid-3')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    const resolvers: Array<(profile: ReturnType<typeof basicProfile>) => void> = []
    fetchCharacterBasicMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve)
        }),
    )

    const onUpdate = vi.fn()
    const promise = getCharacterPickerRoster(onUpdate)

    await vi.waitFor(() => expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(3))
    const callsBeforeAnyResolve = onUpdate.mock.calls.length

    resolvers[0](basicProfile({ name: '캐릭터1', level: 100 }))
    await vi.waitFor(() => expect(onUpdate.mock.calls.length).toBeGreaterThan(callsBeforeAnyResolve))

    resolvers[1](basicProfile({ name: '캐릭터2', level: 200 }))
    resolvers[2](basicProfile({ name: '캐릭터3', level: 300 }))
    await promise
  })

  it('개별 실패는 기존 값(캐시 또는 character/list)을 유지한 채 조용히 넘어간다', async () => {
    const characters = [character('ocid-1')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    getCachedCharacterBasicMock.mockResolvedValue({
      profile: basicProfile({ name: '캐시캐릭', level: 150 }),
      cachedAt: '2026-07-11T00:00:00.000Z',
    })
    fetchCharacterBasicMock.mockRejectedValue(new NexonNetworkError('timeout'))

    const onUpdate = vi.fn()
    await getCharacterPickerRoster(onUpdate)

    const last = onUpdate.mock.calls.at(-1)?.[0]
    expect(last).toEqual([
      { ocid: 'ocid-1', name: '캐시캐릭', level: 150, imageUrl: basicProfile({ name: '캐시캐릭', level: 150 }).imageUrl, world: '베라' },
    ])
  })

  it('한 캐릭터에서 401(NexonAuthError)이 발생하면 전체를 에러로 던진다', async () => {
    const characters = [character('ocid-1'), character('ocid-2')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => {
      if (ocid === 'ocid-1') throw new NexonAuthError('invalid')
      return basicProfile({ name: '정상캐릭', level: 100 })
    })

    await expect(getCharacterPickerRoster(vi.fn())).rejects.toThrow(NexonAuthError)
  })

  it('한 캐릭터에서 429(NexonRateLimitError)가 발생하면 전체를 에러로 던진다', async () => {
    const characters = [character('ocid-1'), character('ocid-2')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => {
      if (ocid === 'ocid-1') throw new NexonRateLimitError('rate limited')
      return basicProfile({ name: '정상캐릭', level: 100 })
    })

    await expect(getCharacterPickerRoster(vi.fn())).rejects.toThrow(NexonRateLimitError)
  })

  it('정렬은 레벨 내림차순이고, 동레벨이면 대표 캐릭터 비교 로직(한글 우선)으로 2차 정렬한다', async () => {
    const characters = [character('ocid-1'), character('ocid-2'), character('ocid-3')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => {
      const byOcid: Record<string, ReturnType<typeof basicProfile>> = {
        'ocid-1': basicProfile({ name: 'Alpha', level: 200 }),
        'ocid-2': basicProfile({ name: '한글캐릭', level: 200 }),
        'ocid-3': basicProfile({ name: '최고레벨', level: 293 }),
      }
      return byOcid[ocid]
    })

    const onUpdate = vi.fn()
    await getCharacterPickerRoster(onUpdate)

    const last = onUpdate.mock.calls.at(-1)?.[0] as Array<{ name: string }>
    expect(last.map((entry) => entry.name)).toEqual(['최고레벨', '한글캐릭', 'Alpha'])
  })
})
