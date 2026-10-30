/**
 * `bossProfitPeriod(tab, periodKey)` 쿼리의 표식 · 미리 읽기 · 무효화. 스냅샷을 만드는 규칙은 `period-snapshot.spec.ts` 가 보고,
 * 여기서는 스냅샷 만들기를 목으로 두고 쿼리 캐시가 그것을 언제 부르는지만 본다.
 */
jest.mock('../period-snapshot', () => ({
  buildPeriodSnapshot: jest.fn(),
  periodNeedsWindowSync: jest.fn(),
  resolveDisplayOcids: jest.fn(),
}))
jest.mock('../period-window', () => ({ resolvePeriodWindow: jest.fn() }))
jest.mock('../../schedule-sync/schedule-query', () => ({ readTrackedOcids: jest.fn() }))
jest.mock('../../schedule-window/records', () => ({
  loadObservedPeriodKeys: jest.fn(async () => new Set<string>()),
  loadUnqueryablePeriodKeys: jest.fn(async () => new Set<string>()),
}))
// 표의 판 구독은 무효화가 쓴다. 보스 기록만 리스너를 잡아 판이 오른 것처럼 부른다.
jest.mock('../../../storage/boss-profit', () => ({ subscribeBossProfitRecordsRevision: jest.fn(() => () => undefined) }))
jest.mock('../../../storage/boss-drops', () => ({ subscribeBossDropRecordsRevision: jest.fn(() => () => undefined) }))
jest.mock('../../../storage/income', () => ({ subscribeIncomeRecordsRevision: jest.fn(() => () => undefined) }))
jest.mock('../../../storage/spend', () => ({ subscribeSpendRecordsRevision: jest.fn(() => () => undefined) }))
jest.mock('../../../storage/enhancement-totals', () => ({ subscribeEnhancementTotalsRevision: jest.fn(() => () => undefined) }))
jest.mock('../../../storage/schedule-probe-ledger', () => ({ subscribeScheduleProbeLedgerRevision: jest.fn(() => () => undefined) }))

import { waitFor } from '../../../__tests__/wait-for'
import { getAdjacentPeriodKey, getCurrentBossProfitPeriod } from '../../../lib/boss/boss-profit-period'
import type { BossCycle } from '../../../types'
import { queryClient } from '../../query/client'
import { startRecordInvalidation } from '../../query/invalidation'
import { queryKeys } from '../../query/keys'
import { bossProfitPeriodOptions, prefetchPeriodWindow, readPeriodSnapshot, refetchPeriod } from '../period-query'
import type { PeriodSnapshot } from '../period-snapshot'
import type { PeriodWindowEntry } from '../period-window'

const {
  buildPeriodSnapshot: buildMock,
  periodNeedsWindowSync: needsWindowSyncMock,
  resolveDisplayOcids: resolveDisplayOcidsMock,
} = jest.requireMock('../period-snapshot') as Record<string, jest.Mock>
const { resolvePeriodWindow: resolveWindowMock } = jest.requireMock('../period-window') as Record<string, jest.Mock>
const { readTrackedOcids: readTrackedOcidsMock } = jest.requireMock('../../schedule-sync/schedule-query') as Record<string, jest.Mock>
const { subscribeBossProfitRecordsRevision: subscribeRecordsMock } = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>

const NOT_FAKED = [
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask',
  'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'hrtime',
] as never

const PINNED_NOW = new Date('2026-09-12T12:00:00+09:00')
const WEEK = getCurrentBossProfitPeriod('weekly', PINNED_NOW).periodKey
const MONTH = getCurrentBossProfitPeriod('monthly', PINNED_NOW).periodKey
const PREVIOUS = getAdjacentPeriodKey('weekly', WEEK, 'prev')
const EARLIER = getAdjacentPeriodKey('weekly', PREVIOUS, 'prev')

function snapshot(partial: Partial<PeriodSnapshot> = {}): PeriodSnapshot {
  return {
    rows: [],
    dropsByRowKey: {},
    weeklySubtotals: [],
    periodState: 'confirmedEmpty',
    periodPendingAggregation: false,
    canGoPreviousPeriod: false,
    unqueryableCards: [],
    ...partial,
  }
}

