/**
 * `buildPeriodSnapshot` 이 한 기간의 화면 값을 만드는 규칙. 지금 기간은 스케줄 쿼리 캐시에서, 지난 기간은 기록에서 만든다.
 * 저장소는 전부 목이고 쿼리 캐시는 실물이다.
 */
jest.mock('../../../storage/boss-profit', () => ({
  getBossProfitRecords: jest.fn(),
  getRecordedCharacterOcids: jest.fn(),
  getWeeklyPeriodKeysWithRecords: jest.fn(),
  findAdjacentPeriodKeyWithRecords: jest.fn(),
  getMonthlyDefeatDates: jest.fn(),
  getManualBossProfitRecordKeys: jest.fn(),
  // 이 스위트는 안 부르지만 함께 들어오는 모듈이 가져온다.
  upsertBossProfitRecord: jest.fn(),
  fillMissingRecordWorlds: jest.fn(),
  markBossProfitRecordAuto: jest.fn(),
  subscribeBossProfitRecordsRevision: jest.fn(() => () => undefined),
  getBossProfitRecordsRevision: jest.fn(() => 0),
}))
jest.mock('../../../storage/boss-drops', () => ({
  NO_WORLD: { name: null, key: null },
  getBossDropRecords: jest.fn(),
  replaceBossDropRecords: jest.fn(),
  subscribeBossDropRecordsRevision: jest.fn(() => () => undefined),
  getBossDropRecordsRevision: jest.fn(() => 0),
}))
jest.mock('../../../storage/schedule-probe-ledger', () => ({
  getScheduleProbeLedger: jest.fn(),
  subscribeScheduleProbeLedgerRevision: jest.fn(() => () => undefined),
}))
jest.mock('../../../storage/tracking-mode', () => ({ getTrackingMode: jest.fn() }))
jest.mock('../../../storage/manual-tracked-content', () => ({ getManualTrackedContent: jest.fn() }))
jest.mock('../../character-profile/resolve', () => ({ resolveDisplayProfiles: jest.fn() }))
jest.mock('../../schedule-window/sync', () => ({ syncScheduleWindow: jest.fn() }))
jest.mock('../../schedule-window/window', () => ({ getLastWindowFailures: jest.fn(() => []) }))
jest.mock('../../server-sync/drop-price-sync', () => ({ reportDropPrice: jest.fn(), reportDropRemoved: jest.fn() }))

import { getAdjacentPeriodKey, getCurrentBossProfitPeriod } from '../../../lib/boss/boss-profit-period'
import type { BossDropRecord } from '../../../storage/boss-drops'
import type { BossProfitRecord } from '../../../storage/boss-profit'
import type { ScheduleProbeLedger } from '../../../storage/schedule-probe-ledger'
import type { CachedSchedulerEntry } from '../../../storage/scheduler-cache'
import type { BossContent, BossCycle, SchedulerCharacterState } from '../../../types'
import type { DisplayProfile } from '../../character-profile/resolve'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import type { ScheduleRoundResult } from '../../schedule-sync/schedule-query'
import type { StrandedCharacter } from '../../schedule-sync/stranded-characters'
import { periodStateKey } from '../../schedule-window/records'
import { buildPeriodSnapshot, periodNeedsWindowSync } from '../period-snapshot'

const {
  getBossProfitRecords: getBossProfitRecordsMock,
  getRecordedCharacterOcids: getRecordedCharacterOcidsMock,
  getWeeklyPeriodKeysWithRecords: getWeeklyPeriodKeysWithRecordsMock,
  findAdjacentPeriodKeyWithRecords: findAdjacentMock,
  getMonthlyDefeatDates: getMonthlyDefeatDatesMock,
  getManualBossProfitRecordKeys: getManualCompletedKeysMock,
} = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
const { getBossDropRecords: getBossDropRecordsMock, replaceBossDropRecords: replaceBossDropRecordsMock } = jest.requireMock(
  '../../../storage/boss-drops',
) as Record<string, jest.Mock>
const { getScheduleProbeLedger: getScheduleProbeLedgerMock } = jest.requireMock('../../../storage/schedule-probe-ledger') as Record<
  string,
  jest.Mock
>
const { getTrackingMode: getTrackingModeMock } = jest.requireMock('../../../storage/tracking-mode') as Record<string, jest.Mock>
const { getManualTrackedContent: getManualTrackedContentMock } = jest.requireMock('../../../storage/manual-tracked-content') as Record<
  string,
  jest.Mock
>
const { resolveDisplayProfiles: resolveDisplayProfilesMock } = jest.requireMock('../../character-profile/resolve') as Record<string, jest.Mock>
const { syncScheduleWindow: syncWindowMock } = jest.requireMock('../../schedule-window/sync') as Record<string, jest.Mock>
const { getLastWindowFailures: windowFailuresMock } = jest.requireMock('../../schedule-window/window') as Record<string, jest.Mock>

// Date 만 가짜다. 타이머까지 가짜면 SQLite 폴백의 실제 `setTimeout` 경주가 영영 안 끝난다.
const NOT_FAKED = [
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask',
  'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'hrtime',
] as never

