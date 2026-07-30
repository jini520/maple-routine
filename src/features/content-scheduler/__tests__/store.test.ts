import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterScheduleSync } from '../../schedule-sync/schedule-sync'
import type { DailyContent, WeeklyContent } from '../../../types'

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

const { showSuccessMock, showErrorMock } = vi.hoisted(() => ({
  showSuccessMock: vi.fn(),
  showErrorMock: vi.fn(),
}))

const { seedManualTrackedContentMock, trackingModeStateMock } = vi.hoisted(() => ({
  seedManualTrackedContentMock: vi.fn(),
  trackingModeStateMock: { mode: 'auto' as 'auto' | 'manual' },
}))

const { getManualTrackedContentMock, setManualTrackedContentMock } = vi.hoisted(() => ({
  getManualTrackedContentMock: vi.fn(),
  setManualTrackedContentMock: vi.fn(),
}))

// ADR-063: 스토어가 toScheduleSyncError로 원인을 살리므로 그 매핑은 실물을 쓴다(부분 모킹).
vi.mock('../../schedule-sync/schedule-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../schedule-sync/schedule-sync')>()),
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

vi.mock('../../toast/store', () => ({
  useToastStore: {
    getState: () => ({ showSuccess: showSuccessMock, showError: showErrorMock }),
  },
}))

vi.mock('../../tracking-mode/store', () => ({
  useTrackingModeStore: {
    getState: () => ({ mode: trackingModeStateMock.mode }),
  },
}))

vi.mock('../../tracking-mode/seed', () => ({
  seedManualTrackedContent: seedManualTrackedContentMock,
}))

vi.mock('../../../storage/manual-tracked-content', () => ({
  getManualTrackedContent: getManualTrackedContentMock,
  setManualTrackedContent: setManualTrackedContentMock,
}))

import { useContentSchedulerStore, type ContentCharacterView } from '../store'

function dailyContent(name: string): DailyContent {
  return { name, kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 3, questState: null }
}

function weeklyContent(name: string): WeeklyContent {
  return { name, kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 3, questState: null }
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
      dailyContents: [dailyContent('몬스터파크')],
      weeklyContents: [weeklyContent('에픽 던전 : 악몽선경')],
      bossContents: [],
      isDailyStale: false,
      isWeeklyStale: false,
      isWeeklyBossStale: false,
      isMonthlyBossStale: false,
    },
    syncedAt: '2026-07-11T00:00:00.000Z',
    isStale: false,
    error: null,
    ...overrides,
  }
}

