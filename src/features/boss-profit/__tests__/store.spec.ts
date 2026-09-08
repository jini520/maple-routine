import weeklyBossesData from '../../../data/weekly-bosses.json'

import { waitFor } from '../../../__tests__/wait-for'
import type { CharacterScheduleSync } from '../../schedule-sync/schedule-sync'
import type { BossContent, SchedulerCharacterState } from '../../../types'
import type { BossProfitRecord } from '../../../storage/boss-profit'
import type { CachedSchedulerEntry } from '../../../storage/scheduler-cache'

// 스토어가 toScheduleSyncError로 원인을 살리므로 그 매핑은 실물을 쓴다(부분 모킹).
jest.mock('../../schedule-sync/schedule-sync', () => ({
  ...jest.requireActual<typeof import('../../schedule-sync/schedule-sync')>('../../schedule-sync/schedule-sync'),
  syncSchedules: jest.fn(),
}))
const { syncSchedules: syncSchedulesMock } = jest.requireMock('../../schedule-sync/schedule-sync') as Record<string, jest.Mock>

jest.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: jest.fn(),
}))
const { getTrackedCharacterOcids: getTrackedCharacterOcidsMock } = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>

jest.mock('../../../storage/boss-profit', () => ({
  getBossProfitRecords: jest.fn(),
  // 기간 이동이 "기록이 있는 가장 가까운 기간"을 SQL 부등호로 묻는다.
  findAdjacentPeriodKeyWithRecords: jest.fn(),
  fillMissingRecordWorlds: jest.fn(),
  upsertBossProfitRecord: jest.fn(),
  // 날짜 모르는 월간 보스가 설 주를 이 목록이 고른다.
  getWeeklyPeriodKeysWithRecords: jest.fn(),
  // 추적 목록 밖에서 기록을 남긴 캐릭터. 화면이 그릴 범위가 여기서 넓어진다.
  getRecordedCharacterOcids: jest.fn(),
}))
const { getBossProfitRecords: getBossProfitRecordsMock, findAdjacentPeriodKeyWithRecords: findAdjacentMock, fillMissingRecordWorlds: fillMissingRecordWorldsMock, upsertBossProfitRecord: upsertBossProfitRecordMock, getWeeklyPeriodKeysWithRecords: getWeeklyPeriodKeysWithRecordsMock, getRecordedCharacterOcids: getRecordedCharacterOcidsMock } = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>

// 처치 날짜 캐기는 **동기화가 끝난 뒤 기다리지 않고** 튼다. 이 화면은
// `defeated_on` 을 안 쓰므로 결과를 기다릴 이유가 없다. 목으로 **떴는가** 만 본다.
jest.mock('../../schedule-window/sync', () => ({ syncScheduleWindow: jest.fn() }))
const { syncScheduleWindow: syncWindowMock } = jest.requireMock('../../schedule-window/sync') as Record<string, jest.Mock>

// 창이 못 채운 날짜들. `아직 집계 전인 날이 있나` 가 여기서 나온다.
jest.mock('../../schedule-window/window', () => ({ getLastWindowFailures: jest.fn(() => []) }))
const { getLastWindowFailures: windowFailuresMock } = jest.requireMock('../../schedule-window/window') as Record<string, jest.Mock>

jest.mock('../../../storage/boss-party-settings', () => ({
  getBossPartySize: jest.fn(),
}))
const { getBossPartySize: getBossPartySizeMock } = jest.requireMock('../../../storage/boss-party-settings') as Record<string, jest.Mock>

jest.mock('../../../storage/scheduler-cache', () => ({
  getCachedSchedulerState: jest.fn(),
}))
const { getCachedSchedulerState: getCachedSchedulerStateMock } = jest.requireMock('../../../storage/scheduler-cache') as Record<string, jest.Mock>

jest.mock('../../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: jest.fn(),
}))
const { getCachedCharacterBasic: getCachedCharacterBasicMock } = jest.requireMock('../../../storage/character-basic-cache') as Record<string, jest.Mock>

// 프로필의 출처는 이제 지워지지 않는 스냅샷이다. 이 스위트는 캐시에 값을 심어 화면을 재므로,
// 목이 그 캐시를 그대로 읽어 같은 모양으로 돌려준다(실물도 표에 없으면 캐시를 본다).
jest.mock('../../character-profile/resolve', () => ({ resolveDisplayProfiles: jest.fn() }))
const { resolveDisplayProfiles: resolveDisplayProfilesMock } = jest.requireMock('../../character-profile/resolve') as Record<string, jest.Mock>

jest.mock('../../../storage/api-key', () => ({
  getAuthConfig: jest.fn(),
}))
const { getAuthConfig: getAuthConfigMock } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>

jest.mock('../../../nexon/schedule', () => ({
  fetchSchedulerCharacterState: jest.fn(),
}))
const { fetchSchedulerCharacterState: fetchSchedulerCharacterStateMock } = jest.requireMock('../../../nexon/schedule') as Record<string, jest.Mock>

jest.mock('../../../storage/tracking-mode', () => ({
  getTrackingMode: jest.fn(),
}))
const { getTrackingMode: getTrackingModeMock } = jest.requireMock('../../../storage/tracking-mode') as Record<string, jest.Mock>

jest.mock('../../../storage/manual-tracked-content', () => ({
  getManualTrackedContent: jest.fn(),
}))
const { getManualTrackedContent: getManualTrackedContentMock } = jest.requireMock('../../../storage/manual-tracked-content') as Record<string, jest.Mock>

jest.mock('../../../storage/boss-drops', () => ({
  getBossDropRecords: jest.fn(),
  replaceBossDropRecords: jest.fn(),
}))
const { getBossDropRecords: getBossDropRecordsMock, replaceBossDropRecords: replaceBossDropRecordsMock } = jest.requireMock('../../../storage/boss-drops') as Record<string, jest.Mock>

// 잡지 않은 보스의 드롭을 지운 뒤 **건수를 토스트로 알린다**. 값까지 사라지므로.
const mockShowInfo = jest.fn()
jest.mock('../../toast/store', () => ({
  useToastStore: { getState: () => ({ showInfo: mockShowInfo, showError: jest.fn(), showSuccess: jest.fn() }) },
}))

import {
  getAdjacentPeriodKey,
  getCurrentBossProfitPeriod,
  getWeeklyPeriodKeysInMonth,
} from '../../../lib/boss/boss-profit-period'
import { getMostRecentWeeklyResetKst } from '../../../lib/scheduler/reset-clock'
import {
  markSyncAttemptedThisRun,
  resetSyncRunStateForTests,
} from '../../schedule-sync/sync-run-state'
import { useBossProfitStore } from '../store'
// **Date 만 가짜로 만든다.** jest 는 `doNotFake` 로 **건드리지 말 것** 을 받는다. 그대로 두면
// 타이머까지 전부 가짜가 되어 실제
// `setTimeout` 에 기대는 플러시가 영영 안 끝난다.
const NOT_FAKED = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'hrtime',
] as never

// "시세표(boss-crystal-prices.json)에 없는 보스" 표본. 실재 보스명을 쓰면 그 보스의 가격이
// 확정되는 날 검증하려던 것과 반대 상태를 검증하게 된다. 벨로나가 실제로 그랬다
// 어떤 보스도 이 이름을 갖지 않는다는 사실이 이 픽스처의 불변조건이다.
const UNPRICED_BOSS = '미확정 보스'

function bossContent(overrides: Partial<BossContent> = {}): BossContent {
  const merged = {
    name: '자쿰',
    difficulty: '카오스' as const,
    cycle: 'weekly' as const,
    isRegistered: true,
    isComplete: true,
    ...overrides,
  }
  // ownComplete는 별도로 지정하지 않으면 isComplete를 그대로 따른다(승격 시나리오를 테스트할
  // 때만 둘을 다르게 지정). 대부분의 기존 테스트는 승격 여부를 신경 쓰지 않는다.
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
  // 모듈 수준 실행 플래그라 테스트끼리 오염된다.
  resetSyncRunStateForTests()
  mockShowInfo.mockClear()
  syncWindowMock.mockReset().mockResolvedValue(undefined)
  useBossProfitStore.setState({
    status: 'idle',
    tab: 'weekly',
    periodKey: getCurrentBossProfitPeriod('weekly', new Date()).periodKey,
    rows: [],
    dropsByRowKey: {},
    weeklySubtotals: [],
    isPeriodLoading: false,
    previousPeriodTotalMeso: 0,
    canGoPreviousPeriod: false,
    error: null,
    staleCharacterNames: [],
    trackedOcids: null,
    lastSyncedAt: null,
  })
  getBossProfitRecordsMock.mockResolvedValue([])
  // 기본값은 **바로 옆 칸에 기록이 있다**. 건너뛰기를 안 보는 테스트들이 예전처럼 한 칸씩 움직인다.
  windowFailuresMock.mockReturnValue([])
  findAdjacentMock.mockImplementation(
    async (_ocids: string[], tab: 'weekly' | 'monthly', key: string, direction: 'prev' | 'next') =>
      getAdjacentPeriodKey(tab, key, direction),
  )
  getWeeklyPeriodKeysWithRecordsMock.mockResolvedValue([])
  fillMissingRecordWorldsMock.mockResolvedValue(undefined)
  getBossDropRecordsMock.mockResolvedValue([])
  replaceBossDropRecordsMock.mockResolvedValue(undefined)
  upsertBossProfitRecordMock.mockResolvedValue(undefined)
  getBossPartySizeMock.mockResolvedValue(null)
  getCachedSchedulerStateMock.mockResolvedValue(null)
  getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
    profile: { name: `캐릭터-${ocid}`, level: 200, imageUrl: 'x', accessFlag: true },
    cachedAt: '2026-07-01T00:00:00.000Z',
  }))
  getRecordedCharacterOcidsMock.mockReset().mockResolvedValue([])
  resolveDisplayProfilesMock.mockReset().mockImplementation(async (ocids: readonly string[]) => {
    const profiles = new Map()
    for (const ocid of new Set(ocids)) {
      const cached = await getCachedCharacterBasicMock(ocid)
      if (cached === null || cached === undefined) continue
      profiles.set(ocid, {
        name: cached.profile.name,
        imageUrl: cached.profile.imageUrl ?? null,
        world: cached.profile.world ?? null,
        level: cached.profile.level ?? null,
      })
    }
    return profiles
  })
  getAuthConfigMock.mockResolvedValue({ apiKey: 'test-key', selectedAccountId: 'acc-1' })
  fetchSchedulerCharacterStateMock.mockResolvedValue(null)
  getTrackingModeMock.mockResolvedValue('auto')
  getManualTrackedContentMock.mockResolvedValue([])
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('setBossDrops', () => {
  const sampleRow = {
    ocid: 'ocid-1',
    characterName: '캐릭터-1',
    imageUrl: null,
    world: null,
    boss: '스우',
    difficulty: '하드' as const,
    cycle: 'weekly' as const,
    periodKey: '2026-W30',
    periodLabel: '이번 주',
    priceMeso: 1000,
    maxPartySize: 6,
    partySize: 1,
    payoutMeso: 1000,
    isComplete: true,
    defeatedOn: null,
  }

  it('드롭을 replaceBossDropRecords로 통째 교체하고 dropsByRowKey를 갱신한다', async () => {
    useBossProfitStore.setState({ status: 'loaded', rows: [sampleRow], dropsByRowKey: {} })

    const drops = [
      { category: 'equipment' as const, itemName: '루즈 컨트롤 머신 마크', slot: '얼굴장식', quantity: 1 },
    ]
    await useBossProfitStore.getState().setBossDrops(
      { ocid: 'ocid-1', boss: '스우', difficulty: '하드', cycle: 'weekly', periodKey: '2026-W30' },
      drops,
    )

    expect(replaceBossDropRecordsMock).toHaveBeenCalledWith(
      'ocid-1',
      '스우',
      '하드',
      '2026-W30',
      drops,
      expect.any(String),
    )
    expect(useBossProfitStore.getState().dropsByRowKey['ocid-1|스우|하드|2026-W30']).toEqual(drops)
  })

  it('존재하지 않는 행이면 에러를 던지고 DB를 건드리지 않는다', async () => {
    useBossProfitStore.setState({ rows: [] })

    await expect(
      useBossProfitStore.getState().setBossDrops(
        { ocid: 'x', boss: 'x', difficulty: '하드', cycle: 'weekly', periodKey: 'x' },
        [],
      ),
    ).rejects.toThrow('존재하지 않는 보스 행')
    expect(replaceBossDropRecordsMock).not.toHaveBeenCalled()
  })
})

describe('처치 난이도 획득 불가 드롭 제거 (후속)', () => {
  function dropRecord(overrides: Record<string, unknown>): Record<string, unknown> {
    return {
      ocid: 'ocid-1',
      boss: '스우',
      difficulty: '하드',
      cycle: 'weekly',
      category: 'equipment',
      slot: null,
      boxOrigin: null,
      ringLevel: null,
      quantity: 1,
      ...overrides,
    }
  }

  it('완료 보스의 기록 드롭 중 처치 난이도에서 획득 불가한 아이템을 제거하고 DB에 반영한다', async () => {
    const period = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: '스우', difficulty: '하드', isComplete: true, ownComplete: true })],
        },
      }),
    ])
    getBossDropRecordsMock.mockResolvedValue([
      dropRecord({ periodKey: period, itemName: '루즈 컨트롤 머신 마크', slot: '얼굴장식' }), // 하드+익스 유지
      dropRecord({ periodKey: period, itemName: '컴플리트 언더컨트롤' }), // 익스 전용 제거
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const key = `ocid-1|스우|하드|${period}`
    expect(useBossProfitStore.getState().dropsByRowKey[key].map((drop) => drop.itemName)).toEqual([
      '루즈 컨트롤 머신 마크',
    ])
    expect(replaceBossDropRecordsMock).toHaveBeenCalledWith(
      'ocid-1',
      '스우',
      '하드',
      period,
      [expect.objectContaining({ itemName: '루즈 컨트롤 머신 마크' })],
      expect.any(String),
    )
  })

  it('미완료 placeholder 보스의 드롭은 제거하지 않는다(처치 난이도 미확정)', async () => {
    const period = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [
            bossContent({ name: '스우', difficulty: '하드', isRegistered: true, isComplete: false, ownComplete: false }),
          ],
        },
      }),
    ])
    getBossDropRecordsMock.mockResolvedValue([
      dropRecord({ periodKey: period, itemName: '컴플리트 언더컨트롤' }), // 익스 전용이지만 미완료라 유지
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const key = `ocid-1|스우|하드|${period}`
    expect(useBossProfitStore.getState().dropsByRowKey[key].map((drop) => drop.itemName)).toEqual([
      '컴플리트 언더컨트롤',
    ])
    expect(replaceBossDropRecordsMock).not.toHaveBeenCalled()
  })
})

// 익스트림으로 등록해두고 드롭까지 기록한 뒤 실제 처치가 하드로 확정되면, 그
// 드롭은 난이도가 들어간 키에 남아 어떤 행도 읽지 않는 고아가 된다.
describe('처치 난이도 확정 시 드롭 이관', () => {
  function dropRecord(overrides: Record<string, unknown>): Record<string, unknown> {
    return {
      ocid: 'ocid-1',
      boss: '스우',
      difficulty: '익스트림',
      periodKey: getCurrentBossProfitPeriod('weekly', new Date()).periodKey,
      dropIndex: 0,
      category: 'equipment',
      slot: null,
      boxOrigin: null,
      ringLevel: null,
      quantity: 1,
      ...overrides,
    }
  }

  it('실시간 동기화로 난이도가 확정되면 옛 난이도 키의 드롭을 옮기고 옛 키를 비운다', async () => {
    const period = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: '스우', difficulty: '하드', isComplete: true, ownComplete: true })],
        },
      }),
    ])
    getBossDropRecordsMock.mockResolvedValue([
      dropRecord({ itemName: '루즈 컨트롤 머신 마크', slot: '얼굴장식' }), // 하드+익스 → 이관
      dropRecord({ dropIndex: 1, itemName: '컴플리트 언더컨트롤' }), // 익스 전용 → 삭제
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    expect(replaceBossDropRecordsMock).toHaveBeenCalledWith(
      'ocid-1',
      '스우',
      '하드',
      period,
      [expect.objectContaining({ itemName: '루즈 컨트롤 머신 마크' })],
      expect.any(String),
    )
    expect(replaceBossDropRecordsMock).toHaveBeenCalledWith(
      'ocid-1',
      '스우',
      '익스트림',
      period,
      [],
      expect.any(String),
    )
  })

  it('미완료 행의 드롭은 그대로 둔다. 아직 처치 난이도가 확정되지 않았다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [
            bossContent({ name: '스우', difficulty: '하드', isRegistered: true, isComplete: false, ownComplete: false }),
          ],
        },
      }),
    ])
    getBossDropRecordsMock.mockResolvedValue([dropRecord({ itemName: '루즈 컨트롤 머신 마크', slot: '얼굴장식' })])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    expect(replaceBossDropRecordsMock).not.toHaveBeenCalled()
  })
})