/** 이 파일의 지금. 결정석 가격이 기간을 들어 실제 시계로 돌면 패치일이 지나는 순간 기대값이 틀린다. */
const PINNED_NOW = '2026-09-12T12:00:00+09:00'

function at(iso: string): void {
  jest.setSystemTime(new Date(iso))
}

function currentKey(tab: BossCycle): string {
  return getCurrentBossProfitPeriod(tab, new Date()).periodKey
}

/** 목이 돌려줄 캐릭터 프로필. 적지 않은 캐릭터는 기본 프로필이고 `null` 이면 모르는 캐릭터다. */
let profiles: Record<string, Partial<DisplayProfile> | null> = {}

function bossContent(overrides: Partial<BossContent> = {}): BossContent {
  const merged = {
    bossKey: 'zakum',
    apiName: '자쿰',
    difficulty: 'chaos' as const,
    cycle: 'weekly' as const,
    isRegistered: true,
    isComplete: true,
    ...overrides,
  }
  return { ...merged, ownComplete: overrides.ownComplete ?? merged.isComplete }
}

function schedulerState(overrides: Partial<SchedulerCharacterState> = {}): SchedulerCharacterState {
  return {
    asOf: '2026-09-11T00:00+09:00',
    characterName: '캐릭터',
    world: '베라',
    worldKey: 'bera',
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

function track(ocids: string[]): void {
  queryClient.setQueryData(queryKeys.trackedOcids(), ocids)
}

function schedule(ocid: string, bossContents: BossContent[], characterName = `캐릭터-${ocid}`): void {
  queryClient.setQueryData<CachedSchedulerEntry>(queryKeys.schedule(ocid), {
    state: schedulerState({ characterName, bossContents }),
    syncedAt: '2026-09-11T00:00:00.000Z',
  })
}

function round(ocids: string[], stranded: StrandedCharacter[] = []): void {
  queryClient.setQueryData<ScheduleRoundResult>(queryKeys.scheduleRound(), {
    fetchedAt: new Date().toISOString(),
    receivedAt: null,
    ocids,
    outcomes: {},
    stranded,
  })
}

function record(overrides: Partial<BossProfitRecord> & { periodKey: string }): BossProfitRecord {
  return {
    ocid: 'ocid-1',
    bossKey: 'zakum',
    boss: '자쿰',
    difficulty: 'chaos',
    cycle: 'weekly',
    partySize: 1,
    priceMeso: 8_080_000,
    payoutMeso: 8_080_000,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    recordedAt: '2026-09-11T00:00:00.000Z',
    world: null,
    worldKey: null,
    ...overrides,
  }
}

function dropRecord(overrides: Partial<BossDropRecord> & { periodKey: string }): BossDropRecord {
  return {
    dropRecordId: 'drop-1',
    ocid: 'ocid-1',
    bossKey: 'zakum',
    boss: '자쿰',
    difficulty: 'chaos',
    dropIndex: 0,
    category: 'equipment',
    itemKey: 'black_boss_ring_box',
    itemName: '칠흑의 보스 반지 상자',
    boxOriginKey: null,
    boxOrigin: null,
    ringLevel: null,
    quantity: 1,
    recordedAt: '2026-09-11T00:00:00.000Z',
    pricedAt: null,
    world: null,
    worldKey: null,
    priceState: null,
    priceMeso: null,
    priceSplitMode: null,
    pricePartySize: null,
    priceShare: null,
    priceMyShare: null,
    saleFeePercent: null,
    splitFeePercent: null,
    saleFeeAuto: false,
    splitFeeAuto: false,
    ...overrides,
  }
}

/** 기록 저장소가 조회 인자를 지키게 한다. 통째로 돌려주면 어느 기간을 읽었는지 안 보인다. */
function recordsAre(records: BossProfitRecord[]): void {
  getBossProfitRecordsMock.mockImplementation(async (ocids: string[], periodKeys: string[]) =>
    records.filter((entry) => ocids.includes(entry.ocid) && periodKeys.includes(entry.periodKey)),
  )
}

function dropsAre(drops: BossDropRecord[]): void {
  getBossDropRecordsMock.mockImplementation(async (ocids: string[], periodKeys: string[]) =>
    drops.filter((entry) => ocids.includes(entry.ocid) && periodKeys.includes(entry.periodKey)),
  )
}

/** 그 기간의 마지막 날을 관측한 원장. 창이 그 기간을 봤다는 뜻이다. */
function observedLedger(cycle: BossCycle, periodKey: string): ScheduleProbeLedger {
  const lastDay = cycle === 'weekly' ? getAdjacentPeriodKey('weekly', periodKey, 'next') : null
  const day = lastDay === null ? `${periodKey}-28` : shiftDay(lastDay, -1)
  return {
    unavailable: false,
    dates: { [day]: { kind: 'observed', hasCompletion: false, sections: { daily: true, weekly: true, weeklyBoss: true, monthlyBoss: true }, bosses: [] } },
  }
}

function shiftDay(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function build(tab: BossCycle, periodKey: string, ocids: string[] = ['ocid-1'], onWindowSyncStart?: () => void) {
  return buildPeriodSnapshot({ tab, periodKey, ocids, now: new Date(), onWindowSyncStart })
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: NOT_FAKED })
  at(PINNED_NOW)
  queryClient.clear()
  profiles = {}
  resolveDisplayProfilesMock.mockImplementation(async (ocids: readonly string[]) => {
    const map = new Map<string, DisplayProfile>()
    for (const ocid of new Set(ocids)) {
      const override = profiles[ocid]
      if (override === null) continue
      map.set(ocid, { name: `캐릭터-${ocid}`, imageUrl: 'x', world: null, worldKey: null, level: 200, ...override })
    }
    return map
  })
  recordsAre([])
  dropsAre([])
  getRecordedCharacterOcidsMock.mockResolvedValue([])
  getWeeklyPeriodKeysWithRecordsMock.mockResolvedValue([])
  getMonthlyDefeatDatesMock.mockResolvedValue([])
  getManualCompletedKeysMock.mockResolvedValue([])
  // 기본은 바로 옆 칸에 기록이 있다. 이전 화살표가 살아 있는 쪽이 보통이다.
  findAdjacentMock.mockImplementation(async (_ocids: string[], tab: BossCycle, key: string, direction: 'prev' | 'next') =>
    getAdjacentPeriodKey(tab, key, direction),
  )
  replaceBossDropRecordsMock.mockResolvedValue([])
  getScheduleProbeLedgerMock.mockResolvedValue({ unavailable: false, dates: {} })
  getTrackingModeMock.mockResolvedValue('auto')
  getManualTrackedContentMock.mockResolvedValue([])
  syncWindowMock.mockResolvedValue(undefined)
  windowFailuresMock.mockReturnValue([])
})

