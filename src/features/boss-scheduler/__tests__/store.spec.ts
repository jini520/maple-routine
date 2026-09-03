
import { useCharacterSelectionStore } from '../../character-selection/store'
import { waitFor } from '../../../__tests__/wait-for'
import { matchBossContent } from '../../../lib/boss/boss-matching'
import type { CharacterScheduleSync } from '../../schedule-sync/schedule-sync'
import type { BossContent } from '../../../types'

// 스토어가 toScheduleSyncError로 원인을 살리므로 그 매핑은 실물을 쓴다(부분 모킹).
jest.mock('../../schedule-sync/schedule-sync', () => ({
  ...jest.requireActual<typeof import('../../schedule-sync/schedule-sync')>('../../schedule-sync/schedule-sync'),
  syncSchedules: jest.fn(),
}))
const { syncSchedules: syncSchedulesMock } = jest.requireMock('../../schedule-sync/schedule-sync') as Record<string, jest.Mock>

jest.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: jest.fn(),
  setTrackedCharacterOcids: jest.fn(),
  getLastSelectedCharacter: jest.fn(),
  setLastSelectedCharacter: jest.fn(),
}))
const { getTrackedCharacterOcids: getTrackedCharacterOcidsMock, setTrackedCharacterOcids: setTrackedCharacterOcidsMock, getLastSelectedCharacter: getLastSelectedCharacterMock } = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>

jest.mock('../../../storage/scheduler-cache', () => ({
  getCachedSchedulerState: jest.fn(),
}))
const { getCachedSchedulerState: getCachedSchedulerStateMock } = jest.requireMock('../../../storage/scheduler-cache') as Record<string, jest.Mock>

jest.mock('../../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: jest.fn(),
}))
const { getCachedCharacterBasic: getCachedCharacterBasicMock } = jest.requireMock('../../../storage/character-basic-cache') as Record<string, jest.Mock>

jest.mock('../../../storage/boss-party-settings', () => ({
  getBossPartySettings: jest.fn(),
  setBossPartySize: jest.fn(),
}))
const { getBossPartySettings: getBossPartySettingsMock, setBossPartySize: setBossPartySizeMock } = jest.requireMock('../../../storage/boss-party-settings') as Record<string, jest.Mock>

jest.mock('../../toast/store', () => {
  const showSuccess = jest.fn()
  const showError = jest.fn()
  return { useToastStore: { getState: () => ({ showSuccess, showError }) } }
})
const showSuccessMock = jest.requireMock('../../toast/store').useToastStore.getState().showSuccess as jest.Mock
const showErrorMock = jest.requireMock('../../toast/store').useToastStore.getState().showError as jest.Mock

jest.mock('../../tracking-mode/store', () => {

  return { useTrackingModeStore: { getState: () => {
      mockTrackingModeStateMock = mockTrackingModeStateMock ?? { mode: 'auto' }
      return {  mode: mockTrackingModeStateMock.mode  }
    } } }
})

jest.mock('../../tracking-mode/seed', () => ({
  seedManualTrackedContent: jest.fn(),
}))
const { seedManualTrackedContent: seedManualTrackedContentMock } = jest.requireMock('../../tracking-mode/seed') as Record<string, jest.Mock>

jest.mock('../../../storage/manual-tracked-content', () => ({
  getManualTrackedContent: jest.fn(),
  setManualTrackedContent: jest.fn(),
}))
// 테스트가 이 값에 직접 쓰므로 모듈 평가 시점에도 채워 둔다(팩토리도 같은 걸 쓴다).

const { getManualTrackedContent: getManualTrackedContentMock, setManualTrackedContent: setManualTrackedContentMock } = jest.requireMock('../../../storage/manual-tracked-content') as Record<string, jest.Mock>

import { useBossSchedulerStore, type BossCharacterView } from '../store'
import {
  markSyncAttemptedThisRun,
  resetSyncRunStateForTests,
} from '../../schedule-sync/sync-run-state'
import type { ManualTrackedItem } from '../../../storage/manual-tracked-content'

// 팩토리가 **모듈 평가보다 먼저** 불릴 수 있어(스토어를 import 하는 순간) `var` 로 올리고
// 읽는 자리에서 채운다.
var mockTrackingModeStateMock: { mode: 'auto' | 'manual' } = { mode: 'auto' }

function bossContent(overrides: Partial<BossContent> = {}): BossContent {
  const merged = {
    name: '자쿰',
    difficulty: '카오스' as const,
    cycle: 'weekly' as const,
    isRegistered: true,
    isComplete: false,
    ...overrides,
  }
  return { ...merged, ownComplete: overrides.ownComplete ?? merged.isComplete }
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
  useCharacterSelectionStore.setState({ selectedOcid: null })
  useBossSchedulerStore.setState({
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    partySizes: {},
    manualTrackedByOcid: {},
    partyFilter: 'all',
  })
  getCachedSchedulerStateMock.mockResolvedValue(null)
  getCachedCharacterBasicMock.mockResolvedValue(null)
  getLastSelectedCharacterMock.mockResolvedValue(null)
  getBossPartySettingsMock.mockResolvedValue([])
  mockTrackingModeStateMock.mode = 'auto'
  seedManualTrackedContentMock.mockResolvedValue(undefined)
  getManualTrackedContentMock.mockResolvedValue([])
  setManualTrackedContentMock.mockResolvedValue(undefined)
  // 모듈 수준 플래그라 테스트끼리 오염된다. 매번 "앱 재시작 직후" 상태에서 시작한다.
  resetSyncRunStateForTests()
})