beforeEach(() => {
  useContentSchedulerStore.setState({
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    selectedOcid: null,
    manualTrackedByOcid: {},
  })
  getCachedSchedulerStateMock.mockResolvedValue(null)
  getCachedCharacterBasicMock.mockResolvedValue(null)
  getLastSelectedCharacterMock.mockResolvedValue(null)
  trackingModeStateMock.mode = 'auto'
  seedManualTrackedContentMock.mockResolvedValue(undefined)
  getManualTrackedContentMock.mockResolvedValue([])
  setManualTrackedContentMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('useContentSchedulerStore', () => {
  it('초기 상태는 idle이고 캐릭터가 비어있다', () => {
    const state = useContentSchedulerStore.getState()
    expect(state.status).toBe('idle')
    expect(state.characters).toEqual([])
    expect(state.error).toBeNull()
  })

  it('refresh([])는 syncSchedules를 호출하지 않고 곧바로 loaded/빈 배열 상태가 된다', async () => {
    await useContentSchedulerStore.getState().refresh([])

    const state = useContentSchedulerStore.getState()
    expect(syncSchedulesMock).not.toHaveBeenCalled()
    expect(state.status).toBe('loaded')
    expect(state.characters).toEqual([])
    expect(state.error).toBeNull()
  })

  it('refresh(ocids)는 syncSchedules(ocids)를 정확히 그 인자로 호출한다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()])

    await useContentSchedulerStore.getState().refresh(['ocid-1'])

    expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1'], undefined)
  })

  it('모든 캐릭터가 성공하면 status: loaded이고 dailyContents·weeklyContents가 하나의 상태에서 동시에 반영된다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-1', characterName: '캐릭터1' })])

    await useContentSchedulerStore.getState().refresh(['ocid-1'])

    const state = useContentSchedulerStore.getState()
    expect(state.status).toBe('loaded')
    expect(state.error).toBeNull()
    expect(state.characters).toEqual([
      {
        ocid: 'ocid-1',
        characterName: '캐릭터1',
        dailyContents: [dailyContent('몬스터파크')],
        weeklyContents: [weeklyContent('에픽 던전 : 악몽선경')],
        isStale: false,
        syncedAt: '2026-07-11T00:00:00.000Z',
        error: null,
      },
    ])
  })

  it('state가 null인 캐릭터는 dailyContents·weeklyContents를 빈 배열로 채운다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({ state: null, syncedAt: null, isStale: true, error: { kind: 'network' } }),
    ])

    await useContentSchedulerStore.getState().refresh(['ocid-1'])

    const state = useContentSchedulerStore.getState()
    expect(state.status).toBe('loaded')
    expect(state.characters).toEqual([
      {
        ocid: 'ocid-1',
        characterName: '캐릭터-ocid-1',
        dailyContents: [],
        weeklyContents: [],
        isStale: true,
        syncedAt: null,
        error: { kind: 'network' },
      },
    ])
  })

  it('일부 캐릭터만 에러/isStale이 있어도 전체 status는 loaded로 유지되고 그 캐릭터에만 에러가 반영된다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({ ocid: 'ocid-1', characterName: '캐릭터1' }),
      syncResult({
        ocid: 'ocid-2',
        characterName: '캐릭터2',
        state: null,
        syncedAt: null,
        isStale: true,
        error: { kind: 'invalidApiKey' },
      }),
    ])

    await useContentSchedulerStore.getState().refresh(['ocid-1', 'ocid-2'])

    const state = useContentSchedulerStore.getState()
    expect(state.status).toBe('loaded')
    expect(state.error).toBeNull()
    expect(state.characters[0].isStale).toBe(false)
    expect(state.characters[0].error).toBeNull()
    expect(state.characters[1].isStale).toBe(true)
    expect(state.characters[1].error).toEqual({ kind: 'invalidApiKey' })
  })

  it('syncSchedules() 자체가 throw하면 status: error가 되고 characters는 비어있는 상태를 유지한다', async () => {
    syncSchedulesMock.mockRejectedValue(new Error('온보딩이 완료되지 않았습니다'))

    await useContentSchedulerStore.getState().refresh(['ocid-1'])

    const state = useContentSchedulerStore.getState()
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
        dailyContents: [dailyContent('몬스터파크')],
        weeklyContents: [],
        bossContents: [],
      },
      syncedAt: '2026-07-11T00:00:00.000Z',
    })
    syncSchedulesMock.mockImplementation(() => new Promise(() => {})) // 절대 resolve 안 함(재검증 대기 중 상태 관찰용)

    const promise = useContentSchedulerStore.getState().refresh(['ocid-1'])

    await vi.waitFor(() => expect(useContentSchedulerStore.getState().status).toBe('loading'))
    expect(useContentSchedulerStore.getState().characters).toEqual([
      {
        ocid: 'ocid-1',
        characterName: '캐시된캐릭터',
        world: '베라',
        dailyContents: [dailyContent('몬스터파크')],
        weeklyContents: [],
        isStale: true,
        syncedAt: '2026-07-11T00:00:00.000Z',
        error: null,
      },
    ])

    void promise // 이 테스트는 재검증이 끝나길 기다리지 않는다
  })

  it('ADR-016: 재검증 응답이 도착하면 캐시로 채운 값을 새 값으로 덮어쓴다', async () => {
    getCachedSchedulerStateMock.mockResolvedValue({
      state: {
        asOf: '2026-07-11T00:00+09:00',
        characterName: '오래된이름',
        world: '베라',
        level: 200,
        jobClass: '렌',
        dailyContents: [],
        weeklyContents: [],
        bossContents: [],
      },
      syncedAt: '2026-07-10T00:00:00.000Z',
    })
    syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-1', characterName: '최신이름' })])

    await useContentSchedulerStore.getState().refresh(['ocid-1'])

    const state = useContentSchedulerStore.getState()
    expect(state.status).toBe('loaded')
    expect(state.characters[0].characterName).toBe('최신이름')
    expect(state.characters[0].isStale).toBe(false)
  })

  it('refresh 시작 시 status를 loading으로 바꾼다', async () => {
    let resolveSync: (value: CharacterScheduleSync[]) => void = () => {}
    syncSchedulesMock.mockImplementation(
      () =>
        new Promise<CharacterScheduleSync[]>((resolve) => {
          resolveSync = resolve
        }),
    )

    const promise = useContentSchedulerStore.getState().refresh(['ocid-1'])

    await vi.waitFor(() => expect(useContentSchedulerStore.getState().status).toBe('loading'))
    resolveSync([])
    await promise

    expect(useContentSchedulerStore.getState().status).toBe('loaded')
  })

  describe('추적 목록', () => {
    it('loadTrackedOcids는 storage에서 조회한 값을 trackedOcids 상태에 반영한다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useContentSchedulerStore.getState().loadTrackedOcids()

      expect(getTrackedCharacterOcidsMock).toHaveBeenCalledWith()
      expect(useContentSchedulerStore.getState().trackedOcids).toEqual(['ocid-1'])
    })

    it('loadTrackedOcids는 조회된 목록이 null이 아니면 그 목록으로 refresh를 호출한다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useContentSchedulerStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1'], undefined)
    })

    it('loadTrackedOcids는 조회된 목록이 null이면 refresh를 호출하지 않는다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(null)

      await useContentSchedulerStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(useContentSchedulerStore.getState().trackedOcids).toBeNull()
    })

    it('saveTrackedOcids는 storage에 저장하고 trackedOcids 상태를 갱신한 뒤 그 목록으로 refresh를 호출한다', async () => {
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useContentSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith(['ocid-1', 'ocid-2'])
      expect(useContentSchedulerStore.getState().trackedOcids).toEqual(['ocid-1', 'ocid-2'])
      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1', 'ocid-2'], undefined)
    })

    it('saveTrackedOcids가 끝나면 완료 토스트를 띄운다', async () => {
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useContentSchedulerStore.getState().saveTrackedOcids(['ocid-1'])

      expect(showSuccessMock).toHaveBeenCalledWith('캐릭터 정보를 모두 불러왔어요')
      expect(showErrorMock).not.toHaveBeenCalled()
    })

    it('storage 저장이 실패하면 실패 토스트를 띄우고 상태를 바꾸지 않는다(예외를 던지지 않음)', async () => {
      setTrackedCharacterOcidsMock.mockRejectedValue(new Error('disk full'))

      await expect(
        useContentSchedulerStore.getState().saveTrackedOcids(['ocid-1']),
      ).resolves.toBeUndefined()

      expect(showErrorMock).toHaveBeenCalledWith('저장하지 못했습니다')
      expect(showSuccessMock).not.toHaveBeenCalled()
      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(useContentSchedulerStore.getState().trackedOcids).toBeNull()
    })
  })

  describe('ADR-043: 저장 시 추가된 캐릭터만 동기화', () => {
    function characterView(ocid: string, characterName: string): ContentCharacterView {
      return {
        ocid,
        characterName,
        dailyContents: [dailyContent('몬스터파크')],
        weeklyContents: [],
        isStale: false,
        syncedAt: '2026-07-27T00:00:00.000Z',
        error: null,
      }
    }

    beforeEach(() => {
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
    })

    it('선택이 바뀌지 않았으면(순서만 달라도) syncSchedules를 호출하지 않고 목록을 그대로 유지한다', async () => {
      useContentSchedulerStore.setState({
        trackedOcids: ['ocid-1', 'ocid-2'],
        characters: [characterView('ocid-1', '캐릭터1'), characterView('ocid-2', '캐릭터2')],
      })

      await useContentSchedulerStore.getState().saveTrackedOcids(['ocid-2', 'ocid-1'])

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      const state = useContentSchedulerStore.getState()
      expect(state.status).toBe('loaded')
      expect(state.characters.map((character) => character.ocid).sort()).toEqual(['ocid-1', 'ocid-2'])
      expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith(['ocid-2', 'ocid-1'])
    })

    it('제거만 했으면 syncSchedules를 호출하지 않고 남은 캐릭터만 필터링한다', async () => {
      useContentSchedulerStore.setState({
        trackedOcids: ['ocid-1', 'ocid-2'],
        characters: [characterView('ocid-1', '캐릭터1'), characterView('ocid-2', '캐릭터2')],
      })

      await useContentSchedulerStore.getState().saveTrackedOcids(['ocid-1'])

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      const state = useContentSchedulerStore.getState()
      expect(state.status).toBe('loaded')
      expect(state.characters.map((character) => character.ocid)).toEqual(['ocid-1'])
      expect(state.characters[0].characterName).toBe('캐릭터1')
    })

    it('캐릭터를 추가하면 추가된 ocid만 인자로 syncSchedules를 1회 호출하고 유지 캐릭터는 재조회하지 않는다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-2', characterName: '새캐릭터' })])
      useContentSchedulerStore.setState({
        trackedOcids: ['ocid-1'],
        characters: [characterView('ocid-1', '기존캐릭터')],
      })

      await useContentSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-2'], undefined)
      // 유지 캐릭터는 메모리 뷰를 그대로 재사용한다 — 네트워크는 물론 캐시도 다시 읽지 않는다
      expect(getCachedSchedulerStateMock).not.toHaveBeenCalled()

      const state = useContentSchedulerStore.getState()
      expect(state.status).toBe('loaded')
      expect(state.characters.map((character) => character.ocid).sort()).toEqual(['ocid-1', 'ocid-2'])
      expect(state.characters.find((character) => character.ocid === 'ocid-1')?.characterName).toBe(
        '기존캐릭터',
      )
      expect(state.characters.find((character) => character.ocid === 'ocid-2')?.characterName).toBe(
        '새캐릭터',
      )
    })

    it('최초 선택(이전 추적 목록 없음)이면 전원이 추가분이라 전체를 조회한다', async () => {
      syncSchedulesMock.mockResolvedValue([
        syncResult({ ocid: 'ocid-1', characterName: '캐릭터1' }),
        syncResult({ ocid: 'ocid-2', characterName: '캐릭터2' }),
      ])

      await useContentSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1', 'ocid-2'], undefined)
      expect(
        useContentSchedulerStore
          .getState()
          .characters.map((character) => character.ocid)
          .sort(),
      ).toEqual(['ocid-1', 'ocid-2'])
    })

    it('추가와 제거가 함께 일어나도 최종 목록은 정확히 저장한 집합이 된다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-3', characterName: '새캐릭터' })])
      useContentSchedulerStore.setState({
        trackedOcids: ['ocid-1', 'ocid-2'],
        characters: [characterView('ocid-1', '캐릭터1'), characterView('ocid-2', '캐릭터2')],
      })

      await useContentSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-3'])

      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-3'], undefined)
      expect(
        useContentSchedulerStore
          .getState()
          .characters.map((character) => character.ocid)
          .sort(),
      ).toEqual(['ocid-1', 'ocid-3'])
    })

    it('수동 모드에서 캐릭터를 추가하면 시드된 멤버십이 manualTrackedByOcid에 반영된다', async () => {
      trackingModeStateMock.mode = 'manual'
      syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-2', characterName: '새캐릭터' })])
      getManualTrackedContentMock.mockImplementation(async (ocid: string) =>
        ocid === 'ocid-2' ? [{ contentName: '몬스터파크', kind: 'daily' }] : [],
      )
      useContentSchedulerStore.setState({
        trackedOcids: ['ocid-1'],
        characters: [characterView('ocid-1', '기존캐릭터')],
      })

      await useContentSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({
        'ocid-2': [{ contentName: '몬스터파크', kind: 'daily' }],
      })
    })
  })

  describe('ADR-035 결정 14(b): 수동 모드에서 새 추적 캐릭터 개별 시드', () => {
    it('수동 모드에서 saveTrackedOcids는 새로 추가된 캐릭터만 refresh 전에 시드한다', async () => {
      trackingModeStateMock.mode = 'manual'
      useContentSchedulerStore.setState({ trackedOcids: ['ocid-1'] })
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useContentSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(seedManualTrackedContentMock).toHaveBeenCalledTimes(1)
      expect(seedManualTrackedContentMock).toHaveBeenCalledWith('ocid-2')
      // 시드가 refresh(syncSchedules)보다 먼저 실행된다 — 저장 진행률 모달이 시드까지 커버(결정 15)
      expect(seedManualTrackedContentMock.mock.invocationCallOrder[0]).toBeLessThan(
        syncSchedulesMock.mock.invocationCallOrder[0],
      )
    })

    it('수동 모드라도 새로 추가된 캐릭터가 없으면 시드하지 않는다', async () => {
      trackingModeStateMock.mode = 'manual'
      useContentSchedulerStore.setState({ trackedOcids: ['ocid-1', 'ocid-2'] })
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useContentSchedulerStore.getState().saveTrackedOcids(['ocid-1'])

      expect(seedManualTrackedContentMock).not.toHaveBeenCalled()
    })

    it('auto 모드에서는 새 캐릭터가 추가돼도 시드하지 않는다', async () => {
      useContentSchedulerStore.setState({ trackedOcids: ['ocid-1'] })
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useContentSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(seedManualTrackedContentMock).not.toHaveBeenCalled()
    })
  })

  describe('ADR-035: 수동 추적 항목 (manualTrackedContent)', () => {
    it('수동 모드일 때 refresh는 추적 목록을 읽어 manualTrackedByOcid에 채운다', async () => {
      trackingModeStateMock.mode = 'manual'
      syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-1' })])
      getManualTrackedContentMock.mockImplementation(async (ocid: string) =>
        ocid === 'ocid-1' ? [{ contentName: '몬스터파크', kind: 'daily' }] : [],
      )

      await useContentSchedulerStore.getState().refresh(['ocid-1'])

      expect(getManualTrackedContentMock).toHaveBeenCalledWith('ocid-1')
      expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({
        'ocid-1': [{ contentName: '몬스터파크', kind: 'daily' }],
      })
    })

    it('auto 모드에서는 refresh가 추적 목록을 읽지 않고 manualTrackedByOcid는 빈 객체로 둔다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-1' })])

      await useContentSchedulerStore.getState().refresh(['ocid-1'])

      expect(getManualTrackedContentMock).not.toHaveBeenCalled()
      expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({})
    })

    it('addManualContent는 저장소에 멤버십(kind 포함)과 템플릿 max_count를 저장하고 상태를 갱신한다', async () => {
      getManualTrackedContentMock.mockResolvedValue([])

      await useContentSchedulerStore.getState().addManualContent('ocid-1', '몬스터파크', 'daily')

      // '몬스터파크'는 scheduler-content-template.json daily에 max_count 14로 있다
      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
        { contentName: '몬스터파크', kind: 'daily', maxCount: 14 },
      ])
      expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({
        'ocid-1': [{ contentName: '몬스터파크', kind: 'daily', maxCount: 14 }],
      })
    })

    it('addManualContent는 이미 추적 중인 콘텐츠면 중복 추가하지 않는다', async () => {
      getManualTrackedContentMock.mockResolvedValue([{ contentName: '몬스터파크', kind: 'daily', maxCount: 14 }])

      await useContentSchedulerStore.getState().addManualContent('ocid-1', '몬스터파크', 'daily')

      expect(setManualTrackedContentMock).not.toHaveBeenCalled()
    })

    // 가드 테스트용 최소 뷰 — 가드가 보는 건 ocid·guildName뿐이다.
    function guardView(overrides: Partial<ContentCharacterView>): ContentCharacterView {
      return {
        ocid: 'ocid-1',
        characterName: '낟낟',
        dailyContents: [],
        weeklyContents: [],
        isStale: false,
        syncedAt: null,
        error: null,
        ...overrides,
      }
    }

    // ADR-057: 가드의 본체는 스토어다 — UI 사전 차단만으로는 다른 호출 경로가 샌다.
    it('addManualContent는 길드 미가입(guildName: null)이면 길드 콘텐츠를 거부한다', async () => {
      useContentSchedulerStore.setState({
        characters: [guardView({ guildName: null })],
      })

      const result = await useContentSchedulerStore.getState().addManualContent('ocid-1', '[길드] 지하 수로', 'weekly')

      expect(result).toBe('guildRequired')
      expect(setManualTrackedContentMock).not.toHaveBeenCalled()
    })

    it('addManualContent는 길드 정보를 모르면(guildName: undefined) 길드 콘텐츠를 통과시킨다', async () => {
      useContentSchedulerStore.setState({
        characters: [guardView({ guildName: undefined })],
      })

      const result = await useContentSchedulerStore.getState().addManualContent('ocid-1', '[길드] 지하 수로', 'weekly')

      expect(result).toBe('added')
      expect(setManualTrackedContentMock).toHaveBeenCalled()
    })

    it('addManualContent는 길드 미가입이어도 길드 외 콘텐츠는 통과시킨다', async () => {
      useContentSchedulerStore.setState({
        characters: [guardView({ guildName: null })],
      })

      const result = await useContentSchedulerStore.getState().addManualContent('ocid-1', '무릉도장', 'weekly')

      expect(result).toBe('added')
    })

    it('removeManualContent는 해당 (kind, 이름) 항목만 제거하고 다른 kind(boss)·다른 이름은 보존한다', async () => {
      getManualTrackedContentMock.mockResolvedValue([
        { contentName: '몬스터파크', kind: 'daily', maxCount: 14 },
        { contentName: '무릉도장', kind: 'weekly' },
        { contentName: '몬스터파크', kind: 'boss', difficulty: '하드' },
      ])

      await useContentSchedulerStore.getState().removeManualContent('ocid-1', '몬스터파크', 'daily')

      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
        { contentName: '무릉도장', kind: 'weekly' },
        { contentName: '몬스터파크', kind: 'boss', difficulty: '하드' },
      ])
      expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({
        'ocid-1': [
          { contentName: '무릉도장', kind: 'weekly' },
          { contentName: '몬스터파크', kind: 'boss', difficulty: '하드' },
        ],
      })
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

      await useContentSchedulerStore.getState().refresh(['ocid-1', 'ocid-2'])

      expect(useContentSchedulerStore.getState().characters.map((character) => character.ocid)).toEqual([
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

      await useContentSchedulerStore.getState().refresh(['ocid-1', 'ocid-2'])

      // compareByName: 한글 > 알파벳 순서라 '가나다캐릭터'(한글)가 먼저 온다
      expect(useContentSchedulerStore.getState().characters.map((character) => character.ocid)).toEqual([
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

      await useContentSchedulerStore.getState().refresh(['ocid-1', 'ocid-2'])

      expect(useContentSchedulerStore.getState().characters.map((character) => character.ocid)).toEqual([
        'ocid-2',
        'ocid-1',
      ])
    })

    it('loadTrackedOcids는 getLastSelectedCharacter() 반환값으로 selectedOcid를 초기화한다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      getLastSelectedCharacterMock.mockResolvedValue('ocid-1')
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useContentSchedulerStore.getState().loadTrackedOcids()

      expect(getLastSelectedCharacterMock).toHaveBeenCalledWith()
      expect(useContentSchedulerStore.getState().selectedOcid).toBe('ocid-1')
    })

    it('selectCharacter(ocid)는 selectedOcid 상태를 갱신하고 setLastSelectedCharacter를 호출한다', async () => {
      setLastSelectedCharacterMock.mockResolvedValue(undefined)

      await useContentSchedulerStore.getState().selectCharacter('ocid-9')

      expect(useContentSchedulerStore.getState().selectedOcid).toBe('ocid-9')
      expect(setLastSelectedCharacterMock).toHaveBeenCalledWith('ocid-9')
    })
  })
})