afterEach(() => {
  jest.resetAllMocks()
  jest.useRealTimers()
})

describe('지금 기간은 스케줄 캐시에서 행을 만든다', () => {
  it('완료 보스는 행이 되고 기록이 없으면 인원과 금액 칸이 비어 있다', async () => {
    track(['ocid-1'])
    schedule('ocid-1', [bossContent()])

    const snapshot = await build('weekly', currentKey('weekly'))

    expect(snapshot.rows).toHaveLength(1)
    expect(snapshot.rows[0]).toMatchObject({
      ocid: 'ocid-1',
      characterName: '캐릭터-ocid-1',
      imageUrl: 'x',
      bossKey: 'zakum',
      difficulty: 'chaos',
      isComplete: true,
      priceMeso: 8_080_000,
      partySize: null,
      payoutMeso: null,
    })
    expect(snapshot.periodState).toBe('recorded')
    expect(snapshot.periodPendingAggregation).toBe(false)
  })

  it('등록만 하고 안 잡은 보스는 미완료 자리로 서고, 등록도 처치도 안 한 보스는 안 선다', async () => {
    track(['ocid-1'])
    schedule('ocid-1', [
      bossContent({ isRegistered: false, isComplete: false }),
      bossContent({ bossKey: 'lotus', apiName: '스우', difficulty: 'normal', isComplete: false }),
      bossContent({ bossKey: 'lucid', apiName: '루시드', difficulty: 'normal' }),
    ])

    const snapshot = await build('weekly', currentKey('weekly'))

    expect(snapshot.rows.map((row) => [row.bossName, row.isComplete, row.payoutMeso])).toEqual([
      ['스우', false, 0],
      ['루시드', true, null],
    ])
  })

  it('기록이 있으면 인원과 금액을 기록에서 얹는다. 기록의 가격이 지금 시세와 달라도 기록값이다', async () => {
    track(['ocid-1'])
    schedule('ocid-1', [bossContent()])
    recordsAre([record({ periodKey: currentKey('weekly'), partySize: 2, priceMeso: 7_000_000, payoutMeso: 3_500_000 })])

    const snapshot = await build('weekly', currentKey('weekly'))

    expect(snapshot.rows[0]).toMatchObject({ partySize: 2, priceMeso: 7_000_000, payoutMeso: 3_500_000 })
  })

  it('캐시가 없는 추적 캐릭터는 행이 없다', async () => {
    track(['ocid-1', 'ocid-2'])
    schedule('ocid-1', [bossContent()])

    const snapshot = await build('weekly', currentKey('weekly'), ['ocid-1', 'ocid-2'])

    expect(snapshot.rows.map((row) => row.ocid)).toEqual(['ocid-1'])
  })

  it('주간 탭은 이번 주에 잡은 월간 보스를 맨 위에 함께 내고, 월간 탭은 자기 주기만 낸다', async () => {
    track(['ocid-1'])
    schedule('ocid-1', [
      bossContent(),
      bossContent({ bossKey: 'black_mage', apiName: '검은 마법사', difficulty: 'extreme', cycle: 'monthly' }),
    ])

    const weekly = await build('weekly', currentKey('weekly'))
    const monthly = await build('monthly', currentKey('monthly'))

    expect(weekly.rows.map((row) => row.bossName)).toEqual(['검은 마법사', '자쿰'])
    expect(weekly.rows[0].cycle).toBe('monthly')
    expect(monthly.rows.map((row) => row.bossName)).toEqual(['검은 마법사'])
  })

  // 월간 보스를 잡은 뒤 오래 접속하지 않으면 응답이 그 보스를 미등록 · 미처치로만 남겨 캐시에 행이 없다.
  it('캐시에 행이 없고 기록만 있는 조합은 기록에서 되살리고, 그 캐릭터의 이름은 캐시 엔트리의 이름이다', async () => {
    const month = currentKey('monthly')
    track(['ocid-1'])
    schedule('ocid-1', [], '행없는캐릭터')
    recordsAre([
      record({
        bossKey: 'black_mage',
        boss: '검은 마법사',
        difficulty: 'extreme',
        cycle: 'monthly',
        periodKey: month,
        priceMeso: 665_000_000,
        payoutMeso: 665_000_000,
      }),
    ])

    const snapshot = await build('monthly', month)

    expect(snapshot.rows).toHaveLength(1)
    expect(snapshot.rows[0]).toMatchObject({ bossName: '검은 마법사', periodKey: month, payoutMeso: 665_000_000, characterName: '행없는캐릭터' })
    // 행이 없는 기간의 기록을 조회조차 안 하면 되살릴 재료가 없다.
    expect(getBossProfitRecordsMock).toHaveBeenCalledWith(['ocid-1'], expect.arrayContaining([currentKey('weekly'), month]))
  })

  it('캐릭터 순서는 레벨 내림차순이고 같으면 이름순이다. 추적 순서와 되살린 행인지는 안 본다', async () => {
    const month = currentKey('monthly')
    profiles = {
      'ocid-1': { name: '가나다', level: 200 },
      'ocid-2': { name: '나다라', level: 200 },
      'ocid-3': { name: '다라마', level: 250 },
    }
    track(['ocid-1', 'ocid-2', 'ocid-3'])
    schedule('ocid-1', [bossContent({ bossKey: 'black_mage', apiName: '검은 마법사', difficulty: 'extreme', cycle: 'monthly' })])
    schedule('ocid-2', [bossContent({ bossKey: 'black_mage', apiName: '검은 마법사', difficulty: 'extreme', cycle: 'monthly' })])
    schedule('ocid-3', [])
    recordsAre([record({ ocid: 'ocid-3', bossKey: 'black_mage', boss: '검은 마법사', difficulty: 'extreme', cycle: 'monthly', periodKey: month })])

    const snapshot = await build('monthly', month, ['ocid-1', 'ocid-2', 'ocid-3'])

    expect(snapshot.rows.map((row) => row.ocid)).toEqual(['ocid-3', 'ocid-1', 'ocid-2'])
  })

  it('행의 월드는 프로필 스냅샷에서 오고 모르면 null 이다. 지난 기간의 행도 같다', async () => {
    profiles = { 'ocid-1': { world: '스카니아', worldKey: 'scania' } }
    track(['ocid-1', 'ocid-2'])
    schedule('ocid-1', [bossContent()])
    schedule('ocid-2', [bossContent()])
    const previous = getAdjacentPeriodKey('weekly', currentKey('weekly'), 'prev')
    recordsAre([record({ periodKey: previous })])

    const current = await build('weekly', currentKey('weekly'), ['ocid-1', 'ocid-2'])
    const past = await build('weekly', previous, ['ocid-1', 'ocid-2'])

    expect(current.rows.find((row) => row.ocid === 'ocid-1')).toMatchObject({ world: '스카니아', worldKey: 'scania' })
    expect(current.rows.find((row) => row.ocid === 'ocid-2')).toMatchObject({ world: null, worldKey: null })
    expect(past.rows[0]).toMatchObject({ ocid: 'ocid-1', world: '스카니아', worldKey: 'scania' })
  })
})

