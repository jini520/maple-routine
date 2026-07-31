import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterPickerEntry, MapleAccount, MapleCharacter, SchedulerCharacterState } from '../../../types'
import { NexonAuthError, NexonBadRequestError, NexonNetworkError, NexonRateLimitError } from '../../../nexon/errors'

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

const {
  getWorldSharedProgressMock,
  getAccountSharedProgressMock,
  setWorldSharedProgressEntryMock,
  setAccountSharedProgressEntryMock,
} = vi.hoisted(() => ({
  getWorldSharedProgressMock: vi.fn(),
  getAccountSharedProgressMock: vi.fn(),
  setWorldSharedProgressEntryMock: vi.fn(),
  setAccountSharedProgressEntryMock: vi.fn(),
}))

const { mergeSchedulerStateMock } = vi.hoisted(() => ({
  mergeSchedulerStateMock: vi.fn(),
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

vi.mock('../../../storage/shared-progress-cache', () => ({
  getWorldSharedProgress: getWorldSharedProgressMock,
  getAccountSharedProgress: getAccountSharedProgressMock,
  setWorldSharedProgressEntry: setWorldSharedProgressEntryMock,
  setAccountSharedProgressEntry: setAccountSharedProgressEntryMock,
}))

vi.mock('../../../lib/scheduler-merge', () => ({
  mergeSchedulerState: mergeSchedulerStateMock,
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
    isDailyStale: false,
    isWeeklyStale: false,
    isWeeklyBossStale: false,
    isMonthlyBossStale: false,
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
  getWorldSharedProgressMock.mockResolvedValue({})
  getAccountSharedProgressMock.mockResolvedValue({})
  setWorldSharedProgressEntryMock.mockResolvedValue(undefined)
  setAccountSharedProgressEntryMock.mockResolvedValue(undefined)
  // 기본값: 병합 없이 fresh 그대로 통과(ledger 갱신 없음) — ADR-030 병합 알고리즘 자체는
  // lib/scheduler-merge의 자체 단위 테스트가 검증하고, 여기서는 syncOneCharacter가 그 결과를
  // 올바른 곳(캐시·원장)에 정확히 반영하는지만 확인한다.
  mergeSchedulerStateMock.mockImplementation((input: { fresh: SchedulerCharacterState }) => ({
    characterState: input.fresh,
    worldLedgerUpdates: {},
    accountLedgerUpdates: {},
  }))
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
        world: '베라',
        state: schedulerState('캐릭터1'),
        syncedAt: NOW,
        isStale: false,
        error: null,
      },
      {
        ocid: 'ocid-2',
        characterName: '캐릭터-ocid-2',
        world: '베라',
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

  it('onProgress는 시작 시 (0,total)로 호출되고, 마지막 호출은 (total,total)이다', async () => {
    const characters = [character('ocid-1'), character('ocid-2')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock
      .mockResolvedValueOnce(schedulerState('캐릭터1'))
      .mockResolvedValueOnce(schedulerState('캐릭터2'))

    const onProgress = vi.fn()
    await syncSchedules(['ocid-1', 'ocid-2'], onProgress)

    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenNthCalledWith(1, 0, 2)
    expect(onProgress).toHaveBeenLastCalledWith(2, 2)
  })

  it('첫 캐릭터(프리플라이트)를 먼저 호출해 응답을 기다린 뒤, 나머지 캐릭터는 병렬로 호출한다', async () => {
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

    // 프리플라이트: 첫 캐릭터만 먼저 호출되고 응답을 기다린다
    await vi.waitFor(() => expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(1))
    expect(resolvers).toHaveLength(1)
    resolvers[0](schedulerState('캐릭터1'))

    // 프리플라이트 성공 후 나머지 두 캐릭터는 서로를 기다리지 않고 동시에 호출된다
    await vi.waitFor(() => expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(3))
    resolvers[2](schedulerState('캐릭터3'))
    resolvers[1](schedulerState('캐릭터2'))

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
        world: '베라',
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
        world: '베라',
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
      world: '베라',
      state: schedulerState('캐릭터2'),
      syncedAt: NOW,
      isStale: false,
      error: null,
    })
  })

  it('프리플라이트(첫 캐릭터)에서 401(NexonAuthError)이 발생하면 이후 캐릭터는 API를 호출하지 않고 캐시 폴백만 한다', async () => {
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

  it('프리플라이트(첫 캐릭터)에서 429(NexonRateLimitError)가 발생하면 이후 캐릭터는 API를 호출하지 않고 캐시 폴백만 한다', async () => {
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

  it('프리플라이트 이후 병렬 구간에서 한 캐릭터가 401이어도 나머지 병렬 호출은 막지 않고 개별 결과로 처리한다', async () => {
    const characters = [character('ocid-1'), character('ocid-2'), character('ocid-3')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    fetchSchedulerCharacterStateMock
      .mockResolvedValueOnce(schedulerState('캐릭터1')) // 프리플라이트: ocid-1
      .mockRejectedValueOnce(new NexonAuthError('invalid')) // 병렬: ocid-2
      .mockResolvedValueOnce(schedulerState('캐릭터3')) // 병렬: ocid-3
    getCachedSchedulerStateMock.mockResolvedValue(null)

    const results = await syncSchedules(['ocid-1', 'ocid-2', 'ocid-3'])

    // 병렬 구간의 두 캐릭터 모두 API가 호출된다 — 하나의 401이 형제 호출을 막지 않는다
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(3)
    expect(results[0].isStale).toBe(false)
    expect(results[0].error).toBeNull()
    expect(results[1].error).toEqual({ kind: 'invalidApiKey' })
    expect(results[1].isStale).toBe(true)
    expect(results[2].isStale).toBe(false)
    expect(results[2].error).toBeNull()
  })

  describe('ADR-030: 캐릭터/월드/계정 병합', () => {
    it('이전 캐시·월드/계정 원장을 읽어 mergeSchedulerState에 넘긴다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      const fresh = schedulerState('캐릭터1')
      fetchSchedulerCharacterStateMock.mockResolvedValue(fresh)
      const cachedPrevious = { state: schedulerState('이전-캐릭터1'), syncedAt: '2026-07-10T00:00:00.000Z' }
      getCachedSchedulerStateMock.mockResolvedValue(cachedPrevious)
      getWorldSharedProgressMock.mockResolvedValue({ 몬스터파크: { active: true } })
      getAccountSharedProgressMock.mockResolvedValue({ '에픽 던전 : 악몽선경': { active: true } })

      await syncSchedules(['ocid-1'])

      expect(getWorldSharedProgressMock).toHaveBeenCalledWith(fresh.world)
      expect(getAccountSharedProgressMock).toHaveBeenCalledWith('acc-1')
      expect(mergeSchedulerStateMock).toHaveBeenCalledWith({
        previous: cachedPrevious.state,
        fresh,
        worldLedger: { 몬스터파크: { active: true } },
        accountLedger: { '에픽 던전 : 악몽선경': { active: true } },
        now: expect.any(Date),
      })
    })

    it('previous 캐시가 없으면 previous: null로 mergeSchedulerState를 호출한다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState('캐릭터1'))
      getCachedSchedulerStateMock.mockResolvedValue(null)

      await syncSchedules(['ocid-1'])

      expect(mergeSchedulerStateMock).toHaveBeenCalledWith(expect.objectContaining({ previous: null }))
    })

    it('mergeSchedulerState 결과(characterState)를 캐시에 쓰고 결과의 state로 반환한다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState('캐릭터1'))
      const mergedState = schedulerState('병합된-캐릭터1')
      mergeSchedulerStateMock.mockReturnValue({
        characterState: mergedState,
        worldLedgerUpdates: {},
        accountLedgerUpdates: {},
      })

      const results = await syncSchedules(['ocid-1'])

      expect(results[0].state).toEqual(mergedState)
      expect(setCachedSchedulerStateMock).toHaveBeenCalledWith('ocid-1', { state: mergedState, syncedAt: NOW })
    })

    it('worldLedgerUpdates/accountLedgerUpdates에 담긴 변경분을 각 원장에 저장한다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      const fresh = schedulerState('캐릭터1')
      fetchSchedulerCharacterStateMock.mockResolvedValue(fresh)
      const worldEntry = { active: true, kind: 'contents' as const, nowCount: 7, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-11' }
      const accountEntry = { active: true, kind: 'contents' as const, nowCount: 1, maxCount: 0, questState: null, lastUpdatedBucket: '2026-07-09' }
      mergeSchedulerStateMock.mockReturnValue({
        characterState: fresh,
        worldLedgerUpdates: { 몬스터파크: worldEntry },
        accountLedgerUpdates: { '에픽 던전 : 악몽선경': accountEntry },
      })

      await syncSchedules(['ocid-1'])

      expect(setWorldSharedProgressEntryMock).toHaveBeenCalledWith(fresh.world, '몬스터파크', worldEntry)
      expect(setAccountSharedProgressEntryMock).toHaveBeenCalledWith('acc-1', '에픽 던전 : 악몽선경', accountEntry)
    })

    it('ledger 변경분이 없으면 원장 쓰기를 호출하지 않는다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState('캐릭터1'))

      await syncSchedules(['ocid-1'])

      expect(setWorldSharedProgressEntryMock).not.toHaveBeenCalled()
      expect(setAccountSharedProgressEntryMock).not.toHaveBeenCalled()
    })
  })

  describe('ADR-034: 최초 동기화·캐시 유실 대비 -13일 이내 순차 선채움', () => {
    function bossContent(cycle: 'weekly' | 'monthly') {
      return { name: '자쿰', difficulty: '카오스' as const, cycle, isRegistered: true, isComplete: false, ownComplete: false }
    }

    // NOW = 2026-07-11T00:00:00.000Z = KST 2026-07-11T09:00:00(불안정 구간 아님)
    // → getBackfillDateKeys는 '2026-07-10'(-1일)부터 시작한다.

    it('당일 응답에서 4개 섹션 모두 stale이 아니면 추가 조회를 하지 않는다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState('캐릭터1'))

      await syncSchedules(['ocid-1'])

      expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(1)
      expect(mergeSchedulerStateMock).toHaveBeenCalledTimes(1)
    })

    it('주간 보스가 stale이면 -1일부터 조회하고, 그 날짜 응답이 그 섹션에 대해 stale이 아니면 거기서 멈춘다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])

      const stage1State = { ...schedulerState('캐릭터1'), isWeeklyBossStale: true, bossContents: [] }
      const day1Response = { ...schedulerState('-1일 응답'), isWeeklyBossStale: false, bossContents: [bossContent('weekly')] }
      const finalState = { ...schedulerState('병합결과'), isWeeklyBossStale: true, bossContents: [bossContent('weekly')] }

      fetchSchedulerCharacterStateMock.mockResolvedValueOnce(schedulerState('캐릭터1')).mockResolvedValueOnce(day1Response)
      mergeSchedulerStateMock
        .mockReturnValueOnce({ characterState: stage1State, worldLedgerUpdates: {}, accountLedgerUpdates: {} })
        .mockReturnValueOnce({ characterState: finalState, worldLedgerUpdates: {}, accountLedgerUpdates: {} })

      const results = await syncSchedules(['ocid-1'])

      expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(2)
      expect(fetchSchedulerCharacterStateMock).toHaveBeenNthCalledWith(1, 'key-1', 'ocid-1')
      expect(fetchSchedulerCharacterStateMock).toHaveBeenNthCalledWith(2, 'key-1', 'ocid-1', '2026-07-10')

      expect(mergeSchedulerStateMock).toHaveBeenCalledTimes(2)
      expect(mergeSchedulerStateMock).toHaveBeenNthCalledWith(2, {
        previous: day1Response,
        fresh: { ...stage1State, isDailyStale: true, isWeeklyStale: true, isWeeklyBossStale: true, isMonthlyBossStale: true },
        worldLedger: {},
        accountLedger: {},
        now: expect.any(Date),
      })

      expect(results[0].state).toEqual(finalState)
      expect(setCachedSchedulerStateMock).toHaveBeenCalledWith('ocid-1', { state: finalState, syncedAt: NOW })
    })

    it('-1일도 그 섹션이 stale이면 -2일로 계속 넘어간다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])

      const stage1State = { ...schedulerState('캐릭터1'), isWeeklyBossStale: true, bossContents: [] }
      const day1Response = { ...schedulerState('-1일'), isWeeklyBossStale: true, bossContents: [] }
      const day2Response = { ...schedulerState('-2일'), isWeeklyBossStale: false, bossContents: [bossContent('weekly')] }

      fetchSchedulerCharacterStateMock
        .mockResolvedValueOnce(schedulerState('캐릭터1'))
        .mockResolvedValueOnce(day1Response)
        .mockResolvedValueOnce(day2Response)
      mergeSchedulerStateMock
        .mockReturnValueOnce({ characterState: stage1State, worldLedgerUpdates: {}, accountLedgerUpdates: {} })
        .mockReturnValueOnce({ characterState: stage1State, worldLedgerUpdates: {}, accountLedgerUpdates: {} })
        .mockReturnValueOnce({ characterState: stage1State, worldLedgerUpdates: {}, accountLedgerUpdates: {} })

      await syncSchedules(['ocid-1'])

      expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(3)
      expect(fetchSchedulerCharacterStateMock).toHaveBeenNthCalledWith(2, 'key-1', 'ocid-1', '2026-07-10')
      expect(fetchSchedulerCharacterStateMock).toHaveBeenNthCalledWith(3, 'key-1', 'ocid-1', '2026-07-09')
      expect(mergeSchedulerStateMock).toHaveBeenCalledTimes(3)
    })

    it('13일을 다 써도 못 찾으면 조회를 멈추고 그동안 누적된 결과를 그대로 쓴다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])

      const stage1State = { ...schedulerState('캐릭터1'), isWeeklyBossStale: true, bossContents: [] }
      const alwaysStaleDay = { ...schedulerState('과거'), isWeeklyBossStale: true, bossContents: [] }

      fetchSchedulerCharacterStateMock.mockResolvedValueOnce(schedulerState('캐릭터1')).mockResolvedValue(alwaysStaleDay)
      mergeSchedulerStateMock.mockReturnValue({ characterState: stage1State, worldLedgerUpdates: {}, accountLedgerUpdates: {} })

      const results = await syncSchedules(['ocid-1'])

      // 오늘 조회 1회 + 과거 조회 13회(-1일~-13일) = 14회
      expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(14)
      expect(mergeSchedulerStateMock).toHaveBeenCalledTimes(14)
      expect(results[0].state).toEqual(stage1State)
    })

    it('과거 날짜 조회가 실패해도(네트워크 등) 그 날짜만 건너뛰고 다음 날짜로 계속한다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])

      const stage1State = { ...schedulerState('캐릭터1'), isWeeklyBossStale: true, bossContents: [] }
      const day2Response = { ...schedulerState('-2일'), isWeeklyBossStale: false, bossContents: [bossContent('weekly')] }
      const finalState = { ...schedulerState('병합결과'), isWeeklyBossStale: true, bossContents: [bossContent('weekly')] }

      fetchSchedulerCharacterStateMock
        .mockResolvedValueOnce(schedulerState('캐릭터1'))
        .mockRejectedValueOnce(new NexonNetworkError('-1일 조회 실패'))
        .mockResolvedValueOnce(day2Response)
      mergeSchedulerStateMock
        .mockReturnValueOnce({ characterState: stage1State, worldLedgerUpdates: {}, accountLedgerUpdates: {} })
        .mockReturnValueOnce({ characterState: finalState, worldLedgerUpdates: {}, accountLedgerUpdates: {} })

      const results = await syncSchedules(['ocid-1'])

      expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(3)
      expect(fetchSchedulerCharacterStateMock).toHaveBeenNthCalledWith(3, 'key-1', 'ocid-1', '2026-07-09')
      // -1일 조회는 실패해서 merge가 안 불리고, 그다음 성공한 -2일만 merge된다(1단계 + -2일 = 2회)
      expect(mergeSchedulerStateMock).toHaveBeenCalledTimes(2)
      expect(results[0].state).toEqual(finalState)
      expect(results[0].isStale).toBe(false)
    })

    it('1·N단계 world/account 원장 변경분을 모두 합쳐 저장하고, 다음 단계는 이전 변경분이 반영된 원장을 받는다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      const fresh = schedulerState('캐릭터1')
      const day1Response = { ...schedulerState('-1일'), isWeeklyBossStale: false, bossContents: [bossContent('weekly')] }
      fetchSchedulerCharacterStateMock.mockResolvedValueOnce(fresh).mockResolvedValueOnce(day1Response)

      const stage1State = { ...schedulerState('캐릭터1'), isWeeklyBossStale: true, bossContents: [] }
      const finalState = { ...schedulerState('병합결과'), isWeeklyBossStale: true, bossContents: [bossContent('weekly')] }
      const worldEntry = { active: true, kind: 'contents' as const, nowCount: 7, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-11' }
      const accountEntry = { active: true, kind: 'contents' as const, nowCount: 1, maxCount: 0, questState: null, lastUpdatedBucket: '2026-07-09' }

      mergeSchedulerStateMock
        .mockReturnValueOnce({ characterState: stage1State, worldLedgerUpdates: { 몬스터파크: worldEntry }, accountLedgerUpdates: {} })
        .mockReturnValueOnce({
          characterState: finalState,
          worldLedgerUpdates: {},
          accountLedgerUpdates: { '에픽 던전 : 악몽선경': accountEntry },
        })

      await syncSchedules(['ocid-1'])

      expect(mergeSchedulerStateMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ worldLedger: { 몬스터파크: worldEntry }, accountLedger: {} }),
      )
      expect(setWorldSharedProgressEntryMock).toHaveBeenCalledWith(fresh.world, '몬스터파크', worldEntry)
      expect(setAccountSharedProgressEntryMock).toHaveBeenCalledWith('acc-1', '에픽 던전 : 악몽선경', accountEntry)
    })

    // ADR-034 추가 정정(2026-07-25): 콜드 스타트에서 당일 daily가 완전히 비지 않고 월드공유
    // 항목(몬스터파크)만 남으면 isDailyStale이 false라 백필이 안 걸리던 사각지대. 병합 결과에
    // character 범위 항목이 하나도 없으면(=몬스터파크뿐) stale로 보고 과거 조회를 발동한다.
    const monsterParkOnly = {
      name: '몬스터파크',
      kind: 'contents' as const,
      isRegistered: true,
      nowCount: 0,
      maxCount: 14,
      questState: null,
    }
    const dailyQuest = {
      name: '[일일 퀘스트] 세르니움 조사',
      kind: 'quest' as const,
      isRegistered: true,
      nowCount: 0,
      maxCount: 0,
      questState: 2 as const,
    }

    it('당일 daily에 월드공유 항목(몬스터파크)만 남고 character 일일이 빠졌으면 isDailyStale이 false여도 백필한다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])

      const stage1State = { ...schedulerState('캐릭터1'), dailyContents: [monsterParkOnly], isDailyStale: false }
      const day1Response = { ...schedulerState('-1일 응답'), dailyContents: [dailyQuest], isDailyStale: false }
      const finalState = { ...schedulerState('병합결과'), dailyContents: [monsterParkOnly, dailyQuest], isDailyStale: false }

      fetchSchedulerCharacterStateMock.mockResolvedValueOnce(schedulerState('캐릭터1')).mockResolvedValueOnce(day1Response)
      mergeSchedulerStateMock
        .mockReturnValueOnce({ characterState: stage1State, worldLedgerUpdates: {}, accountLedgerUpdates: {} })
        .mockReturnValueOnce({ characterState: finalState, worldLedgerUpdates: {}, accountLedgerUpdates: {} })

      const results = await syncSchedules(['ocid-1'])

      expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(2)
      expect(fetchSchedulerCharacterStateMock).toHaveBeenNthCalledWith(2, 'key-1', 'ocid-1', '2026-07-10')
      expect(mergeSchedulerStateMock).toHaveBeenCalledTimes(2)
      expect(results[0].state).toEqual(finalState)
    })

    it('과거 조회 응답도 월드공유만 있으면(-1일도 여전히 부분 누락) 다음 날짜로 계속 넘어간다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])

      const stage1State = { ...schedulerState('캐릭터1'), dailyContents: [monsterParkOnly], isDailyStale: false }
      const day1Response = { ...schedulerState('-1일'), dailyContents: [monsterParkOnly], isDailyStale: false }
      const day2Response = { ...schedulerState('-2일'), dailyContents: [dailyQuest], isDailyStale: false }

      fetchSchedulerCharacterStateMock
        .mockResolvedValueOnce(schedulerState('캐릭터1'))
        .mockResolvedValueOnce(day1Response)
        .mockResolvedValueOnce(day2Response)
      mergeSchedulerStateMock
        .mockReturnValueOnce({ characterState: stage1State, worldLedgerUpdates: {}, accountLedgerUpdates: {} })
        .mockReturnValueOnce({ characterState: stage1State, worldLedgerUpdates: {}, accountLedgerUpdates: {} })
        .mockReturnValueOnce({ characterState: stage1State, worldLedgerUpdates: {}, accountLedgerUpdates: {} })

      await syncSchedules(['ocid-1'])

      expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(3)
      expect(fetchSchedulerCharacterStateMock).toHaveBeenNthCalledWith(3, 'key-1', 'ocid-1', '2026-07-09')
      expect(mergeSchedulerStateMock).toHaveBeenCalledTimes(3)
    })

    it('병합 결과 daily에 character 항목이 있으면(몬스터파크+일일퀘스트) 백필하지 않는다', async () => {
      const characters = [character('ocid-1')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])

      const stage1State = {
        ...schedulerState('캐릭터1'),
        dailyContents: [monsterParkOnly, dailyQuest],
        isDailyStale: false,
      }
      fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState('캐릭터1'))
      mergeSchedulerStateMock.mockReturnValue({ characterState: stage1State, worldLedgerUpdates: {}, accountLedgerUpdates: {} })

      await syncSchedules(['ocid-1'])

      expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(1)
      expect(mergeSchedulerStateMock).toHaveBeenCalledTimes(1)
    })
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

    // ADR-053 결정 1로 갱신: 예전에는 character/list 응답 시점에 캐시 없는 캐릭터까지 전부
    // 채워 넣었으나(access_flag 미상), 이제는 캐시로 활성이 확인된 캐릭터만 남는다.
    it('character/list 응답이 도착해도 캐시로 활성이 확인된 캐릭터만 담긴 목록으로 교체된다', async () => {
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
      const afterCharacterList = onUpdate.mock.calls.at(-1)?.[0] as CharacterPickerEntry[]
      expect(afterCharacterList.map((entry) => entry.ocid)).toEqual(['ocid-1'])
      expect(afterCharacterList).toEqual([
        {
          ocid: 'ocid-1',
          name: '캐싱된캐릭',
          level: 180,
          imageUrl: basicProfile({ name: '캐싱된캐릭', level: 180 }).imageUrl,
          world: '베라',
        },
      ])
    })
  })

  // ADR-068 결정 4: 조회 불가 캐릭터(400 OPENAPI00003)를 목록에서 빼지 않는다 — 빼면 trackedOcids에
  // 남은 그 ocid를 사용자가 해제할 방법이 없다(이슈 #78 A-1: "사용자가 스스로 벗어날 방법이 없다").
  describe('조회 불가 캐릭터(OPENAPI00003)', () => {
    it('목록에서 빼지 않고 unavailable 항목으로 남긴다', async () => {
      const characters = [character('ocid-1'), character('ocid-2')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      getAllCachedCharacterBasicOcidsMock.mockResolvedValue([])
      getCachedCharacterBasicMock.mockResolvedValue(null)
      fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => {
        if (ocid === 'ocid-2') {
          throw new NexonBadRequestError('조회할 수 없는 ocid', 'OPENAPI00003')
        }
        return basicProfile({ name: '정상', level: 250 })
      })

      const onUpdate = vi.fn()
      await getCharacterPickerRoster(onUpdate)

      const emitted = onUpdate.mock.calls.at(-1)?.[0] as CharacterPickerEntry[]
      expect(emitted.map((entry) => entry.ocid).sort()).toEqual(['ocid-1', 'ocid-2'])

      const unavailable = emitted.find((entry) => entry.ocid === 'ocid-2')
      // character/list가 준 이름·레벨·월드는 쓸 수 있다(basic만 실패한 것이다)
      expect(unavailable).toEqual({
        ocid: 'ocid-2',
        name: '캐릭터-ocid-2',
        level: 200,
        imageUrl: null,
        world: '베라',
        unavailable: true,
      })
      expect(emitted.find((entry) => entry.ocid === 'ocid-1')?.unavailable).toBeUndefined()
    })

    it('조회 불가 항목은 목록 맨 뒤로 보낸다 — 정상 후보를 밀어내지 않는다', async () => {
      const characters = [character('ocid-low'), character('ocid-high')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      getAllCachedCharacterBasicOcidsMock.mockResolvedValue([])
      getCachedCharacterBasicMock.mockResolvedValue(null)
      fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => {
        // 레벨이 더 높은 쪽이 조회 불가여도 뒤로 간다
        if (ocid === 'ocid-high') throw new NexonBadRequestError('x', 'OPENAPI00003')
        return basicProfile({ name: '낮은레벨', level: 10 })
      })

      const onUpdate = vi.fn()
      await getCharacterPickerRoster(onUpdate)

      const emitted = onUpdate.mock.calls.at(-1)?.[0] as CharacterPickerEntry[]
      expect(emitted.map((entry) => entry.ocid)).toEqual(['ocid-low', 'ocid-high'])
    })

    it('그 외 개별 실패(네트워크)는 지금처럼 목록에 넣지 않는다 — 조회 불가와 구분한다', async () => {
      const characters = [character('ocid-1'), character('ocid-2')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      getAllCachedCharacterBasicOcidsMock.mockResolvedValue([])
      getCachedCharacterBasicMock.mockResolvedValue(null)
      fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => {
        if (ocid === 'ocid-2') throw new NexonNetworkError('offline')
        return basicProfile({ name: '정상', level: 250 })
      })

      const onUpdate = vi.fn()
      await getCharacterPickerRoster(onUpdate)

      const emitted = onUpdate.mock.calls.at(-1)?.[0] as CharacterPickerEntry[]
      expect(emitted.map((entry) => entry.ocid)).toEqual(['ocid-1'])
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
    getAllCachedCharacterBasicOcidsMock.mockResolvedValue(['ocid-1'])
    getCachedCharacterBasicMock.mockResolvedValue({
      profile: basicProfile({ name: '캐시캐릭', level: 150 }),
      cachedAt: '2026-07-11T00:00:00.000Z',
    })
    fetchCharacterBasicMock.mockImplementation(() => new Promise(() => {})) // 절대 resolve 안 함

    const onUpdate = vi.fn()
    void getCharacterPickerRoster(onUpdate)

    // 첫 방출(stub)은 character/basic 응답 없이도 캐시 값만으로 이뤄진다
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalled())
    expect(onUpdate.mock.calls[0][0]).toEqual([
      { ocid: 'ocid-1', name: '캐시캐릭', level: 150, imageUrl: basicProfile({ name: '캐시캐릭', level: 150 }).imageUrl },
    ])

    // character/list 응답 이후 방출도 캐시 값(+ world)을 그대로 유지한다
    await vi.waitFor(() => expect(onUpdate.mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(onUpdate.mock.calls.at(-1)?.[0]).toEqual([
      { ocid: 'ocid-1', name: '캐시캐릭', level: 150, imageUrl: basicProfile({ name: '캐시캐릭', level: 150 }).imageUrl, world: '베라' },
    ])
  })

  // ADR-053 결정 1로 갱신: 예전에는 imageUrl: null + character/list의 이름/레벨로 즉시 넣었다.
  it('캐시가 없는 캐릭터는 character/basic으로 활성이 확인되기 전까지 어떤 방출에도 포함되지 않는다', async () => {
    const characters = [character('ocid-1'), character('ocid-2')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    getAllCachedCharacterBasicOcidsMock.mockResolvedValue(['ocid-1'])
    getCachedCharacterBasicMock.mockImplementation(async (ocid: string) =>
      ocid === 'ocid-1'
        ? { profile: basicProfile({ name: '캐시캐릭', level: 150 }), cachedAt: '2026-07-11T00:00:00.000Z' }
        : null,
    )
    const resolvers: Array<(profile: ReturnType<typeof basicProfile>) => void> = []
    fetchCharacterBasicMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve)
        }),
    )

    const onUpdate = vi.fn()
    const promise = getCharacterPickerRoster(onUpdate)

    await vi.waitFor(() => expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(2))
    for (const [entries] of onUpdate.mock.calls) {
      expect((entries as CharacterPickerEntry[]).map((entry) => entry.ocid)).toEqual(['ocid-1'])
    }

    // character/basic이 활성을 확인해준 뒤에야 목록에 들어온다
    resolvers[0](basicProfile({ name: '캐시캐릭', level: 150 }))
    resolvers[1](basicProfile({ name: '새캐릭', level: 250 }))
    await promise

    const last = onUpdate.mock.calls.at(-1)?.[0] as CharacterPickerEntry[]
    expect(last.map((entry) => entry.ocid)).toEqual(['ocid-2', 'ocid-1'])
  })

  it('캐시상 access_flag가 false인 캐릭터는 모든 방출에서 제외된다', async () => {
    const characters = [character('ocid-1'), character('ocid-2')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    getAllCachedCharacterBasicOcidsMock.mockResolvedValue(['ocid-1', 'ocid-2'])
    getCachedCharacterBasicMock.mockImplementation(async (ocid: string) =>
      ocid === 'ocid-1'
        ? { profile: basicProfile({ name: '활성캐릭', level: 150 }), cachedAt: '2026-07-11T00:00:00.000Z' }
        : {
            profile: { ...basicProfile({ name: '비공개', level: 999 }), accessFlag: false },
            cachedAt: '2026-07-11T00:00:00.000Z',
          },
    )
    fetchCharacterBasicMock.mockImplementation(() => new Promise(() => {}))

    const onUpdate = vi.fn()
    void getCharacterPickerRoster(onUpdate)

    await vi.waitFor(() => expect(onUpdate.mock.calls.length).toBeGreaterThanOrEqual(2))
    for (const [entries] of onUpdate.mock.calls) {
      expect((entries as CharacterPickerEntry[]).map((entry) => entry.ocid)).toEqual(['ocid-1'])
    }
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

  // ADR-053 결정 2: 개별 patch 스트리밍은 "보여줄 캐시가 있는" 웜 경로의 동작이다(콜드 경로는
  // 아래 ADR-053 describe에서 중간 방출 억제를 검증한다).
  it('character/basic을 Promise.all로 뭉치지 않고 하나씩 끝나는 대로 onUpdate한다', async () => {
    const characters = [character('ocid-1'), character('ocid-2'), character('ocid-3')]
    fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
    getAllCachedCharacterBasicOcidsMock.mockResolvedValue(['ocid-1', 'ocid-2', 'ocid-3'])
    getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
      profile: basicProfile({ name: `캐시-${ocid}`, level: 100 }),
      cachedAt: '2026-07-11T00:00:00.000Z',
    }))
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

  it('개별 실패는 기존 캐시 값을 유지한 채 조용히 넘어간다', async () => {
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

  describe('ADR-053 결정 1·2: access_flag 확인된 캐릭터만 방출 + 콜드 스타트 중간 방출 억제', () => {
    it('웜 캐시 — character/list 응답 전 stub을 방출하고, 이후 응답마다 추가로 방출한다(ADR-016 SWR 유지)', async () => {
      const characters = [character('ocid-1'), character('ocid-2')]
      let resolveList: (accounts: MapleAccount[]) => void = () => {}
      fetchCharacterListMock.mockImplementation(
        () =>
          new Promise<MapleAccount[]>((resolve) => {
            resolveList = resolve
          }),
      )
      getAllCachedCharacterBasicOcidsMock.mockResolvedValue(['ocid-1', 'ocid-2'])
      getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
        profile: basicProfile({ name: `캐시-${ocid}`, level: 100 }),
        cachedAt: '2026-07-11T00:00:00.000Z',
      }))
      const resolvers: Array<(profile: ReturnType<typeof basicProfile>) => void> = []
      fetchCharacterBasicMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve)
          }),
      )

      const onUpdate = vi.fn()
      const promise = getCharacterPickerRoster(onUpdate)

      // ① stub — character/list 응답을 기다리지 않고 즉시
      await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
      expect(fetchCharacterBasicMock).not.toHaveBeenCalled()

      // ② character/list 응답 시점에 추가 방출
      resolveList([account('acc-1', characters)])
      await vi.waitFor(() => expect(onUpdate.mock.calls.length).toBeGreaterThanOrEqual(2))
      await vi.waitFor(() => expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(2))
      const callsBeforeAnyResolve = onUpdate.mock.calls.length

      // ③ character/basic 응답마다 개별 patch 방출
      resolvers[0](basicProfile({ name: '최신-1', level: 250 }))
      await vi.waitFor(() => expect(onUpdate.mock.calls.length).toBeGreaterThan(callsBeforeAnyResolve))

      resolvers[1](basicProfile({ name: '최신-2', level: 240 }))
      await promise

      expect(onUpdate.mock.calls.length).toBeGreaterThanOrEqual(4)
      expect(onUpdate.mock.calls.at(-1)?.[0]).toEqual([
        { ocid: 'ocid-1', name: '최신-1', level: 250, imageUrl: basicProfile({ name: '최신-1', level: 250 }).imageUrl, world: '베라' },
        { ocid: 'ocid-2', name: '최신-2', level: 240, imageUrl: basicProfile({ name: '최신-2', level: 240 }).imageUrl, world: '베라' },
      ])
    })

    it('콜드 캐시 — character/list·개별 character/basic 응답 시점엔 방출하지 않고 완료 후 정확히 1회만 방출한다', async () => {
      const characters = [character('ocid-1'), character('ocid-2')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      getAllCachedCharacterBasicOcidsMock.mockResolvedValue([])
      getCachedCharacterBasicMock.mockResolvedValue(null)
      const resolvers: Array<(profile: ReturnType<typeof basicProfile>) => void> = []
      fetchCharacterBasicMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve)
          }),
      )

      const onUpdate = vi.fn()
      const promise = getCharacterPickerRoster(onUpdate)

      // ② character/list 응답 — 방출 없음
      await vi.waitFor(() => expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(2))
      expect(onUpdate).not.toHaveBeenCalled()

      // ③ 개별 응답 — 방출 없음
      resolvers[0](basicProfile({ name: '캐릭1', level: 250 }))
      await vi.waitFor(() => expect(setCachedCharacterBasicMock).toHaveBeenCalledTimes(1))
      expect(onUpdate).not.toHaveBeenCalled()

      resolvers[1](basicProfile({ name: '캐릭2', level: 240 }))
      await promise

      expect(onUpdate).toHaveBeenCalledTimes(1)
      expect(onUpdate).toHaveBeenCalledWith([
        { ocid: 'ocid-1', name: '캐릭1', level: 250, imageUrl: basicProfile({ name: '캐릭1', level: 250 }).imageUrl, world: '베라' },
        { ocid: 'ocid-2', name: '캐릭2', level: 240, imageUrl: basicProfile({ name: '캐릭2', level: 240 }).imageUrl, world: '베라' },
      ])
    })

    it('콜드 캐시 — 캐시 인덱스에 ocid가 있어도 전부 access_flag: false면 콜드로 보고 1회만 방출한다', async () => {
      const characters = [character('ocid-1'), character('ocid-2')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      getAllCachedCharacterBasicOcidsMock.mockResolvedValue(['ocid-1', 'ocid-2'])
      getCachedCharacterBasicMock.mockImplementation(async () => ({
        profile: { ...basicProfile({ name: '비공개', level: 999 }), accessFlag: false },
        cachedAt: '2026-07-11T00:00:00.000Z',
      }))
      fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) =>
        ocid === 'ocid-1' ? basicProfile({ name: '이제활성', level: 210 }) : basicProfile({ name: '이제활성2', level: 205 }),
      )

      const onUpdate = vi.fn()
      await getCharacterPickerRoster(onUpdate)

      expect(onUpdate).toHaveBeenCalledTimes(1)
      expect((onUpdate.mock.calls[0][0] as CharacterPickerEntry[]).map((entry) => entry.name)).toEqual([
        '이제활성',
        '이제활성2',
      ])
    })

    it('콜드 캐시 — character/basic이 access_flag: false를 반환한 캐릭터는 어떤 방출에도 등장하지 않는다', async () => {
      const characters = [character('ocid-1'), character('ocid-2')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) =>
        ocid === 'ocid-1'
          ? basicProfile({ name: '활성캐릭', level: 200 })
          : { ...basicProfile({ name: '비공개', level: 999 }), accessFlag: false },
      )

      const onUpdate = vi.fn()
      await getCharacterPickerRoster(onUpdate)

      const emittedOcids = onUpdate.mock.calls.flatMap(([entries]) =>
        (entries as CharacterPickerEntry[]).map((entry) => entry.ocid),
      )
      expect(emittedOcids).toEqual(['ocid-1'])
    })

    it('콜드 캐시 — 전역 실패(401)면 불완전한 목록을 최종 방출하지 않고 그대로 던진다', async () => {
      const characters = [character('ocid-1'), character('ocid-2')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => {
        if (ocid === 'ocid-1') throw new NexonAuthError('invalid')
        return basicProfile({ name: '정상캐릭', level: 100 })
      })

      const onUpdate = vi.fn()
      await expect(getCharacterPickerRoster(onUpdate)).rejects.toThrow(NexonAuthError)
      expect(onUpdate).not.toHaveBeenCalled()
    })

    it('콜드 캐시 — 전역 실패(429)면 불완전한 목록을 최종 방출하지 않고 그대로 던진다', async () => {
      const characters = [character('ocid-1'), character('ocid-2')]
      fetchCharacterListMock.mockResolvedValue([account('acc-1', characters)])
      fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => {
        if (ocid === 'ocid-1') throw new NexonRateLimitError('rate limited')
        return basicProfile({ name: '정상캐릭', level: 100 })
      })

      const onUpdate = vi.fn()
      await expect(getCharacterPickerRoster(onUpdate)).rejects.toThrow(NexonRateLimitError)
      expect(onUpdate).not.toHaveBeenCalled()
    })
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