describe('useBossProfitStore', () => {
  it('초기 상태는 idle이고 rows가 비어있다', () => {
    const state = useBossProfitStore.getState()
    expect(state.status).toBe('idle')
    expect(state.rows).toEqual([])
    expect(state.error).toBeNull()
    expect(state.staleCharacterNames).toEqual([])
  })

  it('refresh([])는 syncSchedules를 호출하지 않고 곧바로 loaded/빈 배열 상태가 된다', async () => {
    await useBossProfitStore.getState().refresh([])

    const state = useBossProfitStore.getState()
    expect(syncSchedulesMock).not.toHaveBeenCalled()
    expect(state.status).toBe('loaded')
    expect(state.rows).toEqual([])
    expect(state.staleCharacterNames).toEqual([])
  })

  it('등록되지 않고 미처치인 보스는 rows에서 제외된다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [
            bossContent({ name: '자쿰', isRegistered: false, isComplete: false }),
            bossContent({ name: '스우', difficulty: '노멀', isComplete: true }),
          ],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const rows = useBossProfitStore.getState().rows
    expect(rows).toHaveLength(1)
    expect(rows[0].boss).toBe('스우')
  })

  it('등록됐지만 아직 미처치인 보스는 "미완료" placeholder row로 포함되고 0메소로 계산되며 DB에는 기록되지 않는다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: '자쿰', isRegistered: true, isComplete: false })],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const rows = useBossProfitStore.getState().rows
    expect(rows).toHaveLength(1)
    expect(rows[0].boss).toBe('자쿰')
    expect(rows[0].isComplete).toBe(false)
    expect(rows[0].payoutMeso).toBe(0)
    expect(rows[0].partySize).toBeNull()
    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
  })

  it('등록된 난이도가 완료되면 미완료 placeholder에서 정상적인 완료 row로 다음 refresh에서 대체된다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: '자쿰', isRegistered: true, isComplete: false })],
        },
      }),
    ])
    await useBossProfitStore.getState().refresh(['ocid-1'])
    expect(useBossProfitStore.getState().rows[0].payoutMeso).toBe(0)

    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: '자쿰', isRegistered: true, isComplete: true })],
        },
      }),
    ])
    await useBossProfitStore.getState().refresh(['ocid-1'])

    const row = useBossProfitStore.getState().rows[0]
    expect(row.isComplete).toBe(true)
    expect(row.partySize).toBe(1)
    expect(row.payoutMeso).toBe(8080000)
  })

  it('등록 난이도와 실제 처치 난이도가 다르면, 이번 주 row는 실제 처치 난이도와 그 가격을 보여준다', async () => {
    // 루시드를 이지로 등록해뒀지만 실제로는 노멀을 처치한 상황
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [
            bossContent({ name: '루시드', difficulty: '이지', isRegistered: true, isComplete: true, ownComplete: false }),
            bossContent({ name: '루시드', difficulty: '노멀', isRegistered: false, isComplete: true, ownComplete: true }),
          ],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const rows = useBossProfitStore.getState().rows
    expect(rows).toHaveLength(1)
    expect(rows[0].difficulty).toBe('노멀')
    expect(rows[0].priceMeso).toBe(35_600_000)
  })

  // 월간 보스가 월간 탭에서 빠져 주간 목록 **맨 위**로 왔다(사용자 지정). 월간 탭 데이터에는
  // 그대로 남아 있고(아바타 진행 링이 그것을 센다) 본문만 안 그린다.
  it('주간 탭이 월간 보스를 맨 위에 함께 낸다. 월간 탭은 그대로 자기 주기만 낸다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [
            bossContent({ name: '자쿰', cycle: 'weekly', isComplete: true }),
            bossContent({ name: '검은 마법사', difficulty: '익스트림', cycle: 'monthly', isComplete: true }),
          ],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const weeklyRows = useBossProfitStore.getState().rows
    expect(weeklyRows.map((row) => row.boss)).toEqual(['검은마법사', '자쿰'])
    expect(weeklyRows[0].cycle).toBe('monthly')

    await useBossProfitStore.getState().setTab('monthly')

    const monthlyRows = useBossProfitStore.getState().rows
    expect(monthlyRows.map((row) => row.boss)).toEqual(['검은마법사'])
    expect(monthlyRows[0].cycle).toBe('monthly')
    // setTab은 "현재 기간"으로만 이동하므로 API를 다시 호출하지 않는다(로컬 스냅샷에서 슬라이스).
    expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
  })

  // `rows` 는 **보고 있는 (탭, 기간)** 이고 today 위젯이 읽는 것은 **지금 기간** 이다.
  // 이 화면을 월간 탭으로 옮기기만 해도 today 의 주간 보스 수익·주간
  // 결정석 한도가 함께 비었다. 그 화면은 이 화면의 네비게이션을 모르는 채로 이번 주를 그린다.
  it('월간 탭으로 옮겨도 currentPeriodRows 는 이번 주 행을 그대로 들고 있다', async () => {
    const weekKey = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [
            bossContent({ name: '자쿰', cycle: 'weekly', isComplete: true }),
            bossContent({ name: '검은 마법사', difficulty: '익스트림', cycle: 'monthly', isComplete: true }),
          ],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])
    await useBossProfitStore.getState().setTab('monthly')

    // 화면은 보던 대로 월간이다.
    expect(useBossProfitStore.getState().rows.map((row) => row.boss)).toEqual(['검은마법사'])
    // today 가 읽는 값에는 이번 주 행이 그대로 있다.
    const weeklyRows = useBossProfitStore
      .getState()
      .currentPeriodRows.filter((row) => row.cycle === 'weekly' && row.periodKey === weekKey)
    expect(weeklyRows.map((row) => row.boss)).toEqual(['자쿰'])
  })

  it('월간 탭으로 옮겨도 dropsByRowKey 가 이번 주 드롭을 잃지 않는다', async () => {
    const weekKey = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
    // `fixed` 는 난이도 획득 가능 판정을 타지 않는다. 이 테스트가 보려는 것은
    // 드롭 맵의 **범위**이지 정리 규칙이 아니다.
    // **조회 인자를 지키는 목이어야 한다**. 통째로 같은 배열을 돌려주면 "그 기간을 조회했는가" 를
    // 못 본다(이 결함이 정확히 **어느 기간 키로 읽는가** 의 문제다).
    getBossDropRecordsMock.mockImplementation(async (_ocids: string[], periodKeys: string[]) =>
      periodKeys.includes(weekKey)
        ? [
            {
              ocid: 'ocid-1',
              boss: '자쿰',
              difficulty: '카오스',
              periodKey: weekKey,
              dropIndex: 0,
              category: 'fixed',
              itemName: '테스트 드롭',
              slot: null,
              boxOrigin: null,
              ringLevel: null,
              quantity: 1,
            },
          ]
        : [],
    )
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [
            bossContent({ name: '자쿰', cycle: 'weekly', isComplete: true }),
            bossContent({ name: '검은 마법사', difficulty: '익스트림', cycle: 'monthly', isComplete: true }),
          ],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])
    expect(useBossProfitStore.getState().dropsByRowKey[`ocid-1|자쿰|카오스|${weekKey}`]).toHaveLength(1)

    await useBossProfitStore.getState().setTab('monthly')

    expect(useBossProfitStore.getState().dropsByRowKey[`ocid-1|자쿰|카오스|${weekKey}`]).toHaveLength(1)
  })

  // 미완료 행에도 드롭과 가격을 적을 수 있는데, 그 행은 금액 자리에 `미완료` 배지를 세워 돈을
  // 아예 안 그린다. 주간 탭은 `collectPayableDrops` 가 가르고 월간 탭은 소계가 원천이라 여기서
  // 가른다. 안 맞추면 같은 주가 두 탭에서 다른 숫자가 된다.
  it('월간 탭 주차 소계가 미완료 보스의 드롭 값을 안 더한다', async () => {
    const weekKey = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
    const 값매긴드롭 = (boss: string, difficulty: string) => ({
      ocid: 'ocid-1',
      boss,
      difficulty,
      periodKey: weekKey,
      dropIndex: 0,
      category: 'fixed' as const,
      itemName: '테스트 드롭',
      slot: null,
      boxOrigin: null,
      ringLevel: null,
      quantity: 1,
      recordedAt: '2026-09-09T00:00:00.000Z',
      priceState: 'entered' as const,
      priceMeso: 900_000_000,
      priceShare: 1,
    })

    getBossDropRecordsMock.mockImplementation(async (_ocids: string[], periodKeys: string[]) =>
      periodKeys.includes(weekKey) ? [값매긴드롭('스우', '노멀')] : [],
    )
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          // 등록만 되고 아직 안 잡은 보스. 미완료 placeholder 행이 선다.
          bossContents: [bossContent({ name: '스우', difficulty: '노멀', isComplete: false })],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])
    await useBossProfitStore.getState().setTab('monthly')

    const subtotal = useBossProfitStore
      .getState()
      .weeklySubtotals.find((entry) => entry.periodKey === weekKey)
    expect(subtotal?.totalMeso).toBe(0)
    expect(subtotal?.drops).toEqual([])
  })

  it('시세표에 없는 보스는 priceMeso가 null이고 payoutMeso도 항상 null이다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: UNPRICED_BOSS, difficulty: '이지', isComplete: true })],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const row = useBossProfitStore.getState().rows[0]
    expect(row.priceMeso).toBeNull()
    expect(row.payoutMeso).toBeNull()
  })

  it('여러 캐릭터의 처치 보스가 하나의 rows 배열로 합쳐진다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({ ocid: 'ocid-1', characterName: '캐릭터1' }),
      syncResult({
        ocid: 'ocid-2',
        characterName: '캐릭터2',
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: '스우', difficulty: '노멀', isComplete: true })],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'])

    const rows = useBossProfitStore.getState().rows
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.ocid).sort()).toEqual(['ocid-1', 'ocid-2'])
  })

  it('row.imageUrl은 character-basic-cache의 character_image로 채워진다(캐릭터명은 character/list 출처를 유지)', async () => {
    getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
      profile: { name: `캐시된-${ocid}`, level: 200, imageUrl: `https://example.com/${ocid}.png`, accessFlag: true },
      cachedAt: '2026-07-01T00:00:00.000Z',
    }))
    syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-1', characterName: '라이브이름' })])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const row = useBossProfitStore.getState().rows[0]
    expect(row.characterName).toBe('라이브이름') // character/list 출처 유지(정확도 우선)
    expect(row.imageUrl).toBe('https://example.com/ocid-1.png') // character-basic-cache 출처
  })

  it('character-basic-cache에 캐시가 없으면 row.imageUrl은 null이다', async () => {
    getCachedCharacterBasicMock.mockResolvedValue(null)
    syncSchedulesMock.mockResolvedValue([syncResult()])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    expect(useBossProfitStore.getState().rows[0].imageUrl).toBeNull()
  })

  it('캐릭터 순서는 레벨 내림차순으로 고정되며 ocids 인자·API 응답 순서와 무관하다', async () => {
    getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
      profile: {
        name: `캐릭터-${ocid}`,
        level: ocid === 'ocid-1' ? 100 : 250,
        imageUrl: 'x',
        accessFlag: true,
      },
      cachedAt: '2026-07-01T00:00:00.000Z',
    }))
    // syncSchedules는 낮은 레벨(ocid-1)을 먼저 반환하지만, 최종 rows는 레벨이 더 높은
    // ocid-2가 먼저 와야 한다. API 응답 순서를 그대로 따르지 않는다.
    syncSchedulesMock.mockResolvedValue([
      syncResult({ ocid: 'ocid-1', characterName: '캐릭터-ocid-1' }),
      syncResult({
        ocid: 'ocid-2',
        characterName: '캐릭터-ocid-2',
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: '스우', difficulty: '노멀', isComplete: true })],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'])

    expect(useBossProfitStore.getState().rows.map((row) => row.ocid)).toEqual(['ocid-2', 'ocid-1'])
  })

  it('캐시 우선 표시와 실시간 동기화 이후의 캐릭터 순서가 같다(응답 도착 후 순서가 바뀌지 않는다)', async () => {
    getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
      profile: {
        name: `캐릭터-${ocid}`,
        level: ocid === 'ocid-1' ? 100 : 250,
        imageUrl: 'x',
        accessFlag: true,
      },
      cachedAt: '2026-07-01T00:00:00.000Z',
    }))
    getCachedSchedulerStateMock.mockImplementation(async (ocid: string) => ({
      state: {
        ...syncResult().state!,
        characterName: `캐릭터-${ocid}`,
        bossContents: [bossContent({ isComplete: true })],
      },
      syncedAt: '2026-07-01T00:00:00.000Z',
    }))

    const pending = new Promise<CharacterScheduleSync[]>(() => {})
    syncSchedulesMock.mockReturnValue(pending)

    void useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'])
    await waitFor(() => expect(useBossProfitStore.getState().rows.length).toBe(2))

    const cacheFirstOrder = useBossProfitStore.getState().rows.map((row) => row.ocid)
    expect(cacheFirstOrder).toEqual(['ocid-2', 'ocid-1']) // 레벨 내림차순(ocid-2가 250으로 더 높음)
  })

  it('한 캐릭터 안의 보스 순서는 소스 순서와 무관하게 weekly-bosses.json 정규 순서로 고정된다(#28)', async () => {
    // 소스(bossContents)는 참조 순서와 어긋나게 뒤섞어 공급한다. 루시드(10) → 자쿰(0) → 스우(7).
    // 최종 rows는 항상 weekly-bosses.json 순서(자쿰 → 스우 → 루시드)여야 한다.
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [
            bossContent({ name: '루시드', difficulty: '노멀', isComplete: true }),
            bossContent({ name: '자쿰', difficulty: '카오스', isComplete: true }),
            bossContent({ name: '스우', difficulty: '노멀', isComplete: true }),
          ],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    expect(useBossProfitStore.getState().rows.map((row) => row.boss)).toEqual(['자쿰', '스우', '루시드'])
  })

  it('특정 캐릭터의 동기화 결과가 isStale이면 staleCharacterNames에 그 캐릭터명이 포함된다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult({ characterName: '캐릭터1', isStale: true })])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    expect(useBossProfitStore.getState().staleCharacterNames).toEqual(['캐릭터1'])
  })

  it('refresh가 성공하면 lastSyncedAt이 현재 시각으로 갱신된다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()])
    expect(useBossProfitStore.getState().lastSyncedAt).toBeNull()

    await useBossProfitStore.getState().refresh(['ocid-1'])

    expect(useBossProfitStore.getState().lastSyncedAt).not.toBeNull()
  })

  it('refresh 자체가 실패하면(syncSchedules 예외) lastSyncedAt이 갱신되지 않는다', async () => {
    syncSchedulesMock.mockRejectedValue(new Error('network down'))

    await useBossProfitStore.getState().refresh(['ocid-1'])

    expect(useBossProfitStore.getState().status).toBe('error')
    expect(useBossProfitStore.getState().lastSyncedAt).toBeNull()
  })

  it('저장된 기록이 있으면 refresh 후 partySize/payoutMeso가 복원된다(멱등성)', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

    await useBossProfitStore.getState().refresh(['ocid-1'])
    const periodKey = useBossProfitStore.getState().rows[0].periodKey

    const record: BossProfitRecord = {
      ocid: 'ocid-1',
      boss: '자쿰',
      difficulty: '카오스',
      cycle: 'weekly',
      periodKey,
      partySize: 4,
      priceMeso: 8080000,
      payoutMeso: 2020000,
      recordedAt: '2026-07-09T00:00:00.000Z',
      world: null,
    }
    getBossProfitRecordsMock.mockResolvedValue([record])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const row = useBossProfitStore.getState().rows[0]
    expect(row.partySize).toBe(4)
    expect(row.payoutMeso).toBe(2020000)
  })

  it('저장된 기록의 priceMeso가 라이브 시세와 다르면 기록값을 그대로 쓴다(과거 기록 재계산 방지)', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, 라이브 priceMeso 8080000

    await useBossProfitStore.getState().refresh(['ocid-1'])
    const periodKey = useBossProfitStore.getState().rows[0].periodKey

    const record: BossProfitRecord = {
      ocid: 'ocid-1',
      boss: '자쿰',
      difficulty: '카오스',
      cycle: 'weekly',
      periodKey,
      partySize: 2,
      priceMeso: 7_000_000, // 과거 패치 시점 시세. 지금의 라이브 시세(8080000)와 다르다
      payoutMeso: 3_500_000,
      recordedAt: '2026-07-09T00:00:00.000Z',
      world: null,
    }
    getBossProfitRecordsMock.mockResolvedValue([record])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const row = useBossProfitStore.getState().rows[0]
    expect(row.priceMeso).toBe(7_000_000)
    expect(row.partySize).toBe(2)
    expect(row.payoutMeso).toBe(3_500_000)
  })

  describe('자동 파티원 수 기록 (기본값 소스는로 boss_party_settings 조회로 대체)', () => {
    it('기록도 파티 설정도 없는 새 완료 보스는 partySize 1(솔로)로 자동 기록된다', async () => {
      getBossPartySizeMock.mockResolvedValue(null)
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(getBossPartySizeMock).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스')
      expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          partySize: 1,
          priceMeso: 8080000,
          payoutMeso: 8080000,
        }),
      )
      const row = useBossProfitStore.getState().rows[0]
      expect(row.partySize).toBe(1)
      expect(row.payoutMeso).toBe(8080000)
    })

    it('boss_party_settings에 설정된 값이 있으면 그 값을 기본 파티원 수로 쓴다', async () => {
      getBossPartySizeMock.mockResolvedValue(4)
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          partySize: 4,
          priceMeso: 8080000,
          payoutMeso: 2020000,
        }),
      )
      const row = useBossProfitStore.getState().rows[0]
      expect(row.partySize).toBe(4)
      expect(row.payoutMeso).toBe(2020000)
    })

    it('이미 저장된 기록이 있는 조합은 자동 기록 로직을 건드리지 않는다(주차별 override 유지)', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

      await useBossProfitStore.getState().refresh(['ocid-1'])
      const periodKey = useBossProfitStore.getState().rows[0].periodKey

      const record: BossProfitRecord = {
        ocid: 'ocid-1',
        boss: '자쿰',
        difficulty: '카오스',
        cycle: 'weekly',
        periodKey,
        partySize: 4,
        priceMeso: 8080000,
        payoutMeso: 2020000,
        recordedAt: '2026-07-09T00:00:00.000Z',
        world: null,
      }
      getBossProfitRecordsMock.mockResolvedValue([record])
      getBossPartySizeMock.mockClear()
      upsertBossProfitRecordMock.mockClear()

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(getBossPartySizeMock).not.toHaveBeenCalled()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
      const row = useBossProfitStore.getState().rows[0]
      expect(row.partySize).toBe(4)
      expect(row.payoutMeso).toBe(2020000)
    })

    // withSqliteFallback은 조회 실패·타임아웃을 빈 결과로 바꾼다. 그 빈 결과를
    // "기록이 없다"로 읽으면 자동 기록이 party_size=1로 사용자가 저장한 값을 덮어쓴다. 리로드 후
    // stale 커넥션으로 조회가 멈추는 상황에서 실제로 일어날 수 있는 데이터 손상이다.
    it('기록 조회 자체가 실패하면 자동 기록으로 기본 파티원 수를 덮어쓰지 않는다', async () => {
      getBossProfitRecordsMock.mockRejectedValue(new Error('SQLite 응답 없음'))
      getBossPartySizeMock.mockResolvedValue(null)
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('기록 조회가 성공했고 결과가 비어 있으면(진짜 기록 없음) 기존대로 자동 기록한다', async () => {
      getBossProfitRecordsMock.mockResolvedValue([])
      getBossPartySizeMock.mockResolvedValue(null)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({ ocid: 'ocid-1', boss: '자쿰', difficulty: '카오스', partySize: 1 }),
      )
    })

    it('자동 기록 대상 보스가 여러 개여도 upsert 호출이 겹치지 않는다(동일 SQLite 커넥션 트랜잭션 충돌 방지)', async () => {
      let active = 0
      let sawOverlap = false
      upsertBossProfitRecordMock.mockImplementation(async () => {
        active += 1
        if (active > 1) sawOverlap = true
        await new Promise((resolve) => setTimeout(resolve, 0))
        active -= 1
      })
      getBossPartySizeMock.mockResolvedValue(null)
      syncSchedulesMock.mockResolvedValue([
        syncResult({
          state: {
            ...syncResult().state!,
            bossContents: [
              bossContent({ name: '자쿰', difficulty: '카오스', isComplete: true }),
              bossContent({ name: '스우', difficulty: '노멀', isComplete: true }),
            ],
          },
        }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(upsertBossProfitRecordMock).toHaveBeenCalledTimes(2)
      expect(sawOverlap).toBe(false)
    })

    it('priceMeso가 null인 보스는 자동 기록 대상이 아니다', async () => {
      syncSchedulesMock.mockResolvedValue([
        syncResult({
          state: {
            ...syncResult().state!,
            bossContents: [bossContent({ name: UNPRICED_BOSS, difficulty: '이지', isComplete: true })],
          },
        }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(getBossPartySizeMock).not.toHaveBeenCalled()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
      const row = useBossProfitStore.getState().rows[0]
      expect(row.partySize).toBeNull()
      expect(row.payoutMeso).toBeNull()
    })

    // 데이터 초기화(리로드) 직후 보스 스케줄러에 캐릭터를 저장하면
    // SQLite 읽기는 되지만(loadPartySizes), 리로드 이후 이 커넥션에 대한 첫 "쓰기" 쿼리
    // (upsertBossProfitRecord)가 stale 네이티브 커넥션 탓에 막혀 보스 수익 화면이
    // "불러오는 중..."에서 영원히 멈췄다. refresh가 SQLite 응답을 무한정 기다리지 않고
    // 타임아웃 후 기본값(파티원 1인)으로라도 화면을 완성해야 한다.
    it('upsertBossProfitRecord가 응답하지 않아도(hang) 타임아웃 후 기본 파티원 수로 loaded 상태가 된다', async () => {
      jest.useFakeTimers()
      try {
        getBossPartySizeMock.mockResolvedValue(null)
        upsertBossProfitRecordMock.mockImplementation(() => new Promise(() => {}))
        syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

        const refreshPromise = useBossProfitStore.getState().refresh(['ocid-1'])
        await jest.advanceTimersByTimeAsync(5000)
        await refreshPromise

        const state = useBossProfitStore.getState()
        expect(state.status).toBe('loaded')
        expect(state.rows[0].partySize).toBe(1)
        expect(state.rows[0].payoutMeso).toBe(8080000)
      } finally {
        jest.useRealTimers()
      }
    })

    // 원래 취지는 "조회가 멈춰도 화면이 '불러오는 중'에 영영 갇히지 않는다"이고 그대로
    // 유효하다. 다만 그때 party_size=1로 자동 기록하던 동작은으로 폐기했다.
    // 조회 실패를 "기록 없음"으로 읽고 사용자가 저장한 값을 덮어쓰는 데이터 손상 경로였다.
    it('getBossProfitRecords가 응답하지 않아도(hang) 타임아웃 후 멈추지 않고, 기본 파티원 수로 덮어쓰지도 않는다', async () => {
      jest.useFakeTimers()
      try {
        getBossProfitRecordsMock.mockImplementation(() => new Promise(() => {}))
        getBossPartySizeMock.mockResolvedValue(null)
        syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

        const refreshPromise = useBossProfitStore.getState().refresh(['ocid-1'])
        // withSqliteFallback 창은 **조회마다 하나**이고 캐시 단계와 동기화 완료 단계가 차례로 조회한다
        // (이후 캐시 단계는 캐시 행이 0이어도 조회한다. 그 진입이 복원이 겨누는
        // 시나리오다). 뒤 창은 앞 창이 끝난 뒤에야 시작하므로 두 번 나눠 흘려보내야 한다.
        await jest.advanceTimersByTimeAsync(5000) // 캐시 우선 표시 단계
        await jest.advanceTimersByTimeAsync(5000) // 동기화 완료 단계
        await refreshPromise

        const state = useBossProfitStore.getState()
        expect(state.status).toBe('loaded')
        expect(state.rows).toHaveLength(1)
        expect(state.rows[0].partySize).toBeNull()
        expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('setPartySize', () => {
    async function seedRow(overrides: Partial<BossContent> = {}) {
      syncSchedulesMock.mockResolvedValue([
        syncResult({
          state: {
            ...syncResult().state!,
            bossContents: [bossContent({ name: '자쿰', isComplete: true, ...overrides })],
          },
        }),
      ])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      // refresh 자체의 자동 기록 호출 이력을 지워, 아래 테스트들이 setPartySize 호출만 검증하게 한다.
      upsertBossProfitRecordMock.mockClear()
      return useBossProfitStore.getState().rows[0]
    }

    it('0 이하 값은 에러를 던지고 저장하지 않는다', async () => {
      const row = await seedRow()

      await expect(useBossProfitStore.getState().setPartySize(row, 0)).rejects.toThrow()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('음수 값은 에러를 던지고 저장하지 않는다', async () => {
      const row = await seedRow()

      await expect(useBossProfitStore.getState().setPartySize(row, -1)).rejects.toThrow()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('상한을 초과한 값은 에러를 던지고 저장하지 않는다', async () => {
      const row = await seedRow() // 자쿰: maxPartySize 기본값 6

      await expect(
        useBossProfitStore.getState().setPartySize(row, row.maxPartySize + 1),
      ).rejects.toThrow()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('정수가 아닌 값은 에러를 던지고 저장하지 않는다', async () => {
      const row = await seedRow()

      await expect(useBossProfitStore.getState().setPartySize(row, 1.5)).rejects.toThrow()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('유효한 값은 payoutMeso를 계산해 저장하고 rows에 반영한다', async () => {
      const row = await seedRow() // 자쿰 카오스: priceMeso 8080000

      await useBossProfitStore.getState().setPartySize(row, 2)

      expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          partySize: 2,
          priceMeso: 8080000,
          payoutMeso: 4040000,
        }),
      )
      const updated = useBossProfitStore.getState().rows[0]
      expect(updated.partySize).toBe(2)
      expect(updated.payoutMeso).toBe(4040000)
    })

    it('priceMeso가 null인 보스는 upsert를 호출하지 않지만 partySize는 로컬 상태에 반영된다', async () => {
      const row = await seedRow({ name: UNPRICED_BOSS, difficulty: '이지' })

      await useBossProfitStore.getState().setPartySize(row, 3)

      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
      const updated = useBossProfitStore.getState().rows[0]
      expect(updated.partySize).toBe(3)
      expect(updated.payoutMeso).toBeNull()
    })

    // 회귀 재현: setPartySize가 get.rows만 갱신하고 모듈 스코프
    // latestSyncSnapshot은 건드리지 않으면, loadPeriod의 "현재 기간" 분기가 이 스냅샷에서
    // 슬라이스할 때 방금 수정한 값이 낡은 값으로 되돌아간다. "파티원 수를 고쳐도 파티관리
    // 기본값으로 계속 돌아간다"로 보고된 증상의 실제 원인이었다. setPartySize가 스냅샷도
    // 함께 갱신하도록 고쳐 이 테스트가 통과한다.
    it('setPartySize 이후 다른 탭으로 이동했다가 돌아와도 수정한 값이 유지된다', async () => {
      const row = await seedRow() // 자쿰 카오스: priceMeso 8080000, 자동 기록 partySize 1

      await useBossProfitStore.getState().setPartySize(row, 4)
      expect(useBossProfitStore.getState().rows[0].partySize).toBe(4)

      await useBossProfitStore.getState().setTab('monthly')
      await useBossProfitStore.getState().setTab('weekly')

      const revertedRow = useBossProfitStore.getState().rows[0]
      expect(revertedRow.partySize).toBe(4)
      expect(revertedRow.payoutMeso).toBe(2020000)
    })
  })

  describe('추적 목록', () => {
    it('loadTrackedOcids는 storage에서 조회한 값을 trackedOcids 상태에 반영한다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossProfitStore.getState().loadTrackedOcids()

      expect(getTrackedCharacterOcidsMock).toHaveBeenCalledWith()
      expect(useBossProfitStore.getState().trackedOcids).toEqual(['ocid-1'])
    })

    it('loadTrackedOcids는 조회된 목록이 null이면 refresh를 호출하지 않는다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(null)

      await useBossProfitStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(useBossProfitStore.getState().trackedOcids).toBeNull()
    })

    // 부팅 선하이드레이션과 화면 마운트가 반드시 겹치므로, 동시 호출은
    // 한 회차로 합친다. 안 그러면 같은 응답을 두 번 받는다(없애려던 낭비).
    it('loadTrackedOcids를 동시에 두 번 불러도 한 회차만 돈다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await Promise.all([
        useBossProfitStore.getState().loadTrackedOcids(),
        useBossProfitStore.getState().loadTrackedOcids(),
      ])

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
    })

    // "평생 한 번"이 아니라 "동시에 하나만"이다. 영구 메모면 진입 재조회의 10분 TTL 이 죽는다.
    it('앞 회차가 끝난 뒤에 부르면 다시 돈다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossProfitStore.getState().loadTrackedOcids()
      await useBossProfitStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('캐시 우선 표시', () => {
    function cachedEntry(overrides: Partial<CachedSchedulerEntry['state']> = {}): CachedSchedulerEntry {
      return {
        state: {
          asOf: '2026-07-09T00:00+09:00',
          characterName: '캐시캐릭터',
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
          ...overrides,
        },
        syncedAt: '2026-07-10T00:00:00.000Z',
      }
    }

    function flushMicrotasks() {
      return new Promise((resolve) => setTimeout(resolve, 0))
    }

    it('syncSchedules가 아직 끝나지 않아도 캐시된 완료 보스로 rows를 먼저 채우고, 캐시 단계에서는 자동 기록(upsert) 관련 함수를 호출하지 않는다', async () => {
      getCachedSchedulerStateMock.mockResolvedValue(cachedEntry())

      let resolveSync!: (value: CharacterScheduleSync[]) => void
      const pending = new Promise<CharacterScheduleSync[]>((resolve) => {
        resolveSync = resolve
      })
      syncSchedulesMock.mockReturnValue(pending)

      const refreshPromise = useBossProfitStore.getState().refresh(['ocid-1'])
      await flushMicrotasks()

      const midState = useBossProfitStore.getState()
      expect(midState.status).toBe('loading')
      expect(midState.rows).toHaveLength(1)
      expect(midState.rows[0].boss).toBe('자쿰')
      expect(midState.rows[0].ocid).toBe('ocid-1')
      expect(midState.rows[0].characterName).toBe('캐시캐릭터')
      expect(midState.rows[0].partySize).toBeNull()
      expect(midState.rows[0].payoutMeso).toBeNull()
      // 캐시 단계도 기존 기록 유무를 확인하려고 getBossProfitRecords는 호출한다(읽기 전용).
      // 다만 자동 기록(upsert)·파티 설정 조회는 재검증 이후에만 수행한다.
      expect(getBossProfitRecordsMock).toHaveBeenCalled()
      expect(getBossPartySizeMock).not.toHaveBeenCalled()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()

      resolveSync(
        [syncResult()], // 자쿰 카오스, priceMeso 8080000
      )
      await refreshPromise

      const finalState = useBossProfitStore.getState()
      expect(finalState.status).toBe('loaded')
      expect(finalState.rows).toHaveLength(1)
      expect(finalState.rows[0].partySize).toBe(1)
      expect(finalState.rows[0].payoutMeso).toBe(8080000)
      expect(getBossPartySizeMock).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스')
      expect(upsertBossProfitRecordMock).toHaveBeenCalled()
    })

    it('캐시 단계에서도 이미 저장된 기록이 있으면 partySize/payoutMeso가 즉시 반영된다(0메소로 잠깐 보이는 깜빡임 방지)', async () => {
      // 실제 periodKey 계산값을 얻기 위해 먼저 한 번 정상적으로 refresh한다.
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000
      getCachedSchedulerStateMock.mockResolvedValue(null)
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const periodKey = useBossProfitStore.getState().rows[0].periodKey

      const record: BossProfitRecord = {
        ocid: 'ocid-1',
        boss: '자쿰',
        difficulty: '카오스',
        cycle: 'weekly',
        periodKey,
        partySize: 2,
        priceMeso: 8080000,
        payoutMeso: 4040000,
        recordedAt: '2026-07-10T00:00:00.000Z',
        world: null,
      }
      jest.clearAllMocks() // 위 준비용 refresh에서 쌓인 호출 기록(자동 기록 포함)을 지운다
      getBossProfitRecordsMock.mockResolvedValue([record])
      getCachedSchedulerStateMock.mockResolvedValue(cachedEntry())

      const pending = new Promise<CharacterScheduleSync[]>(() => {
        // 의도적으로 resolve하지 않음. 캐시 단계 직후 상태만 확인
      })
      syncSchedulesMock.mockReturnValue(pending)

      void useBossProfitStore.getState().refresh(['ocid-1'])
      await flushMicrotasks()

      const midState = useBossProfitStore.getState()
      expect(midState.rows).toHaveLength(1)
      expect(midState.rows[0].partySize).toBe(2)
      expect(midState.rows[0].payoutMeso).toBe(4040000)
      expect(getBossPartySizeMock).not.toHaveBeenCalled()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('캐시가 없는 ocid는 캐시 단계 rows에 포함되지 않는다', async () => {
      getCachedSchedulerStateMock.mockResolvedValue(null)

      const pending = new Promise<CharacterScheduleSync[]>(() => {
        // 의도적으로 resolve하지 않음. 캐시 단계 직후 상태만 확인
      })
      syncSchedulesMock.mockReturnValue(pending)

      void useBossProfitStore.getState().refresh(['ocid-1'])
      await flushMicrotasks()

      const midState = useBossProfitStore.getState()
      expect(midState.status).toBe('loading')
      expect(midState.rows).toEqual([])
    })

    it('캐시의 미등록·미처치 보스는 캐시 단계 rows에서도 제외된다', async () => {
      getCachedSchedulerStateMock.mockResolvedValue(
        cachedEntry({ bossContents: [bossContent({ isRegistered: false, isComplete: false })] }),
      )

      const pending = new Promise<CharacterScheduleSync[]>(() => {})
      syncSchedulesMock.mockReturnValue(pending)

      void useBossProfitStore.getState().refresh(['ocid-1'])
      await flushMicrotasks()

      expect(useBossProfitStore.getState().rows).toEqual([])
    })

    it('캐시의 등록됐지만 미처치인 보스는 캐시 단계에서도 미완료 placeholder로 즉시 보여준다', async () => {
      getCachedSchedulerStateMock.mockResolvedValue(
        cachedEntry({ bossContents: [bossContent({ isRegistered: true, isComplete: false })] }),
      )

      const pending = new Promise<CharacterScheduleSync[]>(() => {})
      syncSchedulesMock.mockReturnValue(pending)

      void useBossProfitStore.getState().refresh(['ocid-1'])
      await flushMicrotasks()

      const rows = useBossProfitStore.getState().rows
      expect(rows).toHaveLength(1)
      expect(rows[0].isComplete).toBe(false)
      expect(rows[0].payoutMeso).toBe(0)
    })

    it('월간 탭 캐시 단계에서도 이미 확정된 지난 주차 합계가 즉시 반영된다(syncSchedules 응답 전 weeklySubtotals 누락 방지)', async () => {
      // 이번 달에 반드시 "지난 주차"가 존재하도록 날짜를 고정한다(월초에 테스트를 실행하면
      // 지난 주차가 아예 없어 전제가 깨지는 걸 방지). Date만 고정하고 타이머는 실제로 둬서
      // 아래 flushMicrotasks(실제 setTimeout 기반)가 그대로 동작하게 한다.
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-30T06:00:00.000Z'))

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        await useBossProfitStore.getState().refresh(['ocid-1'])
        await useBossProfitStore.getState().setTab('monthly')

        const monthPeriodKey = useBossProfitStore.getState().periodKey
        const currentWeeklyPeriodKey = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
        const pastWeekKey = getWeeklyPeriodKeysInMonth(monthPeriodKey).find(
          (key) => key < currentWeeklyPeriodKey,
        )
        if (pastWeekKey === undefined) {
          throw new Error('테스트 전제 실패: 고정한 날짜 기준 이번 달에 지난 주차가 있어야 한다')
        }

        const pastRecord: BossProfitRecord = {
          ocid: 'ocid-1',
          boss: '스우',
          difficulty: '노멀',
          cycle: 'weekly',
          periodKey: pastWeekKey,
          partySize: 2,
          priceMeso: 4_000_000,
          payoutMeso: 2_000_000,
          recordedAt: '2026-07-01T00:00:00.000Z',
          world: null,
        }

        jest.clearAllMocks()
        getBossProfitRecordsMock.mockResolvedValue([pastRecord])
        getCachedSchedulerStateMock.mockResolvedValue(cachedEntry())
        getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
          profile: { name: `캐릭터-${ocid}`, level: 200, imageUrl: 'x', accessFlag: true },
          cachedAt: '2026-07-01T00:00:00.000Z',
        }))

        const pending = new Promise<CharacterScheduleSync[]>(() => {})
        syncSchedulesMock.mockReturnValue(pending)

        void useBossProfitStore.getState().refresh(['ocid-1'])
        await flushMicrotasks()

        const midState = useBossProfitStore.getState()
        expect(midState.status).toBe('loading')
        const pastSubtotal = midState.weeklySubtotals.find((subtotal) => subtotal.periodKey === pastWeekKey)
        expect(pastSubtotal).toBeDefined()
        expect(pastSubtotal?.totalMeso).toBe(2_000_000)
        expect(pastSubtotal?.state).toBe('recorded')
      } finally {
        jest.useRealTimers()
      }
    })
  })

  // 기록은 있는데 응답에 행이 없는 조합의 복원이 동기화 완료 분기에만 있으면, 건너뛴 진입은
  // 캐시 단계가 곧 최종 화면이라 그 조합이 총 수익에서 통째로 빠진다. 문제가 난 경로는 미접속
  // 캐릭터의 축약 응답이다(월간 보스를 처치한 뒤 1주 이상 미접속 → bossMonthly 가
  // reg=false·comp=false 로만 남음).
  describe('캐시 단계의 기록만 있는 조합 복원', () => {
    function minutesAgo(minutes: number): string {
      return new Date(Date.now() - minutes * 60 * 1000).toISOString()
    }

    // bossContents 를 통째로 비운 축약 응답. 이 캐릭터는 캐시 단계에서 행을 하나도 만들지 못한다.
    function cachedEntry(
      characterName: string,
      syncedAt: string,
      bossContents: BossContent[] = [],
    ): CachedSchedulerEntry {
      return {
        state: {
          asOf: '2026-07-09T00:00+09:00',
          characterName,
          world: '베라',
          level: 200,
          jobClass: '렌',
          dailyContents: [],
          weeklyContents: [],
          bossContents,
          isDailyStale: false,
          isWeeklyStale: false,
          isWeeklyBossStale: false,
          isMonthlyBossStale: false,
        },
        syncedAt,
      }
    }

    function monthlyRecord(ocid: string, periodKey: string): BossProfitRecord {
      return {
        ocid,
        boss: '검은 마법사',
        difficulty: '하드',
        cycle: 'monthly',
        periodKey,
        partySize: 1,
        priceMeso: 665_000_000,
        payoutMeso: 665_000_000,
        recordedAt: '2026-07-01T00:00:00.000Z',
        world: '베라',
      }
    }

    // 월간 탭을 보고 있는 상태에서 시작한다. 문제가 난 경로가 월간 보스라 그 화면이 증상이 나는 자리다.
    // 현재 달은 최신 기간이라 containsInProgressWeek 가 false 이므로 제자리 새로고침 분기로 새지 않는다.
    function seedMonthlyTab(): string {
      const monthKey = getCurrentBossProfitPeriod('monthly', new Date()).periodKey
      useBossProfitStore.setState({ tab: 'monthly', periodKey: monthKey })
      return monthKey
    }

    it('캐시에 행이 없고 기록만 있는 조합이 캐시 단계에서 행으로 복원돼 금액이 그대로 실린다', async () => {
      const monthKey = seedMonthlyTab()
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockResolvedValue(cachedEntry('캐시캐릭터', minutesAgo(5)))
      getBossProfitRecordsMock.mockImplementation(async (_ocids: string[], keys: string[]) =>
        keys.includes(monthKey) ? [monthlyRecord('ocid-1', monthKey)] : [],
      )

      await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      const rows = useBossProfitStore.getState().rows
      expect(rows).toHaveLength(1)
      expect(rows[0].boss).toBe('검은 마법사')
      expect(rows[0].periodKey).toBe(monthKey)
      expect(rows[0].payoutMeso).toBe(665_000_000)
    })

    // 조회할 기간 키를 캐시 행에서만 파생하면 **행이 없는 기간의 기록을 조회조차 하지 않아** 되살릴
    // 재료가 없다. 동기화 분기가 같은 이유로 이미 현재 주·달 키를 항상 넣는다.
    it('캐시 행이 하나도 없어도 기록 조회 기간 키에 현재 주·달 키가 들어간다', async () => {
      const now = new Date()
      const weekKey = getCurrentBossProfitPeriod('weekly', now).periodKey
      const monthKey = getCurrentBossProfitPeriod('monthly', now).periodKey
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockResolvedValue(cachedEntry('캐시캐릭터', minutesAgo(5)))

      await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

      const queried = getBossProfitRecordsMock.mock.calls.map((call) => call[1] as string[])
      expect(queried.some((keys) => keys.includes(weekKey) && keys.includes(monthKey))).toBe(true)
    })

    // 프로필 맵을 캐시 **행**에서 만들면 축약 응답으로 행이 0인 캐릭터는 프로필이 없고,
    // appendRecordOnlyRows 가 그 캐릭터를 통째로 건너뛴다. 이 결정이 고치려는 시나리오가 프로필
    // 부재로 다시 막힌다. 그래서 프로필은 캐시 **엔트리**에서 만든다.
    it('행이 0인 캐릭터도 복원 대상이고 그 캐시 엔트리의 캐릭터명이 실린다', async () => {
      const monthKey = seedMonthlyTab()
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockImplementation(async (ocid: string) =>
        ocid === 'ocid-1'
          ? cachedEntry('행있는캐릭터', minutesAgo(5), [bossContent()])
          : cachedEntry('행없는캐릭터', minutesAgo(5)),
      )
      getBossProfitRecordsMock.mockImplementation(async (_ocids: string[], keys: string[]) =>
        keys.includes(monthKey) ? [monthlyRecord('ocid-2', monthKey)] : [],
      )

      await useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'], { auto: true })

      const rows = useBossProfitStore.getState().rows
      expect(rows).toHaveLength(1) // 월간 탭이라 ocid-1 의 주간 캐시 행은 걸러진다
      expect(rows[0].ocid).toBe('ocid-2')
      expect(rows[0].characterName).toBe('행없는캐릭터')
    })

    // 복원 행은 기록에서 나와 partySize 가 이미 채워져 있다. 다시 기록하면 사용자가 저장한 값을
    // 덮어쓸 위험만 생긴다. 그래서 복원은 자동 기록 루프보다 **뒤**다(동기화 분기도 같은 순서다).
    // 앞에 두면 루프가 그 행들을 헛도는데, 그 헛돎은 upsert 가 아니라 **드롭 이관**으로 드러난다
    // (복원 행도 isComplete: true 라 이관 조건은 통과한다). 그래서 둘을 함께 본다.
    it('복원된 행은 자동 기록 루프를 타지 않는다(기록도 드롭 이관도 캐시 행에만 일어난다)', async () => {
      const weekKey = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockResolvedValue(
        cachedEntry('캐시캐릭터', minutesAgo(5), [bossContent()]), // 자쿰 카오스. 기록 없음
      )
      getBossProfitRecordsMock.mockImplementation(async (_ocids: string[], keys: string[]) =>
        keys.includes(weekKey)
          ? [{ ...monthlyRecord('ocid-1', weekKey), boss: '스우', difficulty: '하드', cycle: 'weekly' as const }]
          : [],
      )
      getBossDropRecordsMock.mockResolvedValue([
        {
          ocid: 'ocid-1',
          boss: '스우',
          difficulty: '익스트림', // 복원 행이 루프를 타면 확정 난이도(하드)로 옮겨졌을 옛 키
          periodKey: weekKey,
          dropIndex: 0,
          category: 'equipment',
          itemName: '루즈 컨트롤 머신 마크',
          slot: '얼굴장식',
          boxOrigin: null,
          ringLevel: null,
          quantity: 1,
        },
      ])

      await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

      expect(useBossProfitStore.getState().rows.map((row) => row.boss)).toContain('스우') // 복원은 됐다
      const recordedBosses = upsertBossProfitRecordMock.mock.calls.map((call) => call[0].boss)
      expect(recordedBosses).toEqual(['자쿰']) // 캐시 행만. 복원 행(스우)은 빠진다
      const migratedBosses = replaceBossDropRecordsMock.mock.calls.map((call) => call[1] as string)
      expect(migratedBosses).not.toContain('스우')
    })

    // 복원은 skipSync 여부와 무관하게 캐시 단계 일반에 적용한다. 두 경로가 서로 다른 화면을
    // 그리면 그것이 다음 결함이 된다. 동기화를 실패시켜 캐시 단계가 그린 화면만 남긴다.
    it('건너뛰지 않는 진입의 캐시 단계에서도 복원이 일어난다', async () => {
      const monthKey = seedMonthlyTab()
      getCachedSchedulerStateMock.mockResolvedValue(cachedEntry('캐시캐릭터', minutesAgo(5)))
      getBossProfitRecordsMock.mockImplementation(async (_ocids: string[], keys: string[]) =>
        keys.includes(monthKey) ? [monthlyRecord('ocid-1', monthKey)] : [],
      )
      syncSchedulesMock.mockRejectedValue(new Error('network'))

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1) // 건너뛴 진입이 아니다
      const rows = useBossProfitStore.getState().rows
      expect(rows).toHaveLength(1)
      expect(rows[0].boss).toBe('검은 마법사')
    })

    // 복원 행이 정렬 밖에 남으면(그냥 뒤에 붙으면) 캐릭터 아코디언 순서가 흔들린다.
    // 정렬은 복원까지 끝낸 뒤 한 번만 한다.
    it('복원된 행도 캐릭터 정렬 순서(레벨 내림차순)를 따른다', async () => {
      const monthKey = seedMonthlyTab()
      markSyncAttemptedThisRun()
      // ocid-2 가 레벨이 높아 앞에 와야 한다. 그 캐릭터의 행이 복원으로 만들어진 것이다.
      getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
        profile: {
          name: `캐릭터-${ocid}`,
          level: ocid === 'ocid-2' ? 280 : 200,
          imageUrl: 'x',
          accessFlag: true,
        },
        cachedAt: '2026-07-01T00:00:00.000Z',
      }))
      getCachedSchedulerStateMock.mockImplementation(async (ocid: string) =>
        ocid === 'ocid-1'
          ? cachedEntry('낮은레벨', minutesAgo(5), [
              bossContent({ name: '검은마법사', difficulty: '하드', cycle: 'monthly' }),
            ])
          : cachedEntry('높은레벨', minutesAgo(5)),
      )
      getBossProfitRecordsMock.mockImplementation(async (_ocids: string[], keys: string[]) =>
        keys.includes(monthKey) ? [monthlyRecord('ocid-2', monthKey)] : [],
      )

      await useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'], { auto: true })

      expect(useBossProfitStore.getState().rows.map((row) => row.ocid)).toEqual(['ocid-2', 'ocid-1'])
    })
  })

  // 월드는 imageUrl과 똑같은 경로(getSortedCharacterInfo → getCachedCharacterBasic)로
  // 행까지 실려온다. 행이 만들어지는 세 경로(캐시 우선 표시·실시간 동기화·과거 기록) 전부 채워져야
  // 한 곳만 비어 로드 시점에 따라 월드 집계가 흔들리는 일이 없다.
  describe('월드 배관', () => {
    function cachedSchedulerEntry(): CachedSchedulerEntry {
      return {
        state: {
          asOf: '2026-07-09T00:00+09:00',
          characterName: '캐시캐릭터',
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
        syncedAt: '2026-07-10T00:00:00.000Z',
      }
    }

    // world를 넘기지 않으면 world 키가 아예 없는(= 구버전) 캐시 프로필이 된다.
    function mockCachedBasicWorld(world?: string) {
      getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
        profile: {
          name: `캐릭터-${ocid}`,
          level: 200,
          imageUrl: 'x',
          accessFlag: true,
          ...(world === undefined ? {} : { world }),
        },
        cachedAt: '2026-07-01T00:00:00.000Z',
      }))
    }

    it('캐시 우선 표시 경로의 row에 character-basic-cache의 world가 실린다', async () => {
      mockCachedBasicWorld('스카니아')
      getCachedSchedulerStateMock.mockResolvedValue(cachedSchedulerEntry())
      syncSchedulesMock.mockReturnValue(new Promise<CharacterScheduleSync[]>(() => {}))

      void useBossProfitStore.getState().refresh(['ocid-1'])
      await waitFor(() => expect(useBossProfitStore.getState().rows).toHaveLength(1))

      const row = useBossProfitStore.getState().rows[0]
      expect(row.characterName).toBe('캐시캐릭터') // 캐시 경로임을 확인
      expect(row.world).toBe('스카니아')
    })

    it('실시간 동기화 경로의 row에도 world가 실린다', async () => {
      mockCachedBasicWorld('스카니아')
      syncSchedulesMock.mockResolvedValue([syncResult({ characterName: '라이브이름' })])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      const row = useBossProfitStore.getState().rows[0]
      expect(row.characterName).toBe('라이브이름') // 라이브 경로임을 확인
      expect(row.world).toBe('스카니아')
    })

    // world는 옵셔널이라 이전 캐시엔 없다(그런 캐릭터는 월드 집계에서 제외된다).
    // 화면이 부재를 한 가지 형태로만 다루도록 imageUrl과 동일하게 null로 정규화한다.
    it('구버전 캐시라 profile.world가 없으면 row.world는 undefined가 아니라 null이다', async () => {
      mockCachedBasicWorld(undefined)
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(useBossProfitStore.getState().rows[0].world).toBeNull()
    })

    it('과거 기간(로컬 기록) 경로의 row에도 world가 실린다', async () => {
      mockCachedBasicWorld('루나')
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const previousPeriodKey = getAdjacentPeriodKey(
        'weekly',
        useBossProfitStore.getState().periodKey,
        'prev',
      )

      const pastRecord: BossProfitRecord = {
        ocid: 'ocid-1',
        boss: '자쿰',
        difficulty: '카오스',
        cycle: 'weekly',
        periodKey: previousPeriodKey,
        partySize: 1,
        priceMeso: 8_080_000,
        payoutMeso: 8_080_000,
        recordedAt: '2026-07-01T00:00:00.000Z',
        world: null,
      }
      getBossProfitRecordsMock.mockResolvedValue([pastRecord])

      await useBossProfitStore.getState().goToPreviousPeriod()

      const state = useBossProfitStore.getState()
      expect(state.periodKey).toBe(previousPeriodKey)
      expect(state.rows).toHaveLength(1)
      expect(state.rows[0].world).toBe('루나')
    })

    // 회귀 가드: world는 정렬에 참여하지 않는다(캐릭터는 레벨 내림차순 → 이름순).
    it('world를 실어도 캐릭터 정렬 순서(레벨 내림차순 → 이름순)는 그대로다', async () => {
      const profiles: Record<string, { name: string; level: number; world: string }> = {
        'ocid-1': { name: '가나다', level: 200, world: '핼퍼' },
        'ocid-2': { name: '나다라', level: 200, world: '가베라' },
        'ocid-3': { name: '다라마', level: 250, world: '나스카니아' },
      }
      // 월드명 가나다순(가베라 → 나스카니아 → 핼퍼)은 기대 순서와 어긋나게 배치했다. 월드가
      // 정렬 키에 끼어들면 이 테스트가 깨진다.
      getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
        profile: { ...profiles[ocid], imageUrl: 'x', accessFlag: true },
        cachedAt: '2026-07-01T00:00:00.000Z',
      }))
      syncSchedulesMock.mockResolvedValue([
        syncResult({ ocid: 'ocid-1', characterName: '가나다' }),
        syncResult({ ocid: 'ocid-2', characterName: '나다라' }),
        syncResult({ ocid: 'ocid-3', characterName: '다라마' }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2', 'ocid-3'])

      // 레벨 250인 ocid-3이 먼저, 동레벨 둘은 이름순(가나다 → 나다라)
      expect(useBossProfitStore.getState().rows.map((row) => row.ocid)).toEqual([
        'ocid-3',
        'ocid-1',
        'ocid-2',
      ])
    })
  })

  // 증감 칩의 비교 기준. 기록 합만 보고 기간 상태는 묻지 않는다.
  describe('직전 기간 총 수익', () => {
    function record(overrides: Partial<BossProfitRecord> = {}): BossProfitRecord {
      return {
        ocid: 'ocid-1',
        boss: '자쿰',
        difficulty: '카오스',
        cycle: 'weekly',
        periodKey: '2026-07-09',
        partySize: 1,
        priceMeso: 8_080_000,
        payoutMeso: 8_080_000,
        recordedAt: '2026-07-10T00:00:00.000Z',
        world: '베라',
        ...overrides,
      }
    }

    it('주간 탭은 직전 주 기록만 합산한다', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00')) // 이번 주 2026-07-16, 직전 주 2026-07-09
      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        getBossProfitRecordsMock.mockImplementation(async (_ocids: string[], keys: string[]) =>
          keys.includes('2026-07-09')
            ? [record({ payoutMeso: 5_000_000 }), record({ boss: '매그너스', payoutMeso: 3_000_000 })]
            : [],
        )

        await useBossProfitStore.getState().refresh(['ocid-1'])

        expect(getBossProfitRecordsMock).toHaveBeenCalledWith(['ocid-1'], ['2026-07-09'])
        expect(useBossProfitStore.getState().previousPeriodTotalMeso).toBe(8_000_000)
      } finally {
        jest.useRealTimers()
      }
    })

    // 월간 탭 총액은 monthly 보스 행 + 그 달의 주차별 합계라(groupTotalMeso), 직전 달 합계도 같은 산식이다.
    it('월간 탭은 직전 달 monthly 기록과 그 달에 속한 weekly 기록을 함께 합산한다', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00')) // 이번 달 2026-07, 직전 달 2026-06
      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        getBossProfitRecordsMock.mockImplementation(async (_ocids: string[], keys: string[]) => {
          if (!keys.includes('2026-06')) return []
          return [
            record({ cycle: 'monthly', boss: '검은 마법사', periodKey: '2026-06', payoutMeso: 10_000_000 }),
            record({ periodKey: '2026-06-04', payoutMeso: 1_000_000 }),
            record({ periodKey: '2026-06-25', payoutMeso: 2_000_000 }),
          ]
        })

        await useBossProfitStore.getState().setTab('monthly')

        const keys = getBossProfitRecordsMock.mock.calls.map((call) => call[1] as string[]).find((k) => k.includes('2026-06'))
        expect(keys).toEqual(['2026-06', '2026-06-04', '2026-06-11', '2026-06-18', '2026-06-25'])
        expect(useBossProfitStore.getState().previousPeriodTotalMeso).toBe(13_000_000)
      } finally {
        jest.useRealTimers()
      }
    })

    it('직전 기간 기록이 없으면 0이다. 조회한 적 없는 기간도 같다(결정 3)', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00'))
      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        getBossProfitRecordsMock.mockResolvedValue([])

        await useBossProfitStore.getState().refresh(['ocid-1'])

        expect(useBossProfitStore.getState().previousPeriodTotalMeso).toBe(0)
      } finally {
        jest.useRealTimers()
      }
    })

    it('과거 기간으로 이동하면 그 기간의 직전 기간으로 기준이 바뀐다', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00')) // 이번 주 2026-07-16
      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        getBossProfitRecordsMock.mockImplementation(async (_ocids: string[], keys: string[]) =>
          keys.includes('2026-07-02') ? [record({ periodKey: '2026-07-02', payoutMeso: 777 })] : [],
        )

        await useBossProfitStore.getState().refresh(['ocid-1'])
        await useBossProfitStore.getState().goToPreviousPeriod() // → 2026-07-09, 직전은 2026-07-02

        expect(useBossProfitStore.getState().periodKey).toBe('2026-07-09')
        expect(useBossProfitStore.getState().previousPeriodTotalMeso).toBe(777)
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('기간 네비게이션', () => {
    function schedulerState(overrides: Partial<SchedulerCharacterState> = {}): SchedulerCharacterState {
      return {
        asOf: '2026-06-04T00:00+09:00',
        characterName: '낟낟',
        world: '베라',
        level: 200,
        jobClass: '렌',
        dailyContents: [],
        weeklyContents: [],
        bossContents: [],
        isDailyStale: false,
        isWeeklyStale: false,
        isWeeklyBossStale: false,
        isMonthlyBossStale: false,
        ...overrides,
      }
    }

    it('refresh(조회 중)가 진행 중일 때 과거 기간으로 이동 후 다시 돌아와도 status가 loading에 갇히지 않는다', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00')) // 이번 주 2026-07-16, 롤링 하한 2026-07-09
      try {
        // syncSchedules를 수동 제어해 "조회 중"(status: 'loading') 상태를 유지시킨다.
        let resolveSync!: (value: Awaited<ReturnType<typeof syncSchedulesMock>>) => void
        syncSchedulesMock.mockReturnValue(
          new Promise((resolve) => {
            resolveSync = resolve
          }),
        )
        getBossProfitRecordsMock.mockResolvedValue([])

        const refreshPromise = useBossProfitStore.getState().refresh(['ocid-1'])

        // 캐시 우선 단계에서 status가 'loading'이 된다.
        await waitFor(() => {
          expect(useBossProfitStore.getState().status).toBe('loading')
        })

        // 조회 중일 때 과거 기간으로 이동하면, 정착 후 status는 더 이상 'loading'이 아니어야 한다.
        await useBossProfitStore.getState().goToPreviousPeriod()
        expect(useBossProfitStore.getState().periodKey).toBe('2026-07-09')
        expect(useBossProfitStore.getState().status).toBe('loaded')

        // 뒤늦게 끝난 refresh는 세대 불일치로 화면(rows/status)을 덮어쓰지 않지만, 동기화가 실제로
        // 성공했으므로 lastSyncedAt만은 기록돼야 한다. 그렇지 않으면 현재 기간 복귀 시 신선한
        // 데이터를 보여주면서도 "동기화 기록 없음"으로 표시된다.
        expect(useBossProfitStore.getState().lastSyncedAt).toBeNull()
        resolveSync([syncResult()])
        await refreshPromise
        expect(useBossProfitStore.getState().status).toBe('loaded')
        expect(useBossProfitStore.getState().lastSyncedAt).not.toBeNull()

        // 다시 이번 주로 돌아와도 "조회 중..."에 무한히 갇히지 않고, 동기화 시각도 유지된다.
        await useBossProfitStore.getState().goToNextPeriod()
        expect(useBossProfitStore.getState().periodKey).toBe('2026-07-16')
        expect(useBossProfitStore.getState().status).toBe('loaded')
        expect(useBossProfitStore.getState().lastSyncedAt).not.toBeNull()
      } finally {
        jest.useRealTimers()
      }
    })

    it('goToPreviousPeriod: 이미 체크된 과거 주는 API 호출 없이 로컬 기록만으로 rows를 채운다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, 이번 주
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const currentPeriodKey = useBossProfitStore.getState().periodKey
      const previousPeriodKey = getAdjacentPeriodKey('weekly', currentPeriodKey, 'prev')

      const pastRecord: BossProfitRecord = {
        ocid: 'ocid-1',
        boss: '자쿰',
        difficulty: '카오스',
        cycle: 'weekly',
        periodKey: previousPeriodKey,
        partySize: 3,
        priceMeso: 8_080_000,
        payoutMeso: 2_693_333,
        recordedAt: '2026-06-01T00:00:00.000Z',
        world: null,
      }
      getBossProfitRecordsMock.mockResolvedValue([pastRecord])
      getCachedCharacterBasicMock.mockResolvedValue({
        profile: { name: '낟낟', level: 200, imageUrl: 'x', accessFlag: true },
        cachedAt: '2026-06-01T00:00:00.000Z',
      })

      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
      const state = useBossProfitStore.getState()
      expect(state.periodKey).toBe(previousPeriodKey)
      expect(state.rows).toHaveLength(1)
      expect(state.rows[0].characterName).toBe('낟낟')
      expect(state.rows[0].imageUrl).toBe('x') // 과거 기간도 character-basic-cache에서 이미지 복원
      expect(state.rows[0].partySize).toBe(3)
      expect(state.rows[0].payoutMeso).toBe(2_693_333)
      expect(state.isPeriodLoading).toBe(false)
      // boolean 플래그가 6상태로 대체됐다. 기록이 있으면 recorded다.
      expect(state.periodState).toBe('recorded')
    })

    // 한 번의 기간 로드에서 캐릭터 프로필 캐시를 캐릭터당 한 번만 읽는다.
    // 전에는 getSortedCharacterInfo가 읽은 결과를 버리고 buildRowsFromRecords가 다시,
    // buildWeeklySubtotalsForMonth가 빈 knownProfiles를 받아 또 읽어 3배로 왕복했다.
    it('goToPreviousPeriod: 캐릭터 프로필 캐시를 캐릭터당 한 번만 읽는다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const previousPeriodKey = getAdjacentPeriodKey(
        'weekly',
        useBossProfitStore.getState().periodKey,
        'prev',
      )

      getBossProfitRecordsMock.mockResolvedValue([
        {
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          cycle: 'weekly',
          periodKey: previousPeriodKey,
          partySize: 3,
          priceMeso: 8_080_000,
          payoutMeso: 2_693_333,
          recordedAt: '2026-06-01T00:00:00.000Z',
          world: null,
        } satisfies BossProfitRecord,
      ])
      getCachedCharacterBasicMock.mockResolvedValue({
        profile: { name: '낟낟', level: 200, imageUrl: 'x', accessFlag: true },
        cachedAt: '2026-06-01T00:00:00.000Z',
      })

      getCachedCharacterBasicMock.mockClear()
      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(getCachedCharacterBasicMock).toHaveBeenCalledTimes(1)
      // 조회를 줄여도 화면 값은 그대로다. 캐시에서 오던 이름·이미지가 계속 채워진다.
      expect(useBossProfitStore.getState().rows[0].characterName).toBe('낟낟')
      expect(useBossProfitStore.getState().rows[0].imageUrl).toBe('x')
    })

    // 후속: 캐시가 없는 ocid를 결과에서 빼는 규칙을 조회 재사용이 깨뜨리면 안 된다.
    // getSortedCharacterInfo는 이름을 ''로 채우므로 그대로 넘기면 "캐시 없음"이 빈 이름으로 둔갑한다.
    it('goToPreviousPeriod: 프로필 캐시가 없는 캐릭터의 기록은 계속 제외된다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const previousPeriodKey = getAdjacentPeriodKey(
        'weekly',
        useBossProfitStore.getState().periodKey,
        'prev',
      )

      getBossProfitRecordsMock.mockResolvedValue([
        {
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          cycle: 'weekly',
          periodKey: previousPeriodKey,
          partySize: 3,
          priceMeso: 8_080_000,
          payoutMeso: 2_693_333,
          recordedAt: '2026-06-01T00:00:00.000Z',
          world: null,
        } satisfies BossProfitRecord,
      ])
      getCachedCharacterBasicMock.mockResolvedValue(null)

      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(useBossProfitStore.getState().rows).toEqual([])
    })

    // 당김은 보던 기간을 안 떠난다. 지난 주에서 당겼는데 이번 주로 튀면 사용자가 보던 것을
    // 잃는다. 전에는 이 화면에서 당김 자체를 못 하게 막아 이 물음이 없었다.
    it('지난 기간에서 새로고침해도 그 기간에 남는다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      await useBossProfitStore.getState().goToPreviousPeriod()
      const 보던기간 = useBossProfitStore.getState().periodKey

      await useBossProfitStore.getState().refresh(['ocid-1'], { inPlace: true })

      expect(useBossProfitStore.getState().periodKey).toBe(보던기간)
    })

    // 경계를 막 넘어 낡아진 기간은 현재 기간으로 데려온다. 그 일은 `inPlace` 없이 부르는
    // 회차(진입·자동)의 몫이다.
    it('inPlace 없이 부르면 현재 기간으로 되돌린다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const 이번기간 = useBossProfitStore.getState().periodKey
      await useBossProfitStore.getState().goToPreviousPeriod()

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(useBossProfitStore.getState().periodKey).toBe(이번기간)
    })

    // 현재 기간에서는 종전대로 현재 기간을 다시 그린다.
    it('현재 기간에서 새로고침하면 현재 기간 그대로다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const 이번기간 = useBossProfitStore.getState().periodKey

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(useBossProfitStore.getState().periodKey).toBe(이번기간)
    })

    // ⚠️ 사용자 보고. 기간 스태퍼를 연타하면 조회 가능 기간이 아닌데도 과거로 계속 넘어갔다.
    //
    // `canGoPreviousPeriod` 는 **직전 로드가 남긴 값**이다. 로드가 끝나기 전에 또 누르면 그
    // 낡은 참을 읽어 한 칸 더 간다. 창 동기화를 기다리게 되면서 그 창이 훨씬 넓어졌다.
    it('goToPreviousPeriod: 연타해도 한 칸만 간다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const 시작 = useBossProfitStore.getState().periodKey

      // 로드가 끝나기 전에 세 번 누른 상황.
      await Promise.all([
        useBossProfitStore.getState().goToPreviousPeriod(),
        useBossProfitStore.getState().goToPreviousPeriod(),
        useBossProfitStore.getState().goToPreviousPeriod(),
      ])

      expect(useBossProfitStore.getState().periodKey).toBe(
        getAdjacentPeriodKey('weekly', 시작, 'prev'),
      )
    })

    // 다음 쪽은 매번 `periodKey` 로 새로 판정한다(`isLatestPeriod`). 그래서 연타해도 현재
    // 기간에서 멈춘다. 회귀 가드다. 그쪽도 저장된 플래그로 바꾸면 같은 버그가 난다.
    it('goToNextPeriod: 연타해도 현재 기간을 안 넘는다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      await useBossProfitStore.getState().goToPreviousPeriod()
      const 현재 = getCurrentBossProfitPeriod('weekly', new Date()).periodKey

      await Promise.all([
        useBossProfitStore.getState().goToNextPeriod(),
        useBossProfitStore.getState().goToNextPeriod(),
        useBossProfitStore.getState().goToNextPeriod(),
      ])

      expect(useBossProfitStore.getState().periodKey).toBe(현재)
    })

    // 캐시 데이터 삭제 직후 재현. 진입하자마자 이전 기간을 누르면 refresh 가 아직
    // syncSchedules 에 매여 있어 창이 시작도 안 했다. 그때 `도는 중이면 기다린다` 만으로는
    // 안 기다리고 기록 0건을 그대로 실패로 그린다. 사용자 보고: 다시 시도하면 정상.
    it('goToPreviousPeriod: 관측이 없는 조회 가능 기간은 창을 채우고 기다린다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      syncWindowMock.mockClear()

      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(syncWindowMock).toHaveBeenCalledWith(['ocid-1'], expect.any(Date))
    })

    // 채우는 동안 스피너를 세운다. 빈 화면에 실패 문구가 아니라 불러오는 중 이 서야 한다.
    it('goToPreviousPeriod: 창을 채우는 동안 isPeriodLoading 이 참이다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])

      let release!: () => void
      syncWindowMock.mockReturnValue(new Promise<void>((resolve) => { release = resolve }))

      const moving = useBossProfitStore.getState().goToPreviousPeriod()

      await waitFor(() => {
        expect(useBossProfitStore.getState().isPeriodLoading).toBe(true)
      })

      release()
      await moving

      expect(useBossProfitStore.getState().isPeriodLoading).toBe(false)
    })

    // 창이 아직 그 기간을 못 받았고 기록도 없다. 재시도를 줄 수 있는 유일한 기간 상태다.
    it('goToPreviousPeriod: 관측도 기록도 없는 기간은 failed 다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])

      getBossProfitRecordsMock.mockResolvedValue([])

      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(useBossProfitStore.getState().periodState).toBe('failed')
    })

    // 이동의 기준이 **기록**으로 바뀌었다. 스케줄러 하한은 더 이상 게이트가 아니다 - 그 아래에는
    // 애초에 기록이 안 생기므로 `더 과거에 기록이 없다` 가 같은 자리를 막는다.
    it('goToPreviousPeriod: 더 과거에 기록이 없으면 한 칸도 안 간다(weekly)', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])

      findAdjacentMock.mockResolvedValue(null)
      getBossProfitRecordsMock.mockResolvedValue([])
      fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())
      const before = useBossProfitStore.getState().periodKey
      fetchSchedulerCharacterStateMock.mockClear()

      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(useBossProfitStore.getState().periodKey).toBe(before)
      expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
    })

    it('goToPreviousPeriod: 더 과거에 기록이 없으면 한 칸도 안 간다(monthly)', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      await useBossProfitStore.getState().setTab('monthly')

      findAdjacentMock.mockResolvedValue(null)
      const monthBefore = useBossProfitStore.getState().periodKey
      fetchSchedulerCharacterStateMock.mockClear()

      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(useBossProfitStore.getState().periodKey).toBe(monthBefore)
      expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
    })

    // **조회 가능한 구간 안이어도 기록이 없으면 안 간다**(사용자 선택). 찾는 것은 기록이지 0 이
    // 아니다. 대가로 조회해서 0건을 확인한 주를 화살표로는 못 본다.
    it('goToPreviousPeriod: 조회 가능한 구간 안이어도 기록이 없으면 안 간다', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00')) // 이번 주 2026-07-16, 롤링 하한 2026-07-09

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        // 2026-07-09 는 조회 가능한 구간 안이지만 어느 주에도 기록이 없다. 화살표 상태가 회차
        // 안에서 정해지므로 회차 **전에** 세운다.
        findAdjacentMock.mockResolvedValue(null)
        getBossProfitRecordsMock.mockResolvedValue([])
        await useBossProfitStore.getState().refresh(['ocid-1'])
        fetchSchedulerCharacterStateMock.mockClear()

        expect(useBossProfitStore.getState().canGoPreviousPeriod).toBe(false)
        await useBossProfitStore.getState().goToPreviousPeriod()

        expect(useBossProfitStore.getState().periodKey).toBe('2026-07-16')
        expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
      } finally {
        jest.useRealTimers()
      }
    })

    it('goToPreviousPeriod: 기록이 있는 가장 가까운 기간으로 **건너뛴다**. 사이의 빈 주를 안 밟는다', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00')) // 이번 주 periodKey: 2026-07-16, 롤링 하한: 2026-07-09

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        await useBossProfitStore.getState().refresh(['ocid-1'])

        // 2026-07-02는 롤링 윈도우 밖이지만, 윈도우 안이었을 때 저장해둔 기록이 남아 있다고 가정한다.
        const cachedRecord: BossProfitRecord = {
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          cycle: 'weekly',
          periodKey: '2026-07-02',
          partySize: 2,
          priceMeso: 8_080_000,
          payoutMeso: 4_040_000,
          recordedAt: '2026-07-08T00:00:00.000Z',
          world: null,
        }
        getBossProfitRecordsMock.mockImplementation(async (_ocids: string[], periodKeys: string[]) =>
          periodKeys.includes('2026-07-02') ? [cachedRecord] : [],
        )
        // 기록이 있는 가장 가까운 기간은 2026-07-02 다. 그 사이의 2026-07-09 에는 기록이 없다.
        findAdjacentMock.mockImplementation(
          async (_ocids: string[], _tab: string, key: string, direction: string) =>
            direction === 'prev' && key > '2026-07-02' ? '2026-07-02' : null,
        )
        fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())
        fetchSchedulerCharacterStateMock.mockClear()

        // 2026-07-16 → **2026-07-02**. 한 칸씩이면 2026-07-09 를 밟았을 자리다.
        await useBossProfitStore.getState().goToPreviousPeriod()

        expect(useBossProfitStore.getState().periodKey).toBe('2026-07-02')
        // 더 과거에는 기록이 없다.
        expect(useBossProfitStore.getState().canGoPreviousPeriod).toBe(false)
        expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
        const rows = useBossProfitStore.getState().rows
        expect(rows).toHaveLength(1)
        expect(rows[0].boss).toBe('자쿰')
        expect(rows[0].payoutMeso).toBe(4_040_000)
      } finally {
        jest.useRealTimers()
      }
    })

    it('goToPreviousPeriod: 더 과거에 기록이 있으면 canGoPreviousPeriod 가 true 다', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00'))

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        await useBossProfitStore.getState().refresh(['ocid-1'])

        // 조회 가능성이 아니라 **기록**이 판정한다.
        expect(useBossProfitStore.getState().canGoPreviousPeriod).toBe(true)
      } finally {
        jest.useRealTimers()
      }
    })

    it('setTab: 더 과거에 기록이 없으면 canGoPreviousPeriod 가 false 다(monthly)', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00'))

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        await useBossProfitStore.getState().refresh(['ocid-1'])
        findAdjacentMock.mockResolvedValue(null)
        await useBossProfitStore.getState().setTab('monthly')

        expect(useBossProfitStore.getState().periodKey).toBe('2026-07')
        expect(useBossProfitStore.getState().canGoPreviousPeriod).toBe(false)
      } finally {
        jest.useRealTimers()
      }
    })

    it('월간 탭 주차별 합계: 롤링 윈도우를 벗어났어도 이미 저장된 기록이 있으면 조회 불가가 아니라 확정 합계를 그대로 보여준다', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00'))

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        await useBossProfitStore.getState().refresh(['ocid-1'])
        await useBossProfitStore.getState().setTab('monthly')

        // 조회일 2026-07-08. 롤링 하한보다 이전이라 "지금"은 API로 다시 조회할 수
        // 없지만, 이 주가 아직 윈도우 안에 있었을 때 이미 저장해둔 기록이 있다고 가정한다.
        const pastWeekKey = '2026-07-02'
        const cachedRecord: BossProfitRecord = {
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          cycle: 'weekly',
          periodKey: pastWeekKey,
          partySize: 2,
          priceMeso: 8_080_000,
          payoutMeso: 4_040_000,
          recordedAt: '2026-07-08T00:00:00.000Z',
          world: null,
        }
        getBossProfitRecordsMock.mockResolvedValue([cachedRecord])

        await useBossProfitStore.getState().setTab('monthly')

        const subtotal = useBossProfitStore.getState().weeklySubtotals.find((s) => s.periodKey === pastWeekKey)
        expect(subtotal?.state).toBe('recorded')
        expect(subtotal?.totalMeso).toBe(4_040_000)
      } finally {
        jest.useRealTimers()
      }
    })

    // 월간 탭은 `주간 기록의 총합` 이다(사용자 지정). 월간 보스 수익이 어느 주차에도 안 들면
    // 카드 금액과 그 아래 줄들의 합이 안 맞는다.
    it('월간 탭 주차별 합계: 월간 보스 수익이 그 보스가 선 주차에 든다', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00'))

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        await useBossProfitStore.getState().refresh(['ocid-1'])

        // 날짜를 아는 월간 기록. 7/09 주(7/9~7/15)에 잡았다.
        getBossProfitRecordsMock.mockResolvedValue([
          {
            ocid: 'ocid-1',
            boss: '검은마법사',
            difficulty: '익스트림',
            cycle: 'monthly',
            periodKey: '2026-07',
            partySize: 1,
            priceMeso: 15_000_000_000,
            payoutMeso: 15_000_000_000,
            recordedAt: '2026-07-12T00:00:00.000Z',
            world: null,
            defeatedOn: '2026-07-12',
          } satisfies BossProfitRecord,
        ])

        await useBossProfitStore.getState().setTab('monthly')

        const subtotals = useBossProfitStore.getState().weeklySubtotals
        expect(subtotals.find((s) => s.periodKey === '2026-07-09')?.totalMeso).toBe(15_000_000_000)
        // 다른 주차는 그 금액을 안 센다. 한 달에 딱 한 주다.
        expect(subtotals.find((s) => s.periodKey === '2026-07-02')?.totalMeso).toBe(0)
      } finally {
        jest.useRealTimers()
      }
    })

    it('월간 탭 주차별 합계: 이번 달을 보는 동안 진행 중 주차는 기록이 아니라 라이브 스냅샷에서 합산한다(회귀 가드)', async () => {
      // 라이브 원천이 있을 때까지 기록으로 갈아타면, 자동 기록이 건너뛰어진 처치(기록 조회 실패
      // 동기화 실패 캐릭터)가 이번 주 합계에서 사라진다.
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00')) // 이번 주 2026-07-16, 이번 달 2026-07

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스 완료
        getBossProfitRecordsMock.mockResolvedValue([]) // 기록은 아직 없다
        await useBossProfitStore.getState().refresh(['ocid-1'])
        await useBossProfitStore.getState().setTab('monthly')

        const subtotal = useBossProfitStore
          .getState()
          .weeklySubtotals.find((s) => s.periodKey === '2026-07-16')
        expect(subtotal?.state).toBe('inProgress')
        expect(subtotal?.totalMeso).toBe(8_080_000) // 자쿰 카오스 정가 / 파티원 1
      } finally {
        jest.useRealTimers()
      }
    })

    it('월간 탭 주차별 합계: 달 경계를 걸친 진행 중 주차(7/30~8/5)는 그 달이 지난 달이 된 뒤에도 기록 합계가 반영된다', async () => {
      // 2026-08-02(KST): 이번 주는 2026-07-30(목) 시작이라 "7월 5주차"이면서 8/5까지 이어진다.
      // 달이 바뀌어 7월이 지난 달이 되면 liveRows(라이브 스냅샷)는 8월 화면의 것이라 이 주를
      // 담지 않는다. 그때 진행 중 주차 합계를 라이브에서만 읽으면 0메소로 굳는다.
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-08-02T12:00:00+09:00'))

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        await useBossProfitStore.getState().refresh(['ocid-1'])
        await useBossProfitStore.getState().setTab('monthly')
        expect(useBossProfitStore.getState().periodKey).toBe('2026-08')

        const inProgressRecord: BossProfitRecord = {
          ocid: 'ocid-1',
          boss: '스우',
          difficulty: '노멀',
          cycle: 'weekly',
          periodKey: '2026-07-30',
          partySize: 2,
          priceMeso: 4_000_000,
          payoutMeso: 2_000_000,
          recordedAt: '2026-08-01T00:00:00.000Z',
          world: null,
        }
        getBossProfitRecordsMock.mockResolvedValue([inProgressRecord])
        fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())

        await useBossProfitStore.getState().goToPreviousPeriod()
        expect(useBossProfitStore.getState().periodKey).toBe('2026-07')

        const subtotal = useBossProfitStore
          .getState()
          .weeklySubtotals.find((s) => s.periodKey === '2026-07-30')
        expect(subtotal?.state).toBe('inProgress')
        expect(subtotal?.totalMeso).toBe(2_000_000)
      } finally {
        jest.useRealTimers()
      }
    })

    it('refresh: 진행 중인 주를 품은 지난 달을 보고 있으면 그 기간을 유지한 채 동기화·자동 기록만 한다', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-08-02T12:00:00+09:00')) // 이번 주 2026-07-30, 이번 달 2026-08

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        await useBossProfitStore.getState().refresh(['ocid-1'])
        await useBossProfitStore.getState().setTab('monthly')
        fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())
        await useBossProfitStore.getState().goToPreviousPeriod()
        expect(useBossProfitStore.getState().periodKey).toBe('2026-07')

        // 7월 화면을 보는 동안 5주차(7/30~8/5)에 자쿰을 잡았다. 새 처치는 동기화가 알려주고
        // 자동 기록이 DB에 남기며, 화면은 그 기록을 읽어야 한다.
        getBossProfitRecordsMock.mockResolvedValue([
          {
            ocid: 'ocid-1',
            boss: '자쿰',
            difficulty: '카오스',
            cycle: 'weekly',
            periodKey: '2026-07-30',
            partySize: 1,
            priceMeso: 8_080_000,
            payoutMeso: 8_080_000,
            recordedAt: '2026-08-02T00:00:00.000Z',
            world: null,
          } satisfies BossProfitRecord,
        ])

        await useBossProfitStore.getState().refresh(['ocid-1'])

        // 보고 있던 기간이 현재 기간(2026-08)으로 튕겨 나가지 않는다.
        expect(useBossProfitStore.getState().periodKey).toBe('2026-07')
        expect(useBossProfitStore.getState().status).toBe('loaded')
        expect(syncSchedulesMock).toHaveBeenCalled() // 실시간 동기화는 그대로 돈다
        const subtotal = useBossProfitStore
          .getState()
          .weeklySubtotals.find((s) => s.periodKey === '2026-07-30')
        expect(subtotal?.state).toBe('inProgress')
        expect(subtotal?.totalMeso).toBe(8_080_000)
      } finally {
        jest.useRealTimers()
      }
    })

    it('refresh: 완전히 닫힌 과거 기간을 보고 있으면 종전대로 현재 기간으로 되돌린다(범위 밖)', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-07-22T12:00:00+09:00')) // 이번 주 2026-07-16

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        await useBossProfitStore.getState().refresh(['ocid-1'])
        const currentPeriodKey = useBossProfitStore.getState().periodKey
        await useBossProfitStore.getState().goToPreviousPeriod()
        expect(useBossProfitStore.getState().periodKey).not.toBe(currentPeriodKey)

        await useBossProfitStore.getState().refresh(['ocid-1'])

        expect(useBossProfitStore.getState().periodKey).toBe(currentPeriodKey)
      } finally {
        jest.useRealTimers()
      }
    })

    it('goToNextPeriod: 이미 최신 기간이면 periodKey가 바뀌지 않고 아무 것도 호출하지 않는다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const periodKeyBefore = useBossProfitStore.getState().periodKey

      await useBossProfitStore.getState().goToNextPeriod()

      expect(useBossProfitStore.getState().periodKey).toBe(periodKeyBefore)
      expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
    })

    it('setPartySize는 과거 기간의 row에도 정상 동작한다(읽기 전용 처리 없음)', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const currentPeriodKey = useBossProfitStore.getState().periodKey
      const previousPeriodKey = getAdjacentPeriodKey('weekly', currentPeriodKey, 'prev')

      getBossProfitRecordsMock.mockResolvedValue([
        {
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          cycle: 'weekly',
          periodKey: previousPeriodKey,
          partySize: 2,
          priceMeso: 8_080_000,
          payoutMeso: 4_040_000,
          recordedAt: '2026-06-01T00:00:00.000Z',
          world: null,
        } satisfies BossProfitRecord,
      ])
      getCachedCharacterBasicMock.mockResolvedValue({
        profile: { name: '낟낟', level: 200, imageUrl: 'x', accessFlag: true },
        cachedAt: '2026-06-01T00:00:00.000Z',
      })

      await useBossProfitStore.getState().goToPreviousPeriod()
      upsertBossProfitRecordMock.mockClear()
      const pastRow = useBossProfitStore.getState().rows[0]

      await useBossProfitStore.getState().setPartySize(pastRow, 3)

      expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          periodKey: previousPeriodKey,
          partySize: 3,
        }),
      )
      expect(useBossProfitStore.getState().rows[0].partySize).toBe(3)
    })
  })

  describe('수동 트래킹 모드 (#33)', () => {
    it('수동으로만 추가한(인게임 미등록·미처치) 보스도 미완료 placeholder row로 표시된다 (라이브 브랜치)', async () => {
      getTrackingModeMock.mockResolvedValue('manual')
      getManualTrackedContentMock.mockResolvedValue([{ contentName: '스우', difficulty: '노멀', kind: 'boss' }])
      // 동기화 결과에는 이 보스가 전혀 없다(등록도 처치도 안 함).
      syncSchedulesMock.mockResolvedValue([
        syncResult({ state: { ...syncResult().state!, bossContents: [] } }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      const rows = useBossProfitStore.getState().rows
      expect(rows).toHaveLength(1)
      expect(rows[0].boss).toBe('스우')
      expect(rows[0].isComplete).toBe(false)
      expect(rows[0].payoutMeso).toBe(0)
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('수동으로만 추가한 보스도 캐시 우선 표시 단계(라이브 동기화 실패 시)에서 유지된다 (캐시 브랜치)', async () => {
      getTrackingModeMock.mockResolvedValue('manual')
      getManualTrackedContentMock.mockResolvedValue([{ contentName: '스우', difficulty: '노멀', kind: 'boss' }])
      getCachedSchedulerStateMock.mockResolvedValue({
        state: { ...syncResult().state!, bossContents: [] },
        cachedAt: '2026-07-10T00:00:00.000Z',
      })
      // 라이브 동기화가 실패해도 캐시 브랜치가 세팅한 수동 보스 row가 남아 있어야 한다.
      syncSchedulesMock.mockRejectedValue(new Error('network'))

      await useBossProfitStore.getState().refresh(['ocid-1'])

      const state = useBossProfitStore.getState()
      expect(state.status).toBe('error')
      expect(state.rows).toHaveLength(1)
      expect(state.rows[0].boss).toBe('스우')
      expect(state.rows[0].payoutMeso).toBe(0)
    })

    it('수동 추적 보스가 실제로 처치되면 완료 row로 잡히고 정상 수익이 자동 기록된다', async () => {
      getTrackingModeMock.mockResolvedValue('manual')
      getManualTrackedContentMock.mockResolvedValue([{ contentName: '자쿰', difficulty: '카오스', kind: 'boss' }])
      // 동기화 결과에 같은 (보스명, 난이도)가 완료 상태로 존재한다.
      syncSchedulesMock.mockResolvedValue([
        syncResult({
          state: {
            ...syncResult().state!,
            bossContents: [bossContent({ name: '자쿰', difficulty: '카오스', isRegistered: true, isComplete: true })],
          },
        }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      const rows = useBossProfitStore.getState().rows
      expect(rows).toHaveLength(1)
      expect(rows[0].boss).toBe('자쿰')
      expect(rows[0].isComplete).toBe(true)
      expect(rows[0].partySize).toBe(1)
      expect(rows[0].payoutMeso).toBe(8080000)
    })

    it('수동 추적한 난이도와 다른 난이도로 처치하면, 실제 처치한 난이도로 표시된다', async () => {
      getTrackingModeMock.mockResolvedValue('manual')
      // 자쿰을 "하드"로 추적했지만 실제로는 "카오스"를 처치했다.
      getManualTrackedContentMock.mockResolvedValue([{ contentName: '자쿰', difficulty: '하드', kind: 'boss' }])
      syncSchedulesMock.mockResolvedValue([
        syncResult({
          state: {
            ...syncResult().state!,
            bossContents: [
              bossContent({ name: '자쿰', difficulty: '카오스', isRegistered: false, isComplete: true, ownComplete: true }),
            ],
          },
        }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      const rows = useBossProfitStore.getState().rows
      expect(rows).toHaveLength(1)
      expect(rows[0].boss).toBe('자쿰')
      expect(rows[0].difficulty).toBe('카오스')
      expect(rows[0].isComplete).toBe(true)
      expect(rows[0].payoutMeso).toBe(8080000)
    })

    it('추적하지 않은 보스라도 처치했으면 표시되고, 추적 중 미처치 보스는 placeholder로 함께 나온다', async () => {
      getTrackingModeMock.mockResolvedValue('manual')
      // 스우는 추적 중(미처치), 자쿰은 추적하지 않았지만 처치함.
      getManualTrackedContentMock.mockResolvedValue([{ contentName: '스우', difficulty: '노멀', kind: 'boss' }])
      syncSchedulesMock.mockResolvedValue([
        syncResult({
          state: {
            ...syncResult().state!,
            bossContents: [
              bossContent({ name: '자쿰', difficulty: '카오스', isRegistered: false, isComplete: true, ownComplete: true }),
            ],
          },
        }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      const rows = useBossProfitStore.getState().rows
      const byBoss = Object.fromEntries(rows.map((row) => [row.boss, row]))
      expect(rows).toHaveLength(2)
      // 추적하지 않았지만 처치한 자쿰. 완료·정산 표시
      expect(byBoss['자쿰'].isComplete).toBe(true)
      expect(byBoss['자쿰'].payoutMeso).toBe(8080000)
      // 추적 중이지만 미처치인 스우. placeholder
      expect(byBoss['스우'].isComplete).toBe(false)
      expect(byBoss['스우'].payoutMeso).toBe(0)
    })

    it('자동 모드에서는 manualTrackedContent를 읽지 않는다 (수동 추적 보스가 목록에 새지 않음)', async () => {
      // 기본값(auto). 수동 목록이 저장돼 있어도 자동 모드에서는 무시돼야 한다.
      getManualTrackedContentMock.mockResolvedValue([{ contentName: '스우', difficulty: '노멀', kind: 'boss' }])
      syncSchedulesMock.mockResolvedValue([
        syncResult({ state: { ...syncResult().state!, bossContents: [] } }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(useBossProfitStore.getState().rows).toEqual([])
      expect(getManualTrackedContentMock).not.toHaveBeenCalled()
    })
  })

  // 화면에 들어왔다는 사실만으로는 조회하지 않는다. 게이트는 자동 진입 경로에만 걸리고,
  // 판정 근거는 캐시 우선 표시 단계가 이미 읽은 syncedAt 이다.
  describe('화면 진입 재조회 게이트', () => {
    function minutesAgo(minutes: number): string {
      return new Date(Date.now() - minutes * 60 * 1000).toISOString()
    }

    function cachedEntry(syncedAt: string): CachedSchedulerEntry {
      return {
        state: {
          asOf: '2026-07-09T00:00+09:00',
          characterName: '캐시캐릭터',
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
      getCachedSchedulerStateMock.mockResolvedValue(cachedEntry(minutesAgo(5)))

      await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      const state = useBossProfitStore.getState()
      expect(state.status).toBe('loaded')
      expect(state.error).toBeNull()
      // 화면에 흔적을 남기지 않는다. 행은 캐시 우선 표시가 그대로 그린다.
      expect(state.rows).toHaveLength(1)
      expect(state.rows[0].boss).toBe('자쿰')
      expect(state.rows[0].characterName).toBe('캐시캐릭터')
    })

    // 이 화면의 lastSyncedAt 은 스토어 메모리에만 있어 건너뛴 진입에서는 null 로 남는다.
    // 그러면 신선한 데이터를 보여주면서 "동기화 기록 없음"이라고 말하게 된다. 지금 시각으로 채우는
    // 것도 답이 아니다(하지 않은 동기화를 했다고 말하는 것이다).
    it('건너뛴 진입의 lastSyncedAt 은 가장 오래된 캐시 syncedAt 이다(지금 시각이 아니다)', async () => {
      const oldest = minutesAgo(8)
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockImplementation(async (ocid: string) =>
        cachedEntry(ocid === 'ocid-1' ? minutesAgo(5) : oldest),
      )

      await useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'], { auto: true })

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(useBossProfitStore.getState().lastSyncedAt).toBe(oldest)
    })

    // (폐기): 건너뛴 진입은 이 캐시 단계가 곧 최종 화면이라, 여기서
    // 기록하지 않으면 수익이 계산되지 않은 채로 뜬다.
    // 건너뛰는 것은 **네트워크 재조회**뿐이고, 안전 가드는 캐시의 나이가 아니라 **기간 동일성**이다.
    describe('건너뛴 진입의 자동 기록', () => {
      it('기록이 없는 완료 행을 upsert 하고 그 금액이 화면 rows 에 함께 반영된다', async () => {
        markSyncAttemptedThisRun()
        getCachedSchedulerStateMock.mockResolvedValue(cachedEntry(minutesAgo(5)))

        await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

        // 기본 파티원 수는 boss_party_settings 조회값(없으면 1). 캐시가 아니라 그 자리에서 읽는다.
        expect(getBossPartySizeMock).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스')
        expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
          expect.objectContaining({
            ocid: 'ocid-1',
            boss: '자쿰',
            difficulty: '카오스',
            cycle: 'weekly',
            partySize: 1,
            priceMeso: 8080000,
            payoutMeso: 8080000,
          }),
        )
        // 기록만 남기고 화면에 안 흘리면 총 수익이 0으로 그려졌다가 점프한다. 둘 다 본다.
        const state = useBossProfitStore.getState()
        expect(state.status).toBe('loaded')
        expect(state.rows).toHaveLength(1)
        expect(state.rows[0].partySize).toBe(1)
        expect(state.rows[0].payoutMeso).toBe(8080000)
      })

      // 네트워크 정책은 하나도 바뀌지 않는다.
      it('자동 기록을 해도 syncSchedules 호출 수는 0 그대로다', async () => {
        markSyncAttemptedThisRun()
        getCachedSchedulerStateMock.mockResolvedValue(cachedEntry(minutesAgo(5)))

        await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

        expect(upsertBossProfitRecordMock).toHaveBeenCalled()
        expect(syncSchedulesMock).not.toHaveBeenCalled()
      })

      // 기록을 set 뒤로 미루면 총 수익이 0으로 그려졌다가 점프하고, loading 을 경유해 두 번
      // set 하면 로딩이 한 프레임 번쩍인다. 그래서 set 은 계속 1회다.
      it('건너뛴 진입의 set 은 여전히 1회이고 그 시점에 이미 금액이 채워져 있다', async () => {
        markSyncAttemptedThisRun()
        getCachedSchedulerStateMock.mockResolvedValue(cachedEntry(minutesAgo(5)))

        const payoutsPerCommit: (number | null)[] = []
        const unsubscribe = useBossProfitStore.subscribe((state) => {
          payoutsPerCommit.push(state.rows[0]?.payoutMeso ?? null)
        })
        try {
          await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })
        } finally {
          unsubscribe()
        }

        expect(payoutsPerCommit).toEqual([8080000])
      })

      // TTL(10분) 안이면서 리셋 경계를 넘는 조합은 리셋 직후 10분 창에서만 성립한다.
      // 리셋 시각은 손으로 추측하지 않고 getMostRecentWeeklyResetKst 로 실제 값을 구한다.
      it('캐시가 주간 리셋 경계를 넘었으면 TTL 안이어도 기록하지 않는다', async () => {
        jest.useFakeTimers({ doNotFake: NOT_FAKED })
        try {
          const reset = getMostRecentWeeklyResetKst(new Date('2026-08-07T12:00:00+09:00'))
          jest.setSystemTime(new Date(reset.getTime() + 5 * 60 * 1000)) // 리셋 5분 뒤

          markSyncAttemptedThisRun()
          // 리셋 2분 전 캐시. 나이는 7분(TTL 안)인데 기간 키가 지난 주다.
          getCachedSchedulerStateMock.mockResolvedValue(
            cachedEntry(new Date(reset.getTime() - 2 * 60 * 1000).toISOString()),
          )

          await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

          expect(syncSchedulesMock).not.toHaveBeenCalled()
          expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
          expect(getBossPartySizeMock).not.toHaveBeenCalled()
          // 표시는 그대로다. 미룬 것은 기록이고 다음 실제 동기화가 맡는다.
          expect(useBossProfitStore.getState().rows[0].payoutMeso).toBeNull()
        } finally {
          jest.useRealTimers()
        }
      })

      // 판정은 row.cycle 로 갈린다. 주간 리셋(목요일 00:00)과 월간 리셋(1일 00:00)은
      // 시점이 달라, 한쪽으로 뭉뚱그리면 반대쪽이 조용히 틀린다.
      it('월 경계를 넘은 캐시에서 월간 행만 빠지고 주간 행은 그대로 기록된다', async () => {
        jest.useFakeTimers({ doNotFake: NOT_FAKED })
        try {
          // 2026-08-01 00:05 KST. 월은 갈렸지만(7월→8월) 주간 리셋은 그대로다.
          jest.setSystemTime(new Date('2026-08-01T00:05:00+09:00'))

          markSyncAttemptedThisRun()
          const entry = cachedEntry(new Date('2026-07-31T23:58:00+09:00').toISOString())
          getCachedSchedulerStateMock.mockResolvedValue({
            ...entry,
            state: {
              ...entry.state,
              bossContents: [
                bossContent(),
                bossContent({ name: '검은마법사', difficulty: '하드', cycle: 'monthly' }),
              ],
            },
          })

          await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

          expect(syncSchedulesMock).not.toHaveBeenCalled()
          const recordedBosses = upsertBossProfitRecordMock.mock.calls.map((call) => call[0].boss)
          expect(recordedBosses).toEqual(['자쿰'])
        } finally {
          jest.useRealTimers()
        }
      })

      // 조회 실패를 기록 없음 으로 읽으면 사용자가 저장한 파티원 수가 1 로 덮인다. 캐시
      // 단계의 폴백이 [] 가 아니라 null 인 것이 이 가드의 선행 조건이다.
      it('캐시 단계의 기록 조회가 실패하면 기록하지 않는다', async () => {
        markSyncAttemptedThisRun()
        getCachedSchedulerStateMock.mockResolvedValue(cachedEntry(minutesAgo(5)))
        getBossProfitRecordsMock.mockRejectedValue(new Error('SQLite 커넥션 오류'))

        await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

        expect(syncSchedulesMock).not.toHaveBeenCalled()
        expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
        expect(getBossPartySizeMock).not.toHaveBeenCalled()
      })

      // 드롭 이관은 자동 기록과 같은 순회에 있으므로 함께 딸려온다.
      it('완료 행의 드롭 이관도 함께 일어난다', async () => {
        const periodKey = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
        markSyncAttemptedThisRun()
        const entry = cachedEntry(minutesAgo(5))
        getCachedSchedulerStateMock.mockResolvedValue({
          ...entry,
          state: { ...entry.state, bossContents: [bossContent({ name: '스우', difficulty: '하드' })] },
        })
        getBossDropRecordsMock.mockResolvedValue([
          {
            ocid: 'ocid-1',
            boss: '스우',
            difficulty: '익스트림', // 옛 난이도 키. 확정 난이도(하드)로 옮겨져야 한다
            periodKey,
            dropIndex: 0,
            category: 'equipment',
            itemName: '루즈 컨트롤 머신 마크',
            slot: '얼굴장식',
            boxOrigin: null,
            ringLevel: null,
            quantity: 1,
          },
        ])

        await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

        expect(syncSchedulesMock).not.toHaveBeenCalled()
        expect(replaceBossDropRecordsMock).toHaveBeenCalledWith(
          'ocid-1',
          '스우',
          '하드',
          periodKey,
          [expect.objectContaining({ itemName: '루즈 컨트롤 머신 마크' })],
          expect.any(String),
        )
        expect(replaceBossDropRecordsMock).toHaveBeenCalledWith(
          'ocid-1',
          '스우',
          '익스트림',
          periodKey,
          [],
          expect.any(String),
        )
      })

      // 건너뛰지 않는 진입의 캐시는 낡았을 수 있고 곧 실제 동기화가 온다. 방어가 서 있어야
      // 할 곳은 정확히 거기다. 동기화를 실패시켜 두면 기록이 남았을 때 그것을 만든 것이
      // 캐시 단계임이 확정된다.
      it('건너뛰지 않는 진입의 캐시 단계는 여전히 기록하지 않는다', async () => {
        getCachedSchedulerStateMock.mockResolvedValue(cachedEntry(minutesAgo(5)))
        syncSchedulesMock.mockRejectedValue(new Error('network'))

        await useBossProfitStore.getState().refresh(['ocid-1'])

        expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
        expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
        expect(getBossPartySizeMock).not.toHaveBeenCalled()
      })
    })

    it('앱 재시작 직후(실행 플래그 없음)에는 TTL 안이어도 조회한다', async () => {
      getCachedSchedulerStateMock.mockResolvedValue(cachedEntry(minutesAgo(5)))
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
    })

    it('추적 캐릭터 중 캐시가 없는 캐릭터가 있으면 TTL 안이어도 조회한다', async () => {
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockImplementation(async (ocid: string) =>
        ocid === 'ocid-1' ? cachedEntry(minutesAgo(5)) : null,
      )
      syncSchedulesMock.mockResolvedValue([
        syncResult({ ocid: 'ocid-1' }),
        syncResult({ ocid: 'ocid-2' }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'], { auto: true })

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
    })

    it('가장 오래된 캐시가 TTL 밖이면 조회한다', async () => {
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockImplementation(async (ocid: string) =>
        cachedEntry(ocid === 'ocid-1' ? minutesAgo(5) : minutesAgo(11)),
      )
      syncSchedulesMock.mockResolvedValue([
        syncResult({ ocid: 'ocid-1' }),
        syncResult({ ocid: 'ocid-2' }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'], { auto: true })

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
    })

    // 강제가 기본값이다. 옵션을 넘기지 않는 헤더 버튼·당겨서 새로고침·재시도는 항상 조회한다.
    it('옵션 없는 refresh(명시적 재조회)는 TTL 안이어도 항상 조회한다', async () => {
      markSyncAttemptedThisRun()
      getCachedSchedulerStateMock.mockResolvedValue(cachedEntry(minutesAgo(5)))
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
    })

    // 제자리 새로고침(진행 중인 주를 품은 지난 달)에서도 게이트는 같다. 화면 반영을
    // loadPeriod에 넘기는 규약만 그대로 지킨다.
    it('제자리 새로고침 화면에서 건너뛰면 보던 기간을 유지한 채 loadPeriod로 정착한다', async () => {
      jest.useFakeTimers({ doNotFake: NOT_FAKED })
      jest.setSystemTime(new Date('2026-08-02T12:00:00+09:00')) // 이번 주 2026-07-30, 이번 달 2026-08

      try {
        const syncedAt = minutesAgo(5)
        getCachedSchedulerStateMock.mockResolvedValue(cachedEntry(syncedAt))
        syncSchedulesMock.mockResolvedValue([syncResult()])
        fetchSchedulerCharacterStateMock.mockResolvedValue(null)

        await useBossProfitStore.getState().refresh(['ocid-1'])
        await useBossProfitStore.getState().setTab('monthly')
        await useBossProfitStore.getState().goToPreviousPeriod()
        expect(useBossProfitStore.getState().periodKey).toBe('2026-07')

        syncSchedulesMock.mockClear()
        markSyncAttemptedThisRun()

        await useBossProfitStore.getState().refresh(['ocid-1'], { auto: true })

        expect(syncSchedulesMock).not.toHaveBeenCalled()
        const state = useBossProfitStore.getState()
        expect(state.periodKey).toBe('2026-07') // 보던 기간이 튕겨 나가지 않는다
        expect(state.status).toBe('loaded') // status는 loadPeriod가 확정한다
        expect(state.lastSyncedAt).toBe(syncedAt)
      } finally {
        jest.useRealTimers()
      }
    })

    it('자동 진입 경로인 loadTrackedOcids는 게이트에 걸린다', async () => {
      markSyncAttemptedThisRun()
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      getCachedSchedulerStateMock.mockResolvedValue(cachedEntry(minutesAgo(5)))

      await useBossProfitStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(useBossProfitStore.getState().status).toBe('loaded')
    })
  })

  // 후단: syncSchedules 가 도는 회차에 character/basic 도 함께 받아
  // 캐시를 갱신한다(편승 갱신). 이 화면만 프로필을 동기화 **이전에** 읽으므로, 완료 분기에서 다시
  // 읽지 않으면 새 레벨·이미지가 그 회차에 반영되지 않고 다음 진입으로 밀린다.
  describe('동기화 완료 후 프로필 재조회', () => {
    // 편승 갱신이 캐시를 새로 쓴 시점을 syncSchedules 호출로 모사한다. 그 전에 읽으면 옛 값,
    // 그 뒤에 읽으면 새 값이다.
    function basicCacheFlippedBySync(
      profileFor: (ocid: string, piggybacked: boolean) => { name: string; level: number; imageUrl: string },
      results: CharacterScheduleSync[],
    ): void {
      let piggybacked = false
      getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
        profile: { ...profileFor(ocid, piggybacked), accessFlag: true },
        cachedAt: '2026-07-01T00:00:00.000Z',
      }))
      syncSchedulesMock.mockImplementation(async () => {
        piggybacked = true
        return results
      })
    }

    it('동기화 뒤 갱신된 이미지가 그 회차 rows 에 반영된다', async () => {
      basicCacheFlippedBySync(
        (ocid, piggybacked) => ({
          name: `캐릭터-${ocid}`,
          level: 200,
          imageUrl: piggybacked ? '갱신됨.png' : '옛날.png',
        }),
        [syncResult()],
      )

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(useBossProfitStore.getState().rows[0].imageUrl).toBe('갱신됨.png')
    })

    it('레벨이 바뀌어 순서가 뒤집히면 최종 rows 는 새 레벨 기준으로 정렬된다', async () => {
      basicCacheFlippedBySync(
        // 동기화 전엔 ocid-1(280) > ocid-2(250), 동기화 후엔 ocid-2 가 290 으로 올라 뒤집힌다.
        (ocid, piggybacked) => ({
          name: `캐릭터-${ocid}`,
          level: ocid === 'ocid-1' ? 280 : piggybacked ? 290 : 250,
          imageUrl: 'x',
        }),
        [
          syncResult({ ocid: 'ocid-1' }),
          syncResult({ ocid: 'ocid-2', characterName: '캐릭터-ocid-2' }),
        ],
      )

      await useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'])

      expect(useBossProfitStore.getState().rows.map((row) => row.ocid)).toEqual(['ocid-2', 'ocid-1'])
    })

    // 재조회는 character-basic-cache 를 읽는 로컬 조회다. 네트워크가 0회여야 한다.
    it('재조회 때문에 네트워크 호출이 늘지 않는다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
      expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
    })
  })
})

// 설 자리도 처치 기록도 없는 드롭은 지운다. 안 지우면 보스 수익에서는
// 사라지고(그룹 합계가 행으로만 훑는다) 드롭 히스토리·today 위젯에는 영원히 남는다.
describe('잡지 않은 보스의 드롭 정리', () => {
  const WEEKLY = weeklyBossesData.weekly as { boss: string; difficulties: string[] }[]
  const WEEK_KEY = getCurrentBossProfitPeriod('weekly', new Date()).periodKey

  /** 끝에서부터 한도만큼 실제로 처치한 보스. 자쿰(목록 맨 앞)과 겹치지 않는다. */
  function clearedContents(count: number): BossContent[] {
    return WEEKLY.slice(-count).map((entry) =>
      bossContent({
        name: entry.boss,
        difficulty: entry.difficulties[0] as BossContent['difficulty'],
        isRegistered: true,
        isComplete: true,
        ownComplete: true,
      }),
    )
  }

  function zakumDrop(): Record<string, unknown> {
    return {
      ocid: 'ocid-1',
      boss: '자쿰',
      difficulty: '카오스',
      periodKey: WEEK_KEY,
      dropIndex: 0,
      category: 'equipment',
      itemName: '칠흑의 보스 반지 상자',
      slot: null,
      boxOrigin: null,
      ringLevel: null,
      quantity: 1,
      recordedAt: '2026-08-27T00:00:00.000Z',
      priceState: null,
      priceMeso: null,
      priceShare: null,
    }
  }

  async function refreshWith(clearedCount: number): Promise<void> {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state,
          bossContents: [
            // 등록만 되고 미처치. 한도를 채웠으면 행이 서지 않는다.
            bossContent({ name: '자쿰', difficulty: '카오스', isComplete: false, ownComplete: false }),
            ...clearedContents(clearedCount),
          ],
        } as SchedulerCharacterState,
      }),
    ])
    getBossDropRecordsMock.mockResolvedValue([zakumDrop()])

    await useBossProfitStore.getState().refresh(['ocid-1'])
  }

  it('한도를 채우면 사라진 행의 드롭을 지운다', async () => {
    await refreshWith(12)

    await waitFor(() => {
      expect(replaceBossDropRecordsMock).toHaveBeenCalledWith(
        'ocid-1',
        '자쿰',
        '카오스',
        WEEK_KEY,
        [],
        expect.any(String),
      )
    })
  })

  it('지운 건수를 토스트로 알린다. 조용히 지우지 않는다', async () => {
    await refreshWith(12)

    await waitFor(() => {
      expect(mockShowInfo).toHaveBeenCalledWith(expect.stringContaining('1건'))
    })
  })

  // 회귀 가드. 한도 전이면 행이 서므로 드롭은 그대로 산다(scratchpad 흐름 배경 3).
  it('한 마리 모자라면 아무것도 지우지 않는다', async () => {
    await refreshWith(11)

    expect(replaceBossDropRecordsMock).not.toHaveBeenCalled()
    expect(mockShowInfo).not.toHaveBeenCalled()
  })

  // 셋째 경로. 주가 바뀌면 미처치는 확정이다. 과거 기간 행은 전부 기록에서 오므로
  // `기록에 없다`가 곧 `안 잡았다`다(안전 장치 ③ 이 가격 미확정 보스를 이미 빼 둔다).
  it('지난 기간에 남은 미처치 드롭도 그 기간을 열 때 정리한다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()])
    await useBossProfitStore.getState().refresh(['ocid-1'])
    const previousPeriodKey = getAdjacentPeriodKey('weekly', useBossProfitStore.getState().periodKey, 'prev')
    replaceBossDropRecordsMock.mockClear()
    mockShowInfo.mockClear()

    // 그 주에 `스우`는 잡았고(기록 있음. 안전 장치 ②의 근거) `자쿰`은 안 잡았다.
    getBossProfitRecordsMock.mockResolvedValue([
      {
        ocid: 'ocid-1',
        boss: '스우',
        difficulty: '하드',
        cycle: 'weekly',
        periodKey: previousPeriodKey,
        partySize: 1,
        priceMeso: 1000,
        payoutMeso: 1000,
        recordedAt: '2026-08-20T00:00:00.000Z',
        world: null,
      },
    ])
    getBossDropRecordsMock.mockResolvedValue([{ ...zakumDrop(), periodKey: previousPeriodKey }])

    await useBossProfitStore.getState().goToPreviousPeriod()

    expect(replaceBossDropRecordsMock).toHaveBeenCalledWith(
      'ocid-1',
      '자쿰',
      '카오스',
      previousPeriodKey,
      [],
      expect.any(String),
    )
  })

  // 안전 장치 ②. 백필된 적 없는 주는 기록이 통째로 비어 `행 없음`이 아무것도 뜻하지 않는다.
  it('기록이 하나도 없는 과거 주는 손대지 않는다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()])
    await useBossProfitStore.getState().refresh(['ocid-1'])
    const previousPeriodKey = getAdjacentPeriodKey('weekly', useBossProfitStore.getState().periodKey, 'prev')
    replaceBossDropRecordsMock.mockClear()

    getBossProfitRecordsMock.mockResolvedValue([])
    getBossDropRecordsMock.mockResolvedValue([{ ...zakumDrop(), periodKey: previousPeriodKey }])

    await useBossProfitStore.getState().goToPreviousPeriod()

    expect(replaceBossDropRecordsMock).not.toHaveBeenCalled()
  })
})


// 추적 목록에서 뺀 캐릭터의 기록은 원래부터 안 지워졌다. 조회 범위가 추적 목록이라 화면에서만
// 사라졌다. 동기화 대상과 표시 대상을 가른다.
describe('추적에서 빠진 캐릭터의 기록', () => {
  function 해제기록(periodKey: string, boss = '자쿰'): BossProfitRecord {
    return {
      ocid: 'ocid-해제',
      boss,
      difficulty: '카오스',
      cycle: 'weekly',
      periodKey,
      partySize: 1,
      priceMeso: 8_080_000,
      payoutMeso: 8_080_000,
      recordedAt: '2026-06-01T00:00:00.000Z',
      world: null,
    }
  }

  it('과거 기간에서 행이 선다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()])
    await useBossProfitStore.getState().refresh(['ocid-1'])
    const previousPeriodKey = getAdjacentPeriodKey(
      'weekly',
      useBossProfitStore.getState().periodKey,
      'prev',
    )

    getRecordedCharacterOcidsMock.mockResolvedValue(['ocid-1', 'ocid-해제'])
    getBossProfitRecordsMock.mockResolvedValue([해제기록(previousPeriodKey)])

    getBossProfitRecordsMock.mockClear()
    await useBossProfitStore.getState().goToPreviousPeriod()

    // 조회 범위 자체가 넓어져야 한다. 이 배열이 추적 목록이면 그 캐릭터의 기록은 애초에 안 온다.
    //
    // 기간 키는 안 묶는다. 주간 기간을 열면 **그 주가 속한 달**도 함께 읽는다(월간 보스가 그
    // 목록 맨 위에 서고 그 기록의 키는 달이다).
    expect(getBossProfitRecordsMock).toHaveBeenCalledWith(
      ['ocid-1', 'ocid-해제'],
      expect.arrayContaining([previousPeriodKey]),
    )
    const rows = useBossProfitStore.getState().rows
    expect(rows.map((row) => row.ocid)).toEqual(['ocid-해제'])
    expect(rows[0].characterName).toBe('캐릭터-ocid-해제')
  })

  // 이번 주 중간에 해제해도 그 주의 앞부분 수익이 사라지면 안 된다.
  it('현재 기간에서도 행이 선다', async () => {
    const currentPeriodKey = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
    syncSchedulesMock.mockResolvedValue([syncResult()])
    getRecordedCharacterOcidsMock.mockResolvedValue(['ocid-1', 'ocid-해제'])
    getBossProfitRecordsMock.mockResolvedValue([해제기록(currentPeriodKey)])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    // 동기화에는 추적 목록만 간다. 넓어지는 것은 기록 조회 쪽이다.
    expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1'], undefined)
    expect(getBossProfitRecordsMock.mock.calls.every((call) => call[0].includes('ocid-해제'))).toBe(true)
    expect(useBossProfitStore.getState().rows.map((row) => row.ocid)).toContain('ocid-해제')
  })

  // 동기화를 안 하는 캐릭터라 `등록은 됐는데 아직 안 잡았다`를 말할 근거가 없다. 기록에서
  // 되살아나는 행만 선다.
  it('미완료 자리는 안 세운다. 기록이 있는 것만 선다', async () => {
    const currentPeriodKey = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
    syncSchedulesMock.mockResolvedValue([syncResult()])
    getRecordedCharacterOcidsMock.mockResolvedValue(['ocid-1', 'ocid-해제'])
    getBossProfitRecordsMock.mockResolvedValue([해제기록(currentPeriodKey)])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const 해제행 = useBossProfitStore.getState().rows.filter((row) => row.ocid === 'ocid-해제')
    expect(해제행).toHaveLength(1)
    expect(해제행[0].isComplete).toBe(true)
  })

  // 고아 드롭 정리의 안전 장치 하나가 `믿을 수 있는 캐릭터`(동기화가 성공한 캐릭터)다. 해제한
  // 캐릭터는 영원히 그것이 못 되므로 넣는 순간 술어가 그들의 드롭을 고아로 읽는다.
  it('고아 드롭 정리에는 동기화 대상만 넘긴다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()])
    await useBossProfitStore.getState().refresh(['ocid-1'])
    const previousPeriodKey = getAdjacentPeriodKey(
      'weekly',
      useBossProfitStore.getState().periodKey,
      'prev',
    )

    getRecordedCharacterOcidsMock.mockResolvedValue(['ocid-1', 'ocid-해제'])
    // 자쿰에는 수익 기록이 있고 스우에는 드롭만 있다. 그 기간에 행이 하나라도 있으므로 안전
    // 장치 둘을 통과하고, `믿을 수 있는 캐릭터` 하나만 이 드롭을 살린다.
    getBossProfitRecordsMock.mockResolvedValue([해제기록(previousPeriodKey)])
    getBossDropRecordsMock.mockResolvedValue([
      {
        ocid: 'ocid-해제',
        boss: '스우',
        difficulty: '하드',
        periodKey: previousPeriodKey,
        dropIndex: 0,
        category: 'equipment',
        itemName: '루즈 컨트롤 머신 마크',
        slot: '얼굴장식',
        boxOrigin: null,
        ringLevel: null,
        quantity: 1,
        recordedAt: '2026-06-01T00:00:00.000Z',
        priceState: null,
        priceMeso: null,
        priceShare: null,
      },
    ])
    replaceBossDropRecordsMock.mockClear()

    await useBossProfitStore.getState().goToPreviousPeriod()

    expect(replaceBossDropRecordsMock).not.toHaveBeenCalled()
  })
})

// 목요일 새벽에는 지난주 목~화가 관측되고 수요일만 `OPENAPI00009` 다. 그러면 그 주가 화요일
// 스냅샷으로 굳는데, `periodState` 는 관측이 있으므로 `confirmedEmpty` 에서 끝나 그 사실이
// 묻힌다. 화면이 `기록이 없어도 요약을 그린다` 를 판단할 근거를 따로 든다(사용자 지정).
describe('periodPendingAggregation', () => {
  it('그 기간에 집계 전인 날이 있으면 참이다', async () => {
    jest.useFakeTimers({ doNotFake: NOT_FAKED })
    jest.setSystemTime(new Date('2026-07-23T02:00:00+09:00')) // 목요일 새벽, 지난 주 2026-07-16
    try {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      // 2026-07-22(수)가 오늘−1 이라 집계 전이다.
      windowFailuresMock.mockReturnValue([
        { ocid: 'ocid-1', dateKey: '2026-07-22', outcome: 'notCollected' },
      ])
      findAdjacentMock.mockResolvedValue('2026-07-16')

      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(useBossProfitStore.getState().periodKey).toBe('2026-07-16')
      expect(useBossProfitStore.getState().periodPendingAggregation).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  // 현재 기간은 실시간 동기화가 원천이라 집계를 기다리는 자리가 아니다.
  it('현재 기간에서는 거짓이다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()])
    await useBossProfitStore.getState().refresh(['ocid-1'])

    expect(useBossProfitStore.getState().periodPendingAggregation).toBe(false)
  })
})