describe('수동 트래킹 모드', () => {
  beforeEach(() => {
    getTrackingModeMock.mockResolvedValue('manual')
    track(['ocid-1'])
  })

  it('수동으로만 추적한 보스는 캐시에 없어도 미완료 자리로 선다', async () => {
    getManualTrackedContentMock.mockResolvedValue([{ kind: 'boss', bossKey: 'lotus', difficulty: 'normal' }])
    schedule('ocid-1', [])

    const snapshot = await build('weekly', currentKey('weekly'))

    expect(snapshot.rows.map((row) => [row.bossName, row.isComplete, row.payoutMeso])).toEqual([['스우', false, 0]])
  })

  it('추적한 난이도와 다른 난이도로 잡았으면 잡은 난이도 한 줄만 선다', async () => {
    getManualTrackedContentMock.mockResolvedValue([{ kind: 'boss', bossKey: 'zakum', difficulty: 'hard' }])
    schedule('ocid-1', [bossContent({ difficulty: 'chaos', isRegistered: false })])

    const snapshot = await build('weekly', currentKey('weekly'))

    expect(snapshot.rows.map((row) => [row.bossKey, row.difficulty, row.isComplete])).toEqual([['zakum', 'chaos', true]])
  })

  it('추적하지 않은 보스도 잡았으면 서고, 추적 중인 미처치 보스는 자리로 함께 선다', async () => {
    getManualTrackedContentMock.mockResolvedValue([{ kind: 'boss', bossKey: 'lotus', difficulty: 'normal' }])
    schedule('ocid-1', [bossContent({ isRegistered: false })])

    const snapshot = await build('weekly', currentKey('weekly'))

    const byBoss = Object.fromEntries(snapshot.rows.map((row) => [row.bossName, row.isComplete]))
    expect(byBoss).toEqual({ 자쿰: true, 스우: false })
  })

  it('자동 모드에서는 수동 추적 목록을 읽지 않는다', async () => {
    getTrackingModeMock.mockResolvedValue('auto')
    getManualTrackedContentMock.mockResolvedValue([{ kind: 'boss', bossKey: 'lotus', difficulty: 'normal' }])
    schedule('ocid-1', [])

    const snapshot = await build('weekly', currentKey('weekly'))

    expect(snapshot.rows).toEqual([])
    expect(getManualTrackedContentMock).not.toHaveBeenCalled()
  })
})