function entry(tab: BossCycle, periodKey: string): PeriodWindowEntry {
  return { tab, periodKey }
}

/** 스냅샷 만들기가 불린 기간. 순서가 곧 읽은 차례다. */
function builtPeriods(): [BossCycle, string][] {
  return buildMock.mock.calls.map((call) => [call[0].tab, call[0].periodKey])
}

function isInvalidated(tab: BossCycle, periodKey: string): boolean {
  return queryClient.getQueryState(queryKeys.bossProfitPeriod(tab, periodKey))?.isInvalidated === true
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: NOT_FAKED })
  jest.setSystemTime(PINNED_NOW)
  jest.clearAllMocks()
  queryClient.clear()
  readTrackedOcidsMock.mockResolvedValue(['ocid-1'])
  resolveDisplayOcidsMock.mockImplementation(async (ocids: readonly string[]) => [...ocids])
  needsWindowSyncMock.mockReturnValue(false)
  buildMock.mockImplementation(async () => snapshot())
  resolveWindowMock.mockResolvedValue([])
})

afterEach(() => {
  jest.useRealTimers()
})

describe('bossProfitPeriodOptions', () => {
  it('보스 기록 · 드롭 기록 · 조회 원장을 읽고 스케줄 회차에 기댄다고 적는다', () => {
    const options = bossProfitPeriodOptions('weekly', WEEK)

    expect(options.queryKey).toEqual(queryKeys.bossProfitPeriod('weekly', WEEK))
    expect(options.meta).toEqual({
      tables: ['boss_profit_records', 'boss_drop_records', 'schedule_probe_ledger'],
      dependsOn: ['schedule-round'],
    })
  })

  it('추적 목록과 지금 시각으로 스냅샷을 만들어 캐시에 든다. 추적이 없으면 빈 목록이다', async () => {
    const built = snapshot({ periodState: 'recorded' })
    buildMock.mockResolvedValue(built)

    await queryClient.fetchQuery(bossProfitPeriodOptions('weekly', WEEK))
    readTrackedOcidsMock.mockResolvedValue(null)
    await queryClient.fetchQuery(bossProfitPeriodOptions('monthly', MONTH))

    expect(buildMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tab: 'weekly', periodKey: WEEK, ocids: ['ocid-1'], now: expect.any(Date), onWindowSyncStart: expect.any(Function) }),
    )
    expect(buildMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ tab: 'monthly', periodKey: MONTH, ocids: [] }))
    expect(readPeriodSnapshot('weekly', WEEK)).toBe(built)
  })
})