afterEach(() => {
  jest.resetAllMocks()
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

    expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1'], undefined)
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
        ownComplete: false,
        matchedBossName: '자쿰',
        portraitSlug: 'zakum',
        isSeasonBoss: false,
      },
    ])
    expect(state.characters[0].monthlyBosses).toEqual([
      {
        apiName: '검은 마법사',
        difficulty: '카오스',
        cycle: 'monthly',
        isRegistered: true,
        isComplete: false,
        ownComplete: false,
        matchedBossName: '검은마법사',
        portraitSlug: 'blackMage',
        isSeasonBoss: false,
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

  it('모든 캐릭터가 성공하면 status: loaded이고 클리어 카운트를 직접 계산한다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        ocid: 'ocid-1',
        characterName: '캐릭터1',
        state: { ...syncResult().state!, bossContents: [bossContent({ isComplete: true })] },
      }),
    ])

    await useBossSchedulerStore.getState().refresh(['ocid-1'])

    const state = useBossSchedulerStore.getState()
    expect(state.status).toBe('loaded')
    expect(state.error).toBeNull()
    expect(state.characters[0].weeklyBossClearCount).toBe(1)
    expect(state.characters[0].weeklyBossClearLimitCount).toBe(12)
  })

  describe(': 주간 처치 카운트 자체 계산', () => {
    it('등록 없이 완료된 보스도 카운트에 포함된다', async () => {
      syncSchedulesMock.mockResolvedValue([
        syncResult({
          state: {
            ...syncResult().state!,
            bossContents: [bossContent({ name: '자쿰', isRegistered: false, isComplete: true })],
          },
        }),
      ])

      await useBossSchedulerStore.getState().refresh(['ocid-1'])

      expect(useBossSchedulerStore.getState().characters[0].weeklyBossClearCount).toBe(1)
    })

    it('시즌 보스(메이린)는 완료돼도 카운트에서 제외된다', async () => {
      syncSchedulesMock.mockResolvedValue([
        syncResult({
          state: {
            ...syncResult().state!,
            bossContents: [
              bossContent({ name: '자쿰', isComplete: true }),
              bossContent({ name: '시즌 보스 메이린', difficulty: '노멀', isComplete: true }),
            ],
          },
        }),
      ])

      await useBossSchedulerStore.getState().refresh(['ocid-1'])

      expect(useBossSchedulerStore.getState().characters[0].weeklyBossClearCount).toBe(1)
    })

    it('weeklyBossClearLimitCount는 API 응답과 무관하게 항상 12다', async () => {
      syncSchedulesMock.mockResolvedValue([
        syncResult({ state: { ...syncResult().state!, bossContents: [] } }),
      ])

      await useBossSchedulerStore.getState().refresh(['ocid-1'])

      expect(useBossSchedulerStore.getState().characters[0].weeklyBossClearLimitCount).toBe(12)
    })

    it('캐시된 값을 표시할 때도 카운트를 직접 계산한다(캐시 우선 표시)', async () => {
      getCachedSchedulerStateMock.mockResolvedValue({
        state: {
          asOf: '2026-07-11T00:00+09:00',
          characterName: '캐시된캐릭터',
          world: '베라',
          level: 200,
          jobClass: '렌',
          dailyContents: [],
          weeklyContents: [],
          bossContents: [bossContent({ isComplete: true })],
          isDailyStale: false,
          isWeeklyStale: false,
          isWeeklyBossStale: false,
          isMonthlyBossStale: false,
        },
        syncedAt: '2026-07-11T00:00:00.000Z',
      })
      syncSchedulesMock.mockImplementation(() => new Promise(() => {}))

      const promise = useBossSchedulerStore.getState().refresh(['ocid-1'])

      await waitFor(() => expect(useBossSchedulerStore.getState().status).toBe('loading'))
      const state = useBossSchedulerStore.getState()
      expect(state.characters[0].weeklyBossClearCount).toBe(1)
      expect(state.characters[0].weeklyBossClearLimitCount).toBe(12)

      void promise
    })
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
        // 캐시가 그 캐릭터를 모르면 둘 다 `null` 이다.
        level: null,
        imageUrl: null,
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

  it(': 캐시된 값이 있으면 재검증 응답을 기다리지 않고 즉시 characters에 반영한다', async () => {
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
        isDailyStale: false,
        isWeeklyStale: false,
        isWeeklyBossStale: false,
        isMonthlyBossStale: false,
      },
      syncedAt: '2026-07-11T00:00:00.000Z',
    })
    syncSchedulesMock.mockImplementation(() => new Promise(() => {})) // 절대 resolve 안 함(재검증 대기 중 상태 관찰용)

    const promise = useBossSchedulerStore.getState().refresh(['ocid-1'])

    await waitFor(() => expect(useBossSchedulerStore.getState().status).toBe('loading'))
    const state = useBossSchedulerStore.getState()
    expect(state.characters[0].characterName).toBe('캐시된캐릭터')
    expect(state.characters[0].world).toBe('베라')
    expect(state.characters[0].isStale).toBe(true)
    expect(state.characters[0].weeklyBosses).toHaveLength(1)

    void promise // 이 테스트는 재검증이 끝나길 기다리지 않는다
  })

  it('파티 설정 조회(loadPartySizes)가 실패해도 refresh는 reject 없이 스케줄을 반영한다', async () => {
    getBossPartySettingsMock.mockRejectedValue(new Error('sqlite fail'))
    syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-1', characterName: '캐릭터1' })])

    await useBossSchedulerStore.getState().refresh(['ocid-1'])

    expect(useBossSchedulerStore.getState().status).toBe('loaded')
    expect(useBossSchedulerStore.getState().characters).toHaveLength(1)
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

    await waitFor(() => expect(useBossSchedulerStore.getState().status).toBe('loading'))
    resolveSync([])
    await promise

    expect(useBossSchedulerStore.getState().status).toBe('loaded')
  })

  describe('추적 목록', () => {
    it('loadTrackedOcids는 storage에서 조회한 값을 trackedOcids 상태에 반영한다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().loadTrackedOcids()

      expect(getTrackedCharacterOcidsMock).toHaveBeenCalledWith()
      expect(useBossSchedulerStore.getState().trackedOcids).toEqual(['ocid-1'])
    })

    it('loadTrackedOcids는 조회된 목록이 null이 아니면 그 목록으로 refresh를 호출한다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1'], undefined)
    })

    it('loadTrackedOcids는 조회된 목록이 null이면 refresh를 호출하지 않는다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(null)

      await useBossSchedulerStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(useBossSchedulerStore.getState().trackedOcids).toBeNull()
    })

    // 부팅 선하이드레이션과 화면 마운트가 반드시 겹치므로, 동시 호출은
    // 한 회차로 합친다. 안 그러면 같은 응답을 두 번 받는다(없애려던 낭비).
    it('loadTrackedOcids를 동시에 두 번 불러도 한 회차만 돈다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await Promise.all([
        useBossSchedulerStore.getState().loadTrackedOcids(),
        useBossSchedulerStore.getState().loadTrackedOcids(),
      ])

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
    })

    // "평생 한 번"이 아니라 "동시에 하나만"이다. 영구 메모면 진입 재조회의 10분 TTL 이 죽는다.
    it('앞 회차가 끝난 뒤에 부르면 다시 돈다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().loadTrackedOcids()
      await useBossSchedulerStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).toHaveBeenCalledTimes(2)
    })

    it('saveTrackedOcids는 storage에 저장하고 trackedOcids 상태를 갱신한 뒤 그 목록으로 refresh를 호출한다', async () => {
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith(['ocid-1', 'ocid-2'])
      expect(useBossSchedulerStore.getState().trackedOcids).toEqual(['ocid-1', 'ocid-2'])
      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1', 'ocid-2'], undefined)
    })

    it('saveTrackedOcids가 끝나면 완료 토스트를 띄운다', async () => {
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1'])

      expect(showSuccessMock).toHaveBeenCalledWith('캐릭터 정보를 모두 불러왔어요')
      expect(showErrorMock).not.toHaveBeenCalled()
    })

    it('storage 저장이 실패하면 실패 토스트를 띄우고 상태를 바꾸지 않는다(예외를 던지지 않음)', async () => {
      setTrackedCharacterOcidsMock.mockRejectedValue(new Error('disk full'))

      await expect(useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1'])).resolves.toBeUndefined()

      expect(showErrorMock).toHaveBeenCalledWith('저장하지 못했습니다')
      expect(showSuccessMock).not.toHaveBeenCalled()
      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(useBossSchedulerStore.getState().trackedOcids).toBeNull()
    })
  })

  describe(': 저장 시 추가된 캐릭터만 동기화', () => {
    function characterView(ocid: string, characterName: string): BossCharacterView {
      return {
        ocid,
        characterName,
        weeklyBosses: [matchBossContent(bossContent({ isComplete: true, ownComplete: true }))],
        monthlyBosses: [],
        weeklyBossClearCount: 1,
        weeklyBossClearLimitCount: 12,
        isStale: false,
        syncedAt: '2026-07-27T00:00:00.000Z',
        error: null,
      }
    }

    beforeEach(() => {
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
    })

    it('선택이 바뀌지 않았으면(순서만 달라도) syncSchedules를 호출하지 않고 목록을 그대로 유지한다', async () => {
      useBossSchedulerStore.setState({
        trackedOcids: ['ocid-1', 'ocid-2'],
        characters: [characterView('ocid-1', '캐릭터1'), characterView('ocid-2', '캐릭터2')],
      })

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-2', 'ocid-1'])

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      const state = useBossSchedulerStore.getState()
      expect(state.status).toBe('loaded')
      expect(state.characters.map((character) => character.ocid).sort()).toEqual(['ocid-1', 'ocid-2'])
      expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith(['ocid-2', 'ocid-1'])
    })

    it('제거만 했으면 syncSchedules를 호출하지 않고 남은 캐릭터만 필터링한다', async () => {
      useBossSchedulerStore.setState({
        trackedOcids: ['ocid-1', 'ocid-2'],
        characters: [characterView('ocid-1', '캐릭터1'), characterView('ocid-2', '캐릭터2')],
      })

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1'])

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      const state = useBossSchedulerStore.getState()
      expect(state.status).toBe('loaded')
      expect(state.characters.map((character) => character.ocid)).toEqual(['ocid-1'])
      expect(state.characters[0].characterName).toBe('캐릭터1')
    })

    it('캐릭터를 추가하면 추가된 ocid만 인자로 syncSchedules를 1회 호출하고 유지 캐릭터는 재조회하지 않는다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-2', characterName: '새캐릭터' })])
      useBossSchedulerStore.setState({
        trackedOcids: ['ocid-1'],
        characters: [characterView('ocid-1', '기존캐릭터')],
      })

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-2'], undefined)
      // 유지 캐릭터는 메모리 뷰를 그대로 재사용한다. 네트워크는 물론 캐시도 다시 읽지 않는다
      expect(getCachedSchedulerStateMock).not.toHaveBeenCalled()

      const state = useBossSchedulerStore.getState()
      expect(state.status).toBe('loaded')
      expect(state.characters.map((character) => character.ocid).sort()).toEqual(['ocid-1', 'ocid-2'])
      expect(state.characters.find((character) => character.ocid === 'ocid-2')?.characterName).toBe(
        '새캐릭터',
      )
    })

    it('유지 캐릭터의 보스 목록·클리어 카운트가 재조회 없이 그대로 보존된다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-2', characterName: '새캐릭터' })])
      const kept = characterView('ocid-1', '기존캐릭터')
      useBossSchedulerStore.setState({ trackedOcids: ['ocid-1'], characters: [kept] })

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      const restored = useBossSchedulerStore
        .getState()
        .characters.find((character) => character.ocid === 'ocid-1')
      // 보스 목록·클리어 카운트는 손대지 않는다. `level`·`imageUrl` 만 정렬 단계가 캐시에서 다시
      // 찍는다. 여기 목에는 캐시가 없어 둘 다 `null` 이다.
      expect(restored).toEqual({ ...kept, level: null, imageUrl: null })
    })

    it('최초 선택(이전 추적 목록 없음)이면 전원이 추가분이라 전체를 조회한다', async () => {
      syncSchedulesMock.mockResolvedValue([
        syncResult({ ocid: 'ocid-1', characterName: '캐릭터1' }),
        syncResult({ ocid: 'ocid-2', characterName: '캐릭터2' }),
      ])

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1', 'ocid-2'], undefined)
      expect(
        useBossSchedulerStore
          .getState()
          .characters.map((character) => character.ocid)
          .sort(),
      ).toEqual(['ocid-1', 'ocid-2'])
    })

    it('추가와 제거가 함께 일어나도 최종 목록은 정확히 저장한 집합이 된다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-3', characterName: '새캐릭터' })])
      useBossSchedulerStore.setState({
        trackedOcids: ['ocid-1', 'ocid-2'],
        characters: [characterView('ocid-1', '캐릭터1'), characterView('ocid-2', '캐릭터2')],
      })

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-3'])

      expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-3'], undefined)
      expect(
        useBossSchedulerStore
          .getState()
          .characters.map((character) => character.ocid)
          .sort(),
      ).toEqual(['ocid-1', 'ocid-3'])
    })

    it('파티 설정은 동기화를 건너뛰어도 최종 집합 기준으로 다시 채워진다(로컬 조회)', async () => {
      getBossPartySettingsMock.mockResolvedValue([
        { ocid: 'ocid-1', boss: '자쿰', difficulty: '카오스', partySize: 4, updatedAt: '2026-07-27T00:00:00.000Z' },
      ])
      useBossSchedulerStore.setState({
        trackedOcids: ['ocid-1', 'ocid-2'],
        characters: [characterView('ocid-1', '캐릭터1'), characterView('ocid-2', '캐릭터2')],
      })

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1'])

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(getBossPartySettingsMock).toHaveBeenCalledWith(['ocid-1'])
      expect(useBossSchedulerStore.getState().partySizes).toEqual({ 'ocid-1:자쿰:카오스': 4 })
    })

    it('수동 모드에서 캐릭터를 추가하면 시드된 멤버십이 manualTrackedByOcid에 반영된다', async () => {
      mockTrackingModeStateMock.mode = 'manual'
      syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-2', characterName: '새캐릭터' })])
      getManualTrackedContentMock.mockImplementation(async (ocid: string) =>
        ocid === 'ocid-2' ? [{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }] : [],
      )
      useBossSchedulerStore.setState({
        trackedOcids: ['ocid-1'],
        characters: [characterView('ocid-1', '기존캐릭터')],
      })

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(useBossSchedulerStore.getState().manualTrackedByOcid).toEqual({
        'ocid-2': [{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }],
      })
    })
  })

  describe('(b): 수동 모드에서 새 추적 캐릭터 개별 시드', () => {
    it('수동 모드에서 saveTrackedOcids는 새로 추가된 캐릭터만 refresh 전에 시드한다', async () => {
      mockTrackingModeStateMock.mode = 'manual'
      useBossSchedulerStore.setState({ trackedOcids: ['ocid-1'] })
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(seedManualTrackedContentMock).toHaveBeenCalledTimes(1)
      expect(seedManualTrackedContentMock).toHaveBeenCalledWith(['ocid-2'])
      // 시드가 refresh(syncSchedules)보다 먼저 실행된다. 저장 진행률 모달이 시드까지 커버
      expect(seedManualTrackedContentMock.mock.invocationCallOrder[0]).toBeLessThan(
        syncSchedulesMock.mock.invocationCallOrder[0],
      )
    })

    it('수동 모드라도 새로 추가된 캐릭터가 없으면 시드하지 않는다', async () => {
      mockTrackingModeStateMock.mode = 'manual'
      useBossSchedulerStore.setState({ trackedOcids: ['ocid-1', 'ocid-2'] })
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1'])

      expect(seedManualTrackedContentMock).not.toHaveBeenCalled()
    })

    it('auto 모드에서는 새 캐릭터가 추가돼도 시드하지 않는다', async () => {
      useBossSchedulerStore.setState({ trackedOcids: ['ocid-1'] })
      setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().saveTrackedOcids(['ocid-1', 'ocid-2'])

      expect(seedManualTrackedContentMock).not.toHaveBeenCalled()
    })
  })

  describe(': 수동 추적 보스 (manualTrackedContent)', () => {
    it('수동 모드일 때 refresh는 추적 목록을 읽어 manualTrackedByOcid에 채운다', async () => {
      mockTrackingModeStateMock.mode = 'manual'
      syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-1' })])
      getManualTrackedContentMock.mockImplementation(async (ocid: string) =>
        ocid === 'ocid-1' ? [{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }] : [],
      )

      await useBossSchedulerStore.getState().refresh(['ocid-1'])

      expect(getManualTrackedContentMock).toHaveBeenCalledWith('ocid-1')
      expect(useBossSchedulerStore.getState().manualTrackedByOcid).toEqual({
        'ocid-1': [{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }],
      })
    })

    it('auto 모드에서는 refresh가 추적 목록을 읽지 않고 manualTrackedByOcid는 빈 객체로 둔다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-1' })])

      await useBossSchedulerStore.getState().refresh(['ocid-1'])

      expect(getManualTrackedContentMock).not.toHaveBeenCalled()
      expect(useBossSchedulerStore.getState().manualTrackedByOcid).toEqual({})
    })

    it('addManualBoss는 저장소에 (보스, 난이도) 멤버십을 저장하고 상태를 갱신한다 (maxCount 없음)', async () => {
      getManualTrackedContentMock.mockResolvedValue([])

      await useBossSchedulerStore.getState().addManualBoss('ocid-1', '자쿰', '카오스')

      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
        { contentName: '자쿰', kind: 'boss', difficulty: '카오스' },
      ])
      expect(useBossSchedulerStore.getState().manualTrackedByOcid).toEqual({
        'ocid-1': [{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }],
      })
    })

    it('addManualBoss는 이미 추적 중인 (보스, 난이도)면 중복 추가하지 않는다', async () => {
      getManualTrackedContentMock.mockResolvedValue([{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }])

      await useBossSchedulerStore.getState().addManualBoss('ocid-1', '자쿰', '카오스')

      expect(setManualTrackedContentMock).not.toHaveBeenCalled()
    })

    it('addManualBoss는 같은 보스의 다른 난이도는 별개 항목으로 추가한다', async () => {
      getManualTrackedContentMock.mockResolvedValue([{ contentName: '루시드', kind: 'boss', difficulty: '이지' }])

      await useBossSchedulerStore.getState().addManualBoss('ocid-1', '루시드', '하드')

      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
        { contentName: '루시드', kind: 'boss', difficulty: '이지' },
        { contentName: '루시드', kind: 'boss', difficulty: '하드' },
      ])
    })

    // weekly-bosses.json의 주간 보스 12종(시즌 보스 제외). 12개 한도를 채우는 데 쓴다.
    const WEEKLY_BOSS_NAMES = [
      '자쿰',
      '매그너스',
      '파풀라투스',
      '반반',
      '피에르',
      '블러디 퀸',
      '벨룸',
      '스우',
      '데미안',
      '가디언 엔젤 슬라임',
      '루시드',
      '윌',
    ]

    // 난이도 교체는 remove → add 2단계가 아니라 단일 액션이다.
    // 2단계는 커밋이 2회라 첫 커밋 직후 "그 보스가 목록에 없는" 상태가 저장소에 실재했고,
    // 두 번째가 실패하면 보스가 통째로 사라졌다.
    describe('setManualBossDifficulty', () => {
      it('쓰기 1회로 난이도를 교체한다. 중간 상태(보스가 빠진 배열)를 저장하지 않는다', async () => {
        getManualTrackedContentMock.mockResolvedValue([
          { contentName: '스우', kind: 'boss', difficulty: '하드' },
          { contentName: '무릉도장', kind: 'weekly' },
        ])

        await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', '스우', '익스트림')

        expect(setManualTrackedContentMock).toHaveBeenCalledTimes(1)
        expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
          { contentName: '스우', kind: 'boss', difficulty: '익스트림' },
          { contentName: '무릉도장', kind: 'weekly' },
        ])
      })

      it('제자리에서 교체해 배열 순서를 유지한다 (끝으로 밀지 않는다)', async () => {
        getManualTrackedContentMock.mockResolvedValue([
          { contentName: '스우', kind: 'boss', difficulty: '하드' },
          { contentName: '루시드', kind: 'boss', difficulty: '노멀' },
        ])

        await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', '스우', '익스트림')

        expect(setManualTrackedContentMock.mock.calls[0][1].map((item: ManualTrackedItem) => item.contentName)).toEqual([
          '스우',
          '루시드',
        ])
      })

      it('저장이 실패하면 스토어 상태를 바꾸지 않는다 (롤백이 필요 없다)', async () => {
        getManualTrackedContentMock.mockResolvedValue([{ contentName: '스우', kind: 'boss', difficulty: '하드' }])
        setManualTrackedContentMock.mockRejectedValueOnce(new Error('write failed'))

        await expect(
          useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', '스우', '익스트림'),
        ).rejects.toThrow()

        expect(useBossSchedulerStore.getState().manualTrackedByOcid['ocid-1']).toBeUndefined()
      })

      it('같은 보스가 두 난이도로 저장돼 있으면 하나로 수렴시킨다', async () => {
        getManualTrackedContentMock.mockResolvedValue([
          { contentName: '스우', kind: 'boss', difficulty: '하드' },
          { contentName: '스우', kind: 'boss', difficulty: '노멀' },
        ])

        await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', '스우', '익스트림')

        expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
          { contentName: '스우', kind: 'boss', difficulty: '익스트림' },
        ])
      })

      it('추적 중이 아닌 보스면 아무것도 쓰지 않는다', async () => {
        getManualTrackedContentMock.mockResolvedValue([{ contentName: '루시드', kind: 'boss', difficulty: '노멀' }])

        await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', '스우', '익스트림')

        expect(setManualTrackedContentMock).not.toHaveBeenCalled()
      })

      it('같은 이름의 컨텐츠(kind가 boss가 아닌 항목)는 건드리지 않는다', async () => {
        getManualTrackedContentMock.mockResolvedValue([
          { contentName: '스우', kind: 'weekly' },
          { contentName: '스우', kind: 'boss', difficulty: '하드' },
        ])

        await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', '스우', '익스트림')

        expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
          { contentName: '스우', kind: 'weekly' },
          { contentName: '스우', kind: 'boss', difficulty: '익스트림' },
        ])
      })

      // 개수가 안 변하므로 주간 12개 한도에 원리적으로 걸리지 않는다.
      it('주간 12개가 찬 상태에서도 난이도를 바꿀 수 있다', async () => {
        const twelve = Array.from({ length: 12 }, (_, index) => ({
          contentName: WEEKLY_BOSS_NAMES[index],
          kind: 'boss' as const,
          difficulty: '노멀',
        }))
        getManualTrackedContentMock.mockResolvedValue(twelve)

        await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', WEEKLY_BOSS_NAMES[0], '하드')

        expect(setManualTrackedContentMock).toHaveBeenCalledTimes(1)
        expect(setManualTrackedContentMock.mock.calls[0][1]).toHaveLength(12)
        expect(setManualTrackedContentMock.mock.calls[0][1][0]).toEqual({
          contentName: WEEKLY_BOSS_NAMES[0],
          kind: 'boss',
          difficulty: '하드',
        })
      })
    })

    it('removeManualBoss는 해당 (보스, 난이도)만 제거하고 다른 난이도·다른 kind는 보존한다', async () => {
      getManualTrackedContentMock.mockResolvedValue([
        { contentName: '루시드', kind: 'boss', difficulty: '이지' },
        { contentName: '루시드', kind: 'boss', difficulty: '하드' },
        { contentName: '무릉도장', kind: 'weekly' },
      ])

      await useBossSchedulerStore.getState().removeManualBoss('ocid-1', '루시드', '이지')

      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
        { contentName: '루시드', kind: 'boss', difficulty: '하드' },
        { contentName: '무릉도장', kind: 'weekly' },
      ])
      expect(useBossSchedulerStore.getState().manualTrackedByOcid).toEqual({
        'ocid-1': [
          { contentName: '루시드', kind: 'boss', difficulty: '하드' },
          { contentName: '무릉도장', kind: 'weekly' },
        ],
      })
    })
  })

  // 결정 2·3: 한도 가드의 본체는 스토어다. UI에서만 막으면 난이도 교체·시드
  // 같은 다른 호출 경로가 그대로 새어나간다.
  describe(': 수동 주간 보스 12개 한도', () => {
    // weekly-bosses.json 주간 섹션 앞부분 12종. 실재하는 이름이어야 주기·시즌 판정이 통한다.
    const TWELVE_WEEKLY_BOSSES = [
      '자쿰',
      '매그너스',
      '파풀라투스',
      '반반',
      '피에르',
      '블러디 퀸',
      '벨룸',
      '스우',
      '데미안',
      '가디언 엔젤 슬라임',
      '루시드',
      '윌',
    ]

    function trackedBosses(bossNames: string[]): ManualTrackedItem[] {
      return bossNames.map((contentName) => ({ contentName, kind: 'boss' as const, difficulty: '노멀' }))
    }

    it('한도(12)에 도달하면 저장하지 않고 limitReached를 반환한다', async () => {
      getManualTrackedContentMock.mockResolvedValue(trackedBosses(TWELVE_WEEKLY_BOSSES))

      const result = await useBossSchedulerStore.getState().addManualBoss('ocid-1', '더스크', '노멀')

      expect(result).toBe('limitReached')
      expect(setManualTrackedContentMock).not.toHaveBeenCalled()
    })

    it('한도 직전(11)이면 정상 추가한다', async () => {
      getManualTrackedContentMock.mockResolvedValue(trackedBosses(TWELVE_WEEKLY_BOSSES.slice(0, 11)))

      const result = await useBossSchedulerStore.getState().addManualBoss('ocid-1', '더스크', '노멀')

      expect(result).toBe('added')
      expect(setManualTrackedContentMock).toHaveBeenCalled()
    })

    it('시즌 보스(메이린)는 한도가 찼어도 추가할 수 있다. 처치 카운트 제외 규칙과 동일', async () => {
      getManualTrackedContentMock.mockResolvedValue(trackedBosses(TWELVE_WEEKLY_BOSSES))

      const result = await useBossSchedulerStore.getState().addManualBoss('ocid-1', '시즌 보스 메이린', '노멀')

      expect(result).toBe('added')
      expect(setManualTrackedContentMock).toHaveBeenCalled()
    })

    it('월간 보스(검은마법사)는 한도가 찼어도 추가할 수 있다. 12는 주간 한도다', async () => {
      getManualTrackedContentMock.mockResolvedValue(trackedBosses(TWELVE_WEEKLY_BOSSES))

      const result = await useBossSchedulerStore.getState().addManualBoss('ocid-1', '검은마법사', '하드')

      expect(result).toBe('added')
      expect(setManualTrackedContentMock).toHaveBeenCalled()
    })

    it('시즌·월간 보스는 주간 카운트를 채우지 않는다. 그 둘이 섞여 있어도 주간 12개까지 선택 가능', async () => {
      getManualTrackedContentMock.mockResolvedValue([
        ...trackedBosses(TWELVE_WEEKLY_BOSSES.slice(0, 11)),
        { contentName: '시즌 보스 메이린', kind: 'boss', difficulty: '노멀' },
        { contentName: '검은마법사', kind: 'boss', difficulty: '하드' },
        { contentName: '무릉도장', kind: 'weekly' },
      ])

      const result = await useBossSchedulerStore.getState().addManualBoss('ocid-1', '더스크', '노멀')

      expect(result).toBe('added')
    })

    it('이미 추적 중인 (보스, 난이도)면 duplicate를 반환한다', async () => {
      getManualTrackedContentMock.mockResolvedValue([{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }])

      const result = await useBossSchedulerStore.getState().addManualBoss('ocid-1', '자쿰', '카오스')

      expect(result).toBe('duplicate')
    })
  })

  describe(': 캐릭터 순서 정렬 및 마지막 선택 캐릭터', () => {
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

    // 저장된 선택을 읽는 것은 이 스토어가 아니라 선택 스토어다. 부르는
    // 자리(진입 경로)는 그대로라 여기서 그 위임을 지킨다.
    it('loadTrackedOcids 는 선택 스토어를 하이드레이션한다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      getLastSelectedCharacterMock.mockResolvedValue('ocid-1')
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().loadTrackedOcids()

      expect(getLastSelectedCharacterMock).toHaveBeenCalledWith()
      expect(useCharacterSelectionStore.getState().selectedOcid).toBe('ocid-1')
    })

    // `selectCharacter` 테스트는 여기 있었다. 선택이 이 스토어를 떠나면서
    // `features/character-selection/__tests__/store.spec.ts` 로 옮겨갔다.
  })

  describe(': 파티 관리', () => {
    it('loadPartySizes([])는 getBossPartySettings를 호출하지 않고 partySizes를 빈 객체로 만든다', async () => {
      useBossSchedulerStore.setState({ partySizes: { 'ocid-1:자쿰:카오스': 4 } })

      await useBossSchedulerStore.getState().loadPartySizes([])

      expect(getBossPartySettingsMock).not.toHaveBeenCalled()
      expect(useBossSchedulerStore.getState().partySizes).toEqual({})
    })

    it('loadPartySizes(ocids)는 조회 결과를 `ocid:boss:difficulty` 키로 partySizes에 채운다', async () => {
      getBossPartySettingsMock.mockResolvedValue([
        { ocid: 'ocid-1', boss: '자쿰', difficulty: '카오스', partySize: 4, updatedAt: '2026-07-13T00:00:00.000Z' },
      ])

      await useBossSchedulerStore.getState().loadPartySizes(['ocid-1'])

      expect(getBossPartySettingsMock).toHaveBeenCalledWith(['ocid-1'])
      expect(useBossSchedulerStore.getState().partySizes).toEqual({ 'ocid-1:자쿰:카오스': 4 })
    })

    it('설정이 없는 보스는 partySizes 맵에 키 자체가 없다(1로 채우지 않음)', async () => {
      getBossPartySettingsMock.mockResolvedValue([])

      await useBossSchedulerStore.getState().loadPartySizes(['ocid-1'])

      expect(useBossSchedulerStore.getState().partySizes).toEqual({})
      expect(useBossSchedulerStore.getState().partySizes['ocid-1:자쿰:카오스']).toBeUndefined()
    })

    it('refresh(ocids)는 loadPartySizes를 통해 파티 설정을 함께 반영한다', async () => {
      getBossPartySettingsMock.mockResolvedValue([
        { ocid: 'ocid-1', boss: '자쿰', difficulty: '카오스', partySize: 3, updatedAt: '2026-07-13T00:00:00.000Z' },
      ])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().refresh(['ocid-1'])

      expect(getBossPartySettingsMock).toHaveBeenCalledWith(['ocid-1'])
      expect(useBossSchedulerStore.getState().partySizes).toEqual({ 'ocid-1:자쿰:카오스': 3 })
    })

    it('setPartySize는 storage에 upsert하고 partySizes 상태를 즉시 갱신한다', async () => {
      setBossPartySizeMock.mockResolvedValue(undefined)

      await useBossSchedulerStore.getState().setPartySize('ocid-1', '자쿰', '카오스', 4)

      expect(setBossPartySizeMock).toHaveBeenCalledWith(
        'ocid-1',
        '자쿰',
        '카오스',
        4,
        expect.any(String),
      )
      expect(useBossSchedulerStore.getState().partySizes).toEqual({ 'ocid-1:자쿰:카오스': 4 })
    })

    it('setPartySize가 성공하면 완료 토스트를 띄운다', async () => {
      setBossPartySizeMock.mockResolvedValue(undefined)

      await useBossSchedulerStore.getState().setPartySize('ocid-1', '자쿰', '카오스', 4)

      expect(showSuccessMock).toHaveBeenCalledWith('파티원 수를 저장했어요')
    })

    it('setPartySize는 해당 보스의 maxPartySize를 초과하면 에러를 던지고 storage를 호출하지 않는다', async () => {
      // 스우 익스트림은 boss-crystal-prices.json에서 maxPartySize: 2로 예외 지정되어 있다.
      await expect(
        useBossSchedulerStore.getState().setPartySize('ocid-1', '스우', '익스트림', 3),
      ).rejects.toThrow()

      expect(setBossPartySizeMock).not.toHaveBeenCalled()
      expect(useBossSchedulerStore.getState().partySizes).toEqual({})
    })

    it('setPartySize는 1 미만이거나 정수가 아니면 에러를 던진다', async () => {
      await expect(
        useBossSchedulerStore.getState().setPartySize('ocid-1', '자쿰', '카오스', 0),
      ).rejects.toThrow()
      await expect(
        useBossSchedulerStore.getState().setPartySize('ocid-1', '자쿰', '카오스', 1.5),
      ).rejects.toThrow()

      expect(setBossPartySizeMock).not.toHaveBeenCalled()
    })
  })

  // 탭이 걷히면서 `activeTab` 도 함께 사라지고(
  //  가 이 축에서 폐기됐다), 목록이 하나가 되면서 필터도 하나가 된다
  //.
  describe(': 필터 상태. 하나다', () => {
    it('초기 필터는 전체다', () => {
      expect(useBossSchedulerStore.getInitialState().partyFilter).toBe('all')
    })

    it('setPartyFilter 가 필터를 바꾼다', () => {
      useBossSchedulerStore.getState().setPartyFilter('solo')

      expect(useBossSchedulerStore.getState().partyFilter).toBe('solo')
    })

    // 탭이 남아 있으면 다음 세션이 **관리 화면만 쓰는 상태** 로 되살린다. 없는 것을 못 박는다.
    it('탭 상태와 세터가 스토어에 없다', () => {
      const state = useBossSchedulerStore.getState() as unknown as Record<string, unknown>

      expect(state.activeTab).toBeUndefined()
      expect(state.setActiveTab).toBeUndefined()
      expect(state.weeklyFilter).toBeUndefined()
      expect(state.monthlyFilter).toBeUndefined()
    })

    it('필터를 바꿔도 동기화를 호출하지 않는다', () => {
      useBossSchedulerStore.getState().setPartyFilter('party')

      expect(syncSchedulesMock).not.toHaveBeenCalled()
    })
  })

  // 결정 1~5: 화면에 들어왔다는 사실만으로는 조회하지 않는다. 게이트는 자동 진입 경로에만
  // 걸리고, 판정 근거는 캐시 우선 표시 단계가 이미 읽은 syncedAt 이다.
  describe('화면 진입 재조회 게이트', () => {
    function minutesAgo(minutes: number): string {
      return new Date(Date.now() - minutes * 60 * 1000).toISOString()
    }

    function cachedSchedulerState(syncedAt: string) {
      return {
        state: {
          asOf: '2026-07-11T00:00+09:00',
          characterName: '캐시된캐릭터',
          world: '베라',
          level: 200,
          jobClass: '렌',
          dailyContents: [],
          weeklyContents: [],
          bossContents: [bossContent()],
          isDailyStale: false,
          isWeeklyStale: false,
          isWeeklyBossStale: false,
          isMonthlyBossStale: false,
        },
        syncedAt,
      }
    }

    it('실행 플래그가 서 있고 전원 캐시가 TTL 안이면 자동 진입은 조회하지 않는다', async () => {
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockResolvedValue(cachedSchedulerState(minutesAgo(5)))

      await useBossSchedulerStore.getState().refresh(['ocid-1'], undefined, { auto: true })

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      const state = useBossSchedulerStore.getState()
      expect(state.status).toBe('loaded')
      expect(state.error).toBeNull()
      // 재검증하지 않기로 한 값이라 "오래된 데이터"가 아니다(토스트가 뜨면 안 된다).
      expect(state.characters.every((character) => character.isStale === false)).toBe(true)
    })

    it('건너뛴 진입에서도 syncedAt 은 캐시 값 그대로다 (방금 동기화한 것처럼 꾸미지 않는다)', async () => {
      const syncedAt = minutesAgo(5)
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockResolvedValue(cachedSchedulerState(syncedAt))

      await useBossSchedulerStore.getState().refresh(['ocid-1'], undefined, { auto: true })

      expect(useBossSchedulerStore.getState().characters[0].syncedAt).toBe(syncedAt)
    })

    it('앱 재시작 직후(실행 플래그 없음)에는 TTL 안이어도 조회한다', async () => {
      getCachedSchedulerStateMock.mockResolvedValue(cachedSchedulerState(minutesAgo(5)))
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().refresh(['ocid-1'], undefined, { auto: true })

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
    })

    it('추적 캐릭터 중 캐시가 없는 캐릭터가 있으면 TTL 안이어도 조회한다', async () => {
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockImplementation(async (ocid: string) =>
        ocid === 'ocid-1' ? cachedSchedulerState(minutesAgo(5)) : null,
      )
      syncSchedulesMock.mockResolvedValue([
        syncResult({ ocid: 'ocid-1' }),
        syncResult({ ocid: 'ocid-2' }),
      ])

      await useBossSchedulerStore.getState().refresh(['ocid-1', 'ocid-2'], undefined, { auto: true })

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
    })

    it('가장 오래된 캐시가 TTL 밖이면 조회한다', async () => {
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockImplementation(async (ocid: string) =>
        cachedSchedulerState(ocid === 'ocid-1' ? minutesAgo(5) : minutesAgo(11)),
      )
      syncSchedulesMock.mockResolvedValue([
        syncResult({ ocid: 'ocid-1' }),
        syncResult({ ocid: 'ocid-2' }),
      ])

      await useBossSchedulerStore.getState().refresh(['ocid-1', 'ocid-2'], undefined, { auto: true })

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
    })

    // 강제가 기본값이다. 옵션을 넘기지 않는 헤더 버튼·당겨서 새로고침·재시도는 항상 조회한다.
    it('옵션 없는 refresh(명시적 재조회)는 TTL 안이어도 항상 조회한다', async () => {
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockResolvedValue(cachedSchedulerState(minutesAgo(5)))
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossSchedulerStore.getState().refresh(['ocid-1'])

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
    })

    it('자동 진입 경로인 loadTrackedOcids는 게이트에 걸린다', async () => {
      markSyncAttemptedThisRun()
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      getCachedSchedulerStateMock.mockResolvedValue(cachedSchedulerState(minutesAgo(5)))

      await useBossSchedulerStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(useBossSchedulerStore.getState().status).toBe('loaded')
    })

    // 파티 설정은 로컬 SQLite 조회라 네트워크 TTL 의 대상이 아니다. 함께 건너뛰면 추적 목록이
    // 바뀐 진입에서 파티원 수 배지·솔로/파티 필터가 옛 값으로 남는다.
    it('동기화를 건너뛰어도 파티 설정은 다시 조회한다', async () => {
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockResolvedValue(cachedSchedulerState(minutesAgo(5)))
      getBossPartySettingsMock.mockResolvedValue([
        {
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          partySize: 4,
          updatedAt: '2026-08-06T00:00:00.000Z',
        },
      ])

      await useBossSchedulerStore.getState().refresh(['ocid-1'], undefined, { auto: true })

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(getBossPartySettingsMock).toHaveBeenCalledWith(['ocid-1'])
      expect(useBossSchedulerStore.getState().partySizes).toEqual({ 'ocid-1:자쿰:카오스': 4 })
    })
  })
})