// 추적에서 뺀 캐릭터의 기록은 지워지지 않는다. 동기화 대상은 추적 목록이고 그리는 범위는 기록을 남긴 캐릭터까지다.
describe('추적에서 빠진 캐릭터의 기록', () => {
  function 해제기록(periodKey: string): BossProfitRecord {
    return record({ ocid: 'ocid-해제', periodKey })
  }

  beforeEach(() => {
    track(['ocid-1'])
    schedule('ocid-1', [bossContent()])
    getRecordedCharacterOcidsMock.mockResolvedValue(['ocid-1', 'ocid-해제'])
  })

  it('지금 기간: 기록이 있는 것만 완료 행으로 서고 미완료 자리는 안 세운다', async () => {
    recordsAre([해제기록(currentKey('weekly'))])

    const snapshot = await build('weekly', currentKey('weekly'))

    const 해제행 = snapshot.rows.filter((row) => row.ocid === 'ocid-해제')
    expect(해제행).toHaveLength(1)
    expect(해제행[0].isComplete).toBe(true)
    expect(getBossProfitRecordsMock.mock.calls.every((call) => (call[0] as string[]).includes('ocid-해제'))).toBe(true)
  })

  it('지난 기간: 기록을 남긴 캐릭터까지 읽어 행으로 세운다', async () => {
    const previous = getAdjacentPeriodKey('weekly', currentKey('weekly'), 'prev')
    recordsAre([해제기록(previous)])

    const snapshot = await build('weekly', previous)

    expect(getBossProfitRecordsMock).toHaveBeenCalledWith(['ocid-1', 'ocid-해제'], expect.arrayContaining([previous]))
    expect(snapshot.rows.map((row) => [row.ocid, row.characterName])).toEqual([['ocid-해제', '캐릭터-ocid-해제']])
  })

  it('이전 화살표는 그리는 목록으로 기록이 있는 기간을 찾는다', async () => {
    findAdjacentMock.mockImplementation(async (ocids: string[]) => (ocids.includes('ocid-해제') ? '2026-05-07' : null))

    const snapshot = await build('weekly', currentKey('weekly'))

    expect(snapshot.canGoPreviousPeriod).toBe(true)
  })

  it('월간 탭: 이 달에 기록이 없으면 해제한 캐릭터의 카드가 안 서고, 추적 중인 캐릭터는 0 이어도 남는다', async () => {
    const snapshot = await build('monthly', currentKey('monthly'))

    expect(snapshot.weeklySubtotals.some((subtotal) => subtotal.ocid === 'ocid-해제')).toBe(false)
    expect(snapshot.weeklySubtotals.some((subtotal) => subtotal.ocid === 'ocid-1')).toBe(true)
  })

  it('월간 탭: 이 달에 기록이 있으면 해제한 캐릭터의 지난 주가 그 금액으로 선다', async () => {
    at('2026-07-22T12:00:00+09:00')
    recordsAre([해제기록('2026-07-09')])

    const snapshot = await build('monthly', '2026-07')

    expect(snapshot.weeklySubtotals.find((subtotal) => subtotal.ocid === 'ocid-해제' && subtotal.periodKey === '2026-07-09')).toMatchObject({
      totalMeso: 8_080_000,
      state: 'recorded',
    })
  })

  it('월간 탭: 이번 주에 해제해도 그 주에 받아 둔 수익은 기록으로 남는다', async () => {
    at('2026-07-22T12:00:00+09:00')
    recordsAre([해제기록('2026-07-16')])

    const snapshot = await build('monthly', '2026-07')

    expect(snapshot.weeklySubtotals.find((subtotal) => subtotal.ocid === 'ocid-해제' && subtotal.periodKey === '2026-07-16')).toMatchObject({
      totalMeso: 8_080_000,
      state: 'recorded',
    })
  })

  // 관리에서 뺀 캐릭터는 동기화가 안 돈다. 진행 중과 예정은 둘 다 앱이 그 캐릭터를 본다는 말이라 거짓이다.
  it('월간 탭: 해제한 캐릭터의 이번 주와 앞으로의 주는 진행 중 · 예정이 아니라 조회 불가다', async () => {
    at('2026-07-22T12:00:00+09:00')
    recordsAre([해제기록('2026-07-09')])

    const snapshot = await build('monthly', '2026-07')

    const stateOf = (ocid: string, periodKey: string) =>
      snapshot.weeklySubtotals.find((subtotal) => subtotal.ocid === ocid && subtotal.periodKey === periodKey)?.state
    expect(stateOf('ocid-해제', '2026-07-16')).toBe('outOfRange')
    expect(stateOf('ocid-해제', '2026-07-23')).toBe('outOfRange')
    expect(stateOf('ocid-1', '2026-07-16')).toBe('inProgress')
    expect(stateOf('ocid-1', '2026-07-23')).toBe('upcoming')
  })
})

