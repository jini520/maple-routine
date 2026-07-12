import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterScheduleSync } from '../../schedule-sync/schedule-sync'
import type { BossContent } from '../../../types'

const {
  syncSchedulesMock,
  getTrackedCharacterOcidsMock,
  setTrackedCharacterOcidsMock,
  getLastSelectedCharacterMock,
  setLastSelectedCharacterMock,
} = vi.hoisted(() => ({
  syncSchedulesMock: vi.fn(),
  getTrackedCharacterOcidsMock: vi.fn(),
  setTrackedCharacterOcidsMock: vi.fn(),
  getLastSelectedCharacterMock: vi.fn(),
  setLastSelectedCharacterMock: vi.fn(),
}))

const { getCachedSchedulerStateMock, getCachedCharacterBasicMock } = vi.hoisted(() => ({
  getCachedSchedulerStateMock: vi.fn(),
  getCachedCharacterBasicMock: vi.fn(),
}))

vi.mock('../../schedule-sync/schedule-sync', () => ({
  syncSchedules: syncSchedulesMock,
}))

vi.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: getTrackedCharacterOcidsMock,
  setTrackedCharacterOcids: setTrackedCharacterOcidsMock,
  getLastSelectedCharacter: getLastSelectedCharacterMock,
  setLastSelectedCharacter: setLastSelectedCharacterMock,
}))

vi.mock('../../../storage/scheduler-cache', () => ({
  getCachedSchedulerState: getCachedSchedulerStateMock,
}))

vi.mock('../../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: getCachedCharacterBasicMock,
}))

import { useBossSchedulerStore } from '../store'

function bossContent(overrides: Partial<BossContent> = {}): BossContent {
  return {
    name: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ...overrides,
  }
}

function syncResult(overrides: Partial<CharacterScheduleSync> = {}): CharacterScheduleSync {
  return {
    ocid: 'ocid-1',
    characterName: '캐릭터-ocid-1',
    state: {
      asOf: '2026-07-09T00:00+09:00',
      characterName: '캐릭터-ocid-1',
      world: '베라',
      level: 200,
      jobClass: '렌',
      dailyContents: [],
      weeklyContents: [],
      bossContents: [bossContent()],
      weeklyBossClearCount: 3,
      weeklyBossClearLimitCount: 12,
    },
    syncedAt: '2026-07-11T00:00:00.000Z',
    isStale: false,
    error: null,
    ...overrides,
  }
}