describe('prefetchPeriodWindow', () => {
  it('창의 기간을 차례로 읽는다. 보는 기간과 이미 든 기간은 건너뛴다', async () => {
    resolveWindowMock.mockResolvedValue([entry('weekly', WEEK), entry('monthly', MONTH), entry('weekly', PREVIOUS), entry('weekly', EARLIER)])
    queryClient.setQueryData(queryKeys.bossProfitPeriod('monthly', MONTH), snapshot())

    await prefetchPeriodWindow('weekly', WEEK)

    expect(builtPeriods()).toEqual([
      ['weekly', PREVIOUS],
      ['weekly', EARLIER],
    ])
    expect(readPeriodSnapshot('weekly', EARLIER)).toBeDefined()
  })

  it('무효 표시가 된 기간은 들어 있어도 다시 읽는다', async () => {
    resolveWindowMock.mockResolvedValue([entry('weekly', WEEK), entry('weekly', PREVIOUS)])
    queryClient.setQueryData(queryKeys.bossProfitPeriod('weekly', PREVIOUS), snapshot())
    await queryClient.invalidateQueries({ queryKey: queryKeys.bossProfitPeriod('weekly', PREVIOUS), refetchType: 'none' })

    await prefetchPeriodWindow('weekly', WEEK)

    expect(builtPeriods()).toEqual([['weekly', PREVIOUS]])
  })

  // 배경에서 넥슨을 부르지 않는다. 그 기간은 사용자가 실제로 가면 그때 돈다.
  it('창 동기화가 있어야 답이 나오는 기간은 건너뛴다. 창은 그리는 목록으로, 판정은 추적 목록으로 한다', async () => {
    resolveDisplayOcidsMock.mockResolvedValue(['ocid-1', 'ocid-해제'])
    resolveWindowMock.mockResolvedValue([entry('weekly', WEEK), entry('weekly', PREVIOUS), entry('weekly', EARLIER)])
    needsWindowSyncMock.mockImplementation((_tab: BossCycle, periodKey: string) => periodKey === PREVIOUS)

    await prefetchPeriodWindow('weekly', WEEK)

    expect(resolveWindowMock).toHaveBeenCalledWith('weekly', WEEK, ['ocid-1', 'ocid-해제'], expect.any(Date))
    expect(needsWindowSyncMock).toHaveBeenCalledWith('weekly', PREVIOUS, ['ocid-1'], expect.any(Set), expect.any(Set), expect.any(Date))
    expect(builtPeriods()).toEqual([['weekly', EARLIER]])
  })

  it('새 미리 읽기가 시작되면 앞의 것은 남은 기간을 안 읽는다', async () => {
    let release!: () => void
    buildMock.mockImplementation(
      async ({ periodKey }: { periodKey: string }) =>
        new Promise<PeriodSnapshot>((resolve) => {
          if (periodKey !== PREVIOUS) {
            resolve(snapshot())
            return
          }
          release = () => resolve(snapshot())
        }),
    )
    resolveWindowMock
      .mockResolvedValueOnce([entry('weekly', WEEK), entry('weekly', PREVIOUS), entry('weekly', EARLIER)])
      .mockResolvedValueOnce([entry('weekly', WEEK), entry('monthly', MONTH)])

    const first = prefetchPeriodWindow('weekly', WEEK)
    await waitFor(() => expect(buildMock).toHaveBeenCalledTimes(1))
    await prefetchPeriodWindow('weekly', WEEK)
    release()
    await first

    expect(builtPeriods()).toEqual([
      ['weekly', PREVIOUS],
      ['monthly', MONTH],
    ])
  })
})

describe('무효화', () => {
  let stop: () => void

  beforeEach(() => {
    stop = startRecordInvalidation(queryClient)
  })

  afterEach(() => {
    stop()
  })

  it('스케줄 회차가 새 데이터를 들면 기간 쿼리가 무효화된다', async () => {
    await queryClient.fetchQuery(bossProfitPeriodOptions('weekly', WEEK))
    await queryClient.fetchQuery(bossProfitPeriodOptions('weekly', PREVIOUS))

    queryClient.setQueryData(queryKeys.scheduleRound(), { fetchedAt: new Date().toISOString(), ocids: ['ocid-1'], outcomes: {}, stranded: [] })

    expect(isInvalidated('weekly', WEEK)).toBe(true)
    expect(isInvalidated('weekly', PREVIOUS)).toBe(true)
  })

  it('보스 기록의 판이 오르면 기간 쿼리는 무효화되고 그 표를 안 읽는 쿼리는 그대로다', async () => {
    await queryClient.fetchQuery(bossProfitPeriodOptions('monthly', MONTH))
    queryClient.setQueryData(queryKeys.schedule('ocid-1'), { state: {}, syncedAt: 'x' })
    const notifyRecordsRevision = subscribeRecordsMock.mock.calls[0][0] as () => void

    notifyRecordsRevision()

    expect(isInvalidated('monthly', MONTH)).toBe(true)
    expect(queryClient.getQueryState(queryKeys.schedule('ocid-1'))?.isInvalidated).toBe(false)
  })
})

describe('refetchPeriod', () => {
  it('그 기간만 신선해도 다시 읽는다', async () => {
    await queryClient.fetchQuery(bossProfitPeriodOptions('weekly', WEEK))
    await queryClient.fetchQuery(bossProfitPeriodOptions('weekly', PREVIOUS))
    buildMock.mockClear()

    await refetchPeriod('weekly', PREVIOUS)

    expect(builtPeriods()).toEqual([['weekly', PREVIOUS]])
  })
})