describe('월간 탭의 주차 소계', () => {
  beforeEach(() => {
    at('2026-07-22T12:00:00+09:00')
    track(['ocid-1'])
    schedule('ocid-1', [bossContent()])
  })

  it('이번 달의 진행 중인 주는 지금 기간의 행에서 더하고 상태는 진행 중이다', async () => {
    recordsAre([record({ periodKey: '2026-07-16' })])

    const snapshot = await build('monthly', '2026-07')

    expect(snapshot.weeklySubtotals.find((subtotal) => subtotal.periodKey === '2026-07-16')).toMatchObject({
      state: 'inProgress',
      totalMeso: 8_080_000,
    })
  })

  it('롤링 창을 벗어난 주도 기록이 있으면 조회 불가가 아니라 확정 합계다', async () => {
    recordsAre([record({ periodKey: '2026-07-02', partySize: 2, payoutMeso: 4_040_000 })])

    const snapshot = await build('monthly', '2026-07')

    expect(snapshot.weeklySubtotals.find((subtotal) => subtotal.periodKey === '2026-07-02')).toMatchObject({
      state: 'recorded',
      totalMeso: 4_040_000,
    })
  })

  it('월간 보스의 수익은 어느 주차 소계에도 안 든다', async () => {
    recordsAre([
      record({
        bossKey: 'black_mage',
        boss: '검은마법사',
        difficulty: 'extreme',
        cycle: 'monthly',
        periodKey: '2026-07',
        priceMeso: 15_000_000_000,
        payoutMeso: 15_000_000_000,
        defeatedOn: '2026-07-12',
      }),
    ])

    const snapshot = await build('monthly', '2026-07')

    expect(snapshot.weeklySubtotals.every((subtotal) => subtotal.totalMeso === 0)).toBe(true)
  })

  it('미완료 보스에 적힌 드롭은 소계 금액에 안 더한다', async () => {
    schedule('ocid-1', [bossContent({ bossKey: 'lotus', apiName: '스우', difficulty: 'normal', isComplete: false })])
    dropsAre([
      dropRecord({
        bossKey: 'lotus',
        boss: '스우',
        difficulty: 'normal',
        periodKey: '2026-07-16',
        category: 'fixed',
        itemKey: null,
        itemName: '테스트 드롭',
        priceState: 'entered',
        priceMeso: 900_000_000,
        priceShare: 1,
      }),
    ])

    const snapshot = await build('monthly', '2026-07')

    expect(snapshot.weeklySubtotals.find((subtotal) => subtotal.periodKey === '2026-07-16')).toMatchObject({ totalMeso: 0, drops: [] })
  })

  it('달 경계를 걸친 진행 중인 주는 그 달이 지난 달이 된 뒤에도 기록으로 더한다', async () => {
    at('2026-08-02T12:00:00+09:00')
    recordsAre([record({ bossKey: 'lotus', boss: '스우', difficulty: 'normal', periodKey: '2026-07-30', partySize: 2, priceMeso: 4_000_000, payoutMeso: 2_000_000 })])

    const snapshot = await build('monthly', '2026-07')

    expect(snapshot.weeklySubtotals.find((subtotal) => subtotal.periodKey === '2026-07-30')).toMatchObject({
      state: 'inProgress',
      totalMeso: 2_000_000,
    })
  })

  it('지난 달에는 총액이 0 인 캐릭터의 줄이 안 선다', async () => {
    at('2026-08-20T12:00:00+09:00')
    track(['ocid-1', 'ocid-2'])
    schedule('ocid-2', [bossContent()])
    recordsAre([record({ periodKey: '2026-07-09' })])

    const snapshot = await build('monthly', '2026-07', ['ocid-1', 'ocid-2'])

    expect(snapshot.weeklySubtotals.some((subtotal) => subtotal.ocid === 'ocid-1')).toBe(true)
    expect(snapshot.weeklySubtotals.some((subtotal) => subtotal.ocid === 'ocid-2')).toBe(false)
  })

  // 월드 이전으로 새로 생긴 ocid 는 이전 날짜에 400 을 준다. 눌러도 같은 400 이라 다시 시도를 권하면 안 된다.
  it('원장이 날짜마다 400 으로 굳힌 주는 다시 시도가 아니라 조회 불가다', async () => {
    getScheduleProbeLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: Object.fromEntries(
        ['2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15'].map((day) => [day, { kind: 'outOfRange' }]),
      ),
    })

    const snapshot = await build('monthly', '2026-07')

    expect(snapshot.weeklySubtotals.find((subtotal) => subtotal.periodKey === '2026-07-09')?.state).toBe('outOfRange')
  })
})