beforeEach(() => {
  useBossSchedulerStore.setState({
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    selectedOcid: null,
  })
  getCachedSchedulerStateMock.mockResolvedValue(null)
  getCachedCharacterBasicMock.mockResolvedValue(null)
  getLastSelectedCharacterMock.mockResolvedValue(null)
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('useBossSchedulerStore', () => {
  it('초기 상태는 idle이고 캐릭터가 비어있다', () => {
    const state = useBossSchedulerStore.getState()
    expect(state.status).toBe('idle')
    expect(state.characters).toEqual([])
    expect(state.error).toBeNull()
  })

  it('refresh([])는 syncSchedules를 호출하지 않고 곧바로 loaded/빈 배열 상태가 된다', async () => {
    await useBossSchedulerStore.getState().refresh([])

    const state = useBossSchedulerStore.getState()
    expect(syncSchedulesMock).not.toHaveBeenCalled()
    expect(state.status).toBe('loaded')
    expect(state.characters).toEqual([])
    expect(state.error).toBeNull()
  })

  it('refresh(ocids)는 syncSchedules(ocids)를 정확히 그 인자로 호출한다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()])

    await useBossSchedulerStore.getState().refresh(['ocid-1'])

    expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1'])
  })

  it('weekly와 monthly가 섞여 있으면 각각 weeklyBosses/monthlyBosses로 정확히 분리된다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [
            bossContent({ name: '자쿰', cycle: 'weekly' }),
            bossContent({ name: '검은 마법사', cycle: 'monthly' }),
          ],
        },
      }),
    ])

    await useBossSchedulerStore.getState().refresh(['ocid-1'])

    const state = useBossSchedulerStore.getState()
    expect(state.characters[0].weeklyBosses).toEqual([
      {
        apiName: '자쿰',
        difficulty: '카오스',
        cycle: 'weekly',
        isRegistered: true,
        isComplete: false,
        matchedBossName: '자쿰',
        portraitSlug: null,
      },
    ])
    expect(state.characters[0].monthlyBosses).toEqual([
      {
        apiName: '검은 마법사',
        difficulty: '카오스',
        cycle: 'monthly',
        isRegistered: true,
        isComplete: false,
        matchedBossName: '검은마법사',
        portraitSlug: 'blackMage',
      },
    ])
  })

  it('월간 보스만 있으면 weeklyBosses는 빈 배열, monthlyBosses에만 항목이 들어간다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: '검은 마법사', cycle: 'monthly' })],
        },
      }),
    ])

    await useBossSchedulerStore.getState().refresh(['ocid-1'])

    const state = useBossSchedulerStore.getState()
    expect(state.characters[0].weeklyBosses).toEqual([])
    expect(state.characters[0].monthlyBosses).toHaveLength(1)
    expect(state.characters[0].monthlyBosses[0].cycle).toBe('monthly')
  })

  it('주간 보스만 있으면 monthlyBosses는 빈 배열, weeklyBosses에만 항목이 들어간다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()])

    await useBossSchedulerStore.getState().refresh(['ocid-1'])

    const state = useBossSchedulerStore.getState()
    expect(state.characters[0].monthlyBosses).toEqual([])
    expect(state.characters[0].weeklyBosses).toHaveLength(1)
    expect(state.characters[0].weeklyBosses[0].cycle).toBe('weekly')
  })

  it('모든 캐릭터가 성공하면 status: loaded이고 클리어 카운트가 그대로 반영된다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-1', characterName: '캐릭터1' })])

    await useBossSchedulerStore.getState().refresh(['ocid-1'])

    const state = useBossSchedulerStore.getState()
    expect(state.status).toBe('loaded')
    expect(state.error).toBeNull()
    expect(state.characters[0].weeklyBossClearCount).toBe(3)
    expect(state.characters[0].weeklyBossClearLimitCount).toBe(12)
  })

  it('state가 null인 캐릭터는 weeklyBosses·monthlyBosses를 빈 배열로, 클리어 카운트를 null로 채운다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({ state: null, syncedAt: null, isStale: true, error: { kind: 'network' } }),
    ])

    await useBossSchedulerStore.getState().refresh(['ocid-1'])

    const state = useBossSchedulerStore.getState()
    expect(state.status).toBe('loaded')
    expect(state.characters).toEqual([
      {
        ocid: 'ocid-1',
        characterName: '캐릭터-ocid-1',
        weeklyBosses: [],
        monthlyBosses: [],
        weeklyBossClearCount: null,
        weeklyBossClearLimitCount: null,
        isStale: true,
        syncedAt: null,
        error: { kind: 'network' },
      },
    ])
  })

  it('syncSchedules() 자체가 throw하면 status: error가 되고 characters는 비어있는 상태를 유지한다', async () => {
    syncSchedulesMock.mockRejectedValue(new Error('온보딩이 완료되지 않았습니다'))

    await useBossSchedulerStore.getState().refresh(['ocid-1'])

    const state = useBossSchedulerStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'network' })
    expect(state.characters).toEqual([])
  })

  it('ADR-016: 캐시된 값이 있으면 재검증 응답을 기다리지 않고 즉시 characters에 반영한다', async () => {
    getCachedSchedulerStateMock.mockResolvedValue({
      state: {
        asOf: '2026-07-11T00:00+09:00',
        characterName: '캐시된캐릭터',
        world: '베라',
        level: 200,
        jobClass: '렌',
        dailyContents: [],
        weeklyContents: [],
        bossContents: [bossContent()],
        weeklyBossClearCount: 5,
        weeklyBossClearLimitCount: 12,
      },
      syncedAt: '2026-07-11T00:00:00.000Z',
    })
    syncSchedulesMock.mockImplementation(() => new Promise(() => {})) // 절대 resolve 안 함(재검증 대기 중 상태 관찰용)

    const promise = useBossSchedulerStore.getState().refresh(['ocid-1'])

    await vi.waitFor(() => expect(useBossSchedulerStore.getState().status).toBe('loading'))
    const state = useBossSchedulerStore.getState()
    expect(state.characters[0].characterName).toBe('캐시된캐릭터')
    expect(state.characters[0].isStale).toBe(true)
    expect(state.characters[0].weeklyBossClearCount).toBe(5)
    expect(state.characters[0].weeklyBosses).toHaveLength(1)

    void promise // 이 테스트는 재검증이 끝나길 기다리지 않는다
  })

  it('refresh 시작 시 status를 loading으로 바꾼다', async () => {
    let resolveSync: (value: CharacterScheduleSync[]) => void = () => {}
    syncSchedulesMock.mockImplementation(
      () =>
        new Promise<CharacterScheduleSync[]>((resolve) => {
          resolveSync = resolve
        }),
    )

    const promise = useBossSchedulerStore.getState().refresh(['ocid-1'])

    await vi.waitFor(() => expect(useBossSchedulerStore.getState().status).toBe('loading'))
    resolveSync([])
    await promise

    expect(useBossSchedulerStore.getState().status).toBe('loaded')
  })

  describe('추적 목록', () => {
    it('loadTrackedOcids는 storage에서 조회한 값을 trackedOcids 상태에 반영한다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().loadTrackedOcids()

      expect(getTrackedCharacterOcidsMock).toHaveBeenCalledWith('boss')
      expect(useBossSchedulerStore.getState().trackedOcids).toEqual(['ocid-1'])
    })

    it('loadTrackedOcids는 조회된 목록이 null이 아니면 그 목록으로 refresh를 호출한다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1'])
    })

    it('loadTrackedOcids는 조회된 목록이 null이면 refresh를 호출하지 않는다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(null)

      await useBossSchedulerStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(useBossSchedulerStore.getState().trackedOcids).toBeNull()
    })

    it('saveTrackedOcids는 storage에 저장하고 trackedOcids 상태를 갱신한 뒤 그 목록으로 refresh를 호출한다', async () => {
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith('boss', ['ocid-1', 'ocid-2'])
      expect(useBossSchedulerStore.getState().trackedOcids).toEqual(['ocid-1', 'ocid-2'])
      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1', 'ocid-2'])
    })
  })

  describe('ADR-017: 캐릭터 순서 정렬 및 마지막 선택 캐릭터', () => {
    it('실시간 동기화 결과의 캐릭터가 캐시된 레벨 기준 내림차순으로 정렬된다', async () => {
      syncSchedulesMock.mockResolvedValue([
        syncResult({ ocid: 'ocid-1', characterName: '레벨낮음' }),
        syncResult({ ocid: 'ocid-2', characterName: '레벨높음' }),
      ])
      getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => {
        if (ocid === 'ocid-1') {
          return { profile: { name: '레벨낮음', level: 100, imageUrl: '', accessFlag: true }, cachedAt: '' }
        }
        if (ocid === 'ocid-2') {
          return { profile: { name: '레벨높음', level: 200, imageUrl: '', accessFlag: true }, cachedAt: '' }
        }
        return null
      })

      await useBossSchedulerStore.getState().refresh(['ocid-1', 'ocid-2'])

      expect(useBossSchedulerStore.getState().characters.map((character) => character.ocid)).toEqual([
        'ocid-2',
        'ocid-1',
      ])
    })

    it('동레벨인 캐릭터는 compareByName 순서로 정렬된다', async () => {
      syncSchedulesMock.mockResolvedValue([
        syncResult({ ocid: 'ocid-1', characterName: '알파벳Zebra' }),
        syncResult({ ocid: 'ocid-2', characterName: '가나다캐릭터' }),
      ])
      getCachedCharacterBasicMock.mockResolvedValue({
        profile: { name: '', level: 100, imageUrl: '', accessFlag: true },
        cachedAt: '',
      })

      await useBossSchedulerStore.getState().refresh(['ocid-1', 'ocid-2'])

      // compareByName: 한글 > 알파벳 순서라 '가나다캐릭터'(한글)가 먼저 온다
      expect(useBossSchedulerStore.getState().characters.map((character) => character.ocid)).toEqual([
        'ocid-2',
        'ocid-1',
      ])
    })

    it('레벨 캐시가 없는 캐릭터는 정렬 목록 맨 뒤로 간다', async () => {
      syncSchedulesMock.mockResolvedValue([
        syncResult({ ocid: 'ocid-1', characterName: '캐시없음' }),
        syncResult({ ocid: 'ocid-2', characterName: '캐시있음' }),
      ])
      getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => {
        if (ocid === 'ocid-2') {
          return { profile: { name: '캐시있음', level: 1, imageUrl: '', accessFlag: true }, cachedAt: '' }
        }
        return null
      })

      await useBossSchedulerStore.getState().refresh(['ocid-1', 'ocid-2'])

      expect(useBossSchedulerStore.getState().characters.map((character) => character.ocid)).toEqual([
        'ocid-2',
        'ocid-1',
      ])
    })

    it('loadTrackedOcids는 getLastSelectedCharacter("boss") 반환값으로 selectedOcid를 초기화한다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      getLastSelectedCharacterMock.mockResolvedValue('ocid-1')
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().loadTrackedOcids()

      expect(getLastSelectedCharacterMock).toHaveBeenCalledWith('boss')
      expect(useBossSchedulerStore.getState().selectedOcid).toBe('ocid-1')
    })

    it('selectCharacter(ocid)는 selectedOcid 상태를 갱신하고 setLastSelectedCharacter를 호출한다', async () => {
      setLastSelectedCharacterMock.mockResolvedValue(undefined)

      await useBossSchedulerStore.getState().selectCharacter('ocid-9')

      expect(useBossSchedulerStore.getState().selectedOcid).toBe('ocid-9')
      expect(setLastSelectedCharacterMock).toHaveBeenCalledWith('boss', 'ocid-9')
    })
  })
})