// 월드 이전으로 목록에서 빠진 캐릭터는 회차 결과에 아예 안 온다. 빠진 것과 0 원인 것은 다른 사실이라 자리를 남긴다.
describe('동기화가 답하지 않은 추적 캐릭터', () => {
  const stranded: StrandedCharacter = { ocid: 'stranded', characterName: '캐릭터-stranded', world: undefined, worldKey: undefined, level: null, imageUrl: null }

  beforeEach(() => {
    track(['ocid-1', 'stranded'])
    schedule('ocid-1', [bossContent()])
  })

  it('주간 탭의 지금 기간에 행 없는 카드로 선다', async () => {
    round(['ocid-1', 'stranded'], [stranded])

    const snapshot = await build('weekly', currentKey('weekly'), ['ocid-1', 'stranded'])

    expect(snapshot.unqueryableCards).toEqual([{ ocid: 'stranded', characterName: '캐릭터-stranded', imageUrl: 'x' }])
  })

  it('동기화가 답한 캐릭터는 보스가 0 개여도 카드에 안 넣고, 월간 탭에서는 카드를 안 세운다', async () => {
    schedule('ocid-1', [])
    round(['ocid-1', 'stranded'], [stranded])

    const weekly = await build('weekly', currentKey('weekly'), ['ocid-1', 'stranded'])
    const monthly = await build('monthly', currentKey('monthly'), ['ocid-1', 'stranded'])

    expect(weekly.unqueryableCards.map((card) => card.ocid)).toEqual(['stranded'])
    // 월간 탭은 주차 소계의 추적 게이트가 카드를 세운다. 여기서 또 세우면 같은 캐릭터가 두 번 선다.
    expect(monthly.unqueryableCards).toEqual([])
  })

  // 조회 원장의 표식은 기기에 있어 회차가 돌기 전 첫 페인트에 이미 손에 있다.
  it('조회 원장이 조회 불가로 아는 추적 캐릭터는 회차 전에도 카드로 선다. 관리에서 뺀 캐릭터와 모르는 캐릭터는 안 선다', async () => {
    track(['ocid-1', 'stranded', 'new'])
    getRecordedCharacterOcidsMock.mockResolvedValue(['ocid-해제'])
    getScheduleProbeLedgerMock.mockImplementation(async (ocid: string) => ({
      unavailable: ocid === 'stranded' || ocid === 'ocid-해제',
      dates: {},
    }))

    const snapshot = await build('weekly', currentKey('weekly'), ['ocid-1', 'stranded', 'new'])

    expect(snapshot.unqueryableCards.map((card) => card.ocid)).toEqual(['stranded'])
  })
})

describe('지난 기간은 기록에서 행을 만든다', () => {
  const previous = () => getAdjacentPeriodKey('weekly', currentKey('weekly'), 'prev')

  beforeEach(() => {
    track(['ocid-1'])
    schedule('ocid-1', [bossContent()])
  })

  it('캐시의 행은 안 보고 기록으로만 만든다. 프로필의 이름과 얼굴이 실린다', async () => {
    recordsAre([record({ periodKey: previous(), partySize: 3, payoutMeso: 2_693_333 })])

    const snapshot = await build('weekly', previous())

    expect(snapshot.rows).toHaveLength(1)
    expect(snapshot.rows[0]).toMatchObject({ characterName: '캐릭터-ocid-1', imageUrl: 'x', partySize: 3, payoutMeso: 2_693_333 })
    expect(snapshot.periodState).toBe('recorded')
  })

  it('프로필을 모르는 캐릭터의 기록은 행이 안 된다', async () => {
    profiles = { 'ocid-1': null }
    recordsAre([record({ periodKey: previous() })])

    const snapshot = await build('weekly', previous())

    expect(snapshot.rows).toEqual([])
  })

  // 9/1 에 잡은 9월 보스는 달 경계 주(8/27~9/2)에 선다. 달 키를 하나만 읽으면 9월 기록이 안 걸려 행이 통째로 없다.
  it('달 경계 주를 열면 그 주에 잡은 다음 달 월간 보스가 선다', async () => {
    at('2026-09-05T12:00:00+09:00')
    recordsAre([
      record({
        bossKey: 'black_mage',
        boss: '검은마법사',
        difficulty: 'extreme',
        cycle: 'monthly',
        periodKey: '2026-09',
        priceMeso: 15_000_000_000,
        payoutMeso: 15_000_000_000,
        defeatedOn: '2026-09-01',
      }),
    ])

    const snapshot = await build('weekly', '2026-08-27')

    expect(snapshot.rows.find((row) => row.bossKey === 'black_mage')?.payoutMeso).toBe(15_000_000_000)
    expect(getBossProfitRecordsMock.mock.calls.flatMap((call) => call[1] as string[])).toContain('2026-09')
  })

  it('조회는 되는데 관측이 없는 기간은 창 동기화를 부르고 기다린 뒤 원장을 다시 읽는다', async () => {
    const onWindowSyncStart = jest.fn()
    syncWindowMock.mockImplementation(async () => {
      getScheduleProbeLedgerMock.mockResolvedValue(observedLedger('weekly', previous()))
    })

    const snapshot = await build('weekly', previous(), ['ocid-1'], onWindowSyncStart)

    expect(syncWindowMock).toHaveBeenCalledWith(['ocid-1'], expect.any(Date))
    expect(onWindowSyncStart.mock.invocationCallOrder[0]).toBeLessThan(syncWindowMock.mock.invocationCallOrder[0])
    // 창이 채운 관측을 다시 읽었으니 조회해서 0 건이다.
    expect(snapshot.periodState).toBe('confirmedEmpty')
  })

  it('관측이 있으면 창을 안 부르고, 원장이 캐릭터를 조회 불가로 알면 창 없이 조회 불가다', async () => {
    getScheduleProbeLedgerMock.mockResolvedValue(observedLedger('weekly', previous()))
    const observed = await build('weekly', previous())

    getScheduleProbeLedgerMock.mockResolvedValue({ unavailable: true, dates: {} })
    const unavailable = await build('weekly', previous())

    expect(syncWindowMock).not.toHaveBeenCalled()
    expect(observed.periodState).toBe('confirmedEmpty')
    expect(unavailable.periodState).toBe('outOfRange')
  })

  it('창을 채워도 관측도 기록도 없으면 실패다', async () => {
    const snapshot = await build('weekly', previous())

    expect(syncWindowMock).toHaveBeenCalledTimes(1)
    expect(snapshot.periodState).toBe('failed')
  })

  // 목요일 새벽에는 지난 주 수요일만 집계 전이다. 상태는 관측이 있어 묻히므로 따로 든다.
  it('그 기간에 집계 전인 날이 있으면 periodPendingAggregation 이 참이다', async () => {
    at('2026-07-23T02:00:00+09:00')
    windowFailuresMock.mockReturnValue([{ ocid: 'ocid-1', dateKey: '2026-07-22', outcome: 'notCollected' }])

    const snapshot = await build('weekly', '2026-07-16')

    expect(snapshot.periodPendingAggregation).toBe(true)
    expect(snapshot.periodState).toBe('notCollected')
  })

  // 지난 기간은 기록이 곧 사실이라 기록에 없는 보스의 드롭은 안 잡은 보스의 드롭이다.
  it('기록에 없는 보스의 드롭은 그 기간을 열 때 지우고, 정리에는 추적 캐릭터만 넘긴다', async () => {
    getRecordedCharacterOcidsMock.mockResolvedValue(['ocid-1', 'ocid-해제'])
    recordsAre([
      record({ bossKey: 'lotus', boss: '스우', difficulty: 'hard', periodKey: previous(), priceMeso: 1000, payoutMeso: 1000 }),
      record({ ocid: 'ocid-해제', periodKey: previous() }),
    ])
    dropsAre([
      dropRecord({ periodKey: previous() }),
      dropRecord({ dropRecordId: 'drop-2', ocid: 'ocid-해제', bossKey: 'lotus', boss: '스우', difficulty: 'hard', periodKey: previous() }),
    ])

    await build('weekly', previous())

    expect(replaceBossDropRecordsMock).toHaveBeenCalledTimes(1)
    expect(replaceBossDropRecordsMock).toHaveBeenCalledWith('ocid-1', 'zakum', 'chaos', previous(), [], expect.any(String), { name: null, key: null })
  })

  it('기록이 하나도 없는 지난 주의 드롭은 손대지 않는다', async () => {
    dropsAre([dropRecord({ periodKey: previous() })])

    await build('weekly', previous())

    expect(replaceBossDropRecordsMock).not.toHaveBeenCalled()
  })
})

describe('periodNeedsWindowSync', () => {
  it('조회 가능한 기간에 관측도 조회 불가 표식도 없을 때만 참이다', () => {
    at(PINNED_NOW)
    const now = new Date()
    const previous = getAdjacentPeriodKey('weekly', currentKey('weekly'), 'prev')
    const key = periodStateKey('ocid-1', 'weekly', previous)

    expect(periodNeedsWindowSync('weekly', previous, ['ocid-1'], new Set(), new Set(), now)).toBe(true)
    expect(periodNeedsWindowSync('weekly', previous, ['ocid-1'], new Set([key]), new Set(), now)).toBe(false)
    expect(periodNeedsWindowSync('weekly', previous, ['ocid-1'], new Set(), new Set([key]), now)).toBe(false)
    // 롤링 창 밖의 주는 조회 자체가 안 된다.
    expect(periodNeedsWindowSync('weekly', '2026-07-02', ['ocid-1'], new Set(), new Set(), now)).toBe(false)
  })
})
