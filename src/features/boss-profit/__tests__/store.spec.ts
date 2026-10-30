/**
 * 보스 수익 스토어의 화면 상태(탭 · 기간 · 파티 계획)와 쓰기 액션. 기간의 행은 쿼리 캐시에 스냅샷을 직접 넣어 준비한다.
 * 스냅샷을 만드는 규칙은 `period-snapshot.spec.ts` 가, 쿼리의 표식과 미리 읽기는 `period-query.spec.ts` 가 본다.
 */
jest.mock('../../../storage/boss-profit', () => ({
  upsertBossProfitRecord: jest.fn(),
  deleteBossProfitRecord: jest.fn(),
  setBossProfitDefeatedOn: jest.fn(),
  findAdjacentPeriodKeyWithRecords: jest.fn(),
  getMonthlyDefeatDates: jest.fn(),
  getRecordedCharacterOcids: jest.fn(),
  // 아래는 이 스위트가 안 부르지만 함께 들어오는 모듈이 가져온다.
  getBossProfitRecords: jest.fn(),
  getWeeklyPeriodKeysWithRecords: jest.fn(),
  getManualBossProfitRecordKeys: jest.fn(),
  fillMissingRecordWorlds: jest.fn(),
  markBossProfitRecordAuto: jest.fn(),
  subscribeBossProfitRecordsRevision: jest.fn(() => () => undefined),
  getBossProfitRecordsRevision: jest.fn(() => 0),
}))
jest.mock('../../../storage/boss-drops', () => ({
  // 실물과 같은 값이어야 호출 단언이 맞는다. 목이 안 내주면 `undefined` 가 흐른다.
  NO_WORLD: { name: null, key: null },
  replaceBossDropRecords: jest.fn(),
  getBossDropRecords: jest.fn(),
  subscribeBossDropRecordsRevision: jest.fn(() => () => undefined),
  getBossDropRecordsRevision: jest.fn(() => 0),
}))
jest.mock('../../../storage/boss-party-settings', () => ({
  getBossPartySettings: jest.fn(),
  getBossPartySetting: jest.fn(),
  getBossPartySize: jest.fn(),
}))
jest.mock('../../../storage/boss-party-period-overrides', () => ({
  getBossPartyPeriodOverrides: jest.fn(),
  getBossPartyPeriodOverride: jest.fn(),
  setBossPartyPeriodOverride: jest.fn(),
}))
jest.mock('../../../storage/income', () => ({ subscribeIncomeRecordsRevision: jest.fn(() => () => undefined) }))
jest.mock('../../../storage/spend', () => ({ subscribeSpendRecordsRevision: jest.fn(() => () => undefined) }))
jest.mock('../../../storage/enhancement-totals', () => ({ subscribeEnhancementTotalsRevision: jest.fn(() => () => undefined) }))
jest.mock('../../../storage/schedule-probe-ledger', () => ({
  getScheduleProbeLedger: jest.fn(),
  subscribeScheduleProbeLedgerRevision: jest.fn(() => () => undefined),
}))
// 서버 전송 · 리뷰 요청은 다른 기능이 소유한다. 여기서는 부르는지만 본다.
jest.mock('../../app-review/request', () => ({ countCoreSave: jest.fn() }))
jest.mock('../../server-sync/drop-price-sync', () => ({ reportDropPrice: jest.fn(), reportDropRemoved: jest.fn() }))
jest.mock('../../mvp-grade/auto-fee', () => ({ lazyAutoFeePercent: () => async () => 3, settingSplitFee: jest.fn() }))
// 다시 읽기는 쿼리 캐시의 일이라 불리는지만 본다. 나머지는 실물이다.
jest.mock('../period-query', () => ({
  ...jest.requireActual<typeof import('../period-query')>('../period-query'),
  refetchPeriod: jest.fn(),
}))

import { getAdjacentPeriodKey, getCurrentBossProfitPeriod } from '../../../lib/boss/boss-profit-period'
import type { BossCycle } from '../../../types'
import type { RecordedDrop } from '../../../types/drops'
import { queryClient } from '../../query/client'
import { startRecordInvalidation } from '../../query/invalidation'
import { queryKeys } from '../../query/keys'
import { partyPlanKey } from '../party-plans'
import { bossProfitPeriodOptions } from '../period-query'
import type { PeriodSnapshot } from '../period-snapshot'
import type { BossProfitRow } from '../rows'
import { useBossProfitStore } from '../store'

const {
  upsertBossProfitRecord: upsertBossProfitRecordMock,
  deleteBossProfitRecord: deleteBossProfitRecordMock,
  setBossProfitDefeatedOn: setBossProfitDefeatedOnMock,
  findAdjacentPeriodKeyWithRecords: findAdjacentMock,
  getMonthlyDefeatDates: getMonthlyDefeatDatesMock,
  getRecordedCharacterOcids: getRecordedCharacterOcidsMock,
  subscribeBossProfitRecordsRevision: subscribeRecordsMock,
} = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
const { replaceBossDropRecords: replaceBossDropRecordsMock, getBossDropRecords: getBossDropRecordsMock } = jest.requireMock(
  '../../../storage/boss-drops',
) as Record<string, jest.Mock>
const { getBossPartySettings: getBossPartySettingsMock } = jest.requireMock('../../../storage/boss-party-settings') as Record<string, jest.Mock>
const { getBossPartyPeriodOverrides: getBossPartyPeriodOverridesMock, setBossPartyPeriodOverride: setBossPartyPeriodOverrideMock } =
  jest.requireMock('../../../storage/boss-party-period-overrides') as Record<string, jest.Mock>
const { countCoreSave: countCoreSaveMock } = jest.requireMock('../../app-review/request') as Record<string, jest.Mock>
const { reportDropPrice: reportDropPriceMock, reportDropRemoved: reportDropRemovedMock } = jest.requireMock(
  '../../server-sync/drop-price-sync',
) as Record<string, jest.Mock>
const { refetchPeriod: refetchPeriodMock } = jest.requireMock('../period-query') as Record<string, jest.Mock>

const NOT_FAKED = [
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask',
  'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'hrtime',
] as never

/** 이 파일의 지금. 결정석 가격이 기간을 들어 실제 시계로 돌면 패치일이 지나는 순간 기대값(자쿰 카오스 8,080,000)이 틀린다. */
const PINNED_NOW = new Date('2026-09-12T12:00:00+09:00')
const WEEK = getCurrentBossProfitPeriod('weekly', PINNED_NOW).periodKey
const MONTH = getCurrentBossProfitPeriod('monthly', PINNED_NOW).periodKey
const PREVIOUS_WEEK = getAdjacentPeriodKey('weekly', WEEK, 'prev')

/** 비율을 안 쓰는 파티. 인원만 고치는 테스트가 넘긴다. */
const EVEN_SHARES = { myShare: null, sharesTotal: null, splitFeePercent: null }

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '캐릭터-ocid-1',
    imageUrl: null,
    world: null,
    worldKey: null,
    bossKey: 'zakum',
    bossName: '자쿰',
    difficulty: 'chaos',
    cycle: 'weekly',
    periodKey: WEEK,
    periodLabel: '이번 주',
    priceMeso: 8_080_000,
    maxPartySize: 6,
    partySize: 1,
    payoutMeso: 8_080_000,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    isComplete: true,
    defeatedOn: null,
    source: 'auto',
    ...overrides,
  }
}

/** 아직 안 잡은 월간 보스. 직접 완료를 적는 자리다. */
function monthlyPlaceholder(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return row({
    bossKey: 'black_mage',
    bossName: '검은 마법사',
    difficulty: 'extreme',
    cycle: 'monthly',
    periodKey: MONTH,
    periodLabel: '이번 달',
    priceMeso: 8_740_000_000,
    partySize: null,
    payoutMeso: 0,
    isComplete: false,
    ...overrides,
  })
}

function drop(overrides: Partial<RecordedDrop> = {}): RecordedDrop {
  return { dropRecordId: null, category: 'equipment', itemKey: 'restraint_ring', itemName: '리스트레인트 링', quantity: 1, ...overrides }
}

/** 그 기간의 스냅샷을 쿼리 캐시에 넣는다. 실물 옵션의 `meta` 를 붙여야 표의 판 무효화가 이 쿼리를 찾는다. */
function seedPeriod(tab: BossCycle, periodKey: string, partial: Partial<PeriodSnapshot> = {}): PeriodSnapshot {
  const snapshot: PeriodSnapshot = {
    rows: [],
    dropsByRowKey: {},
    weeklySubtotals: [],
    periodState: 'recorded',
    periodPendingAggregation: false,
    canGoPreviousPeriod: true,
    unqueryableCards: [],
    ...partial,
  }
  const queryKey = queryKeys.bossProfitPeriod(tab, periodKey)
  queryClient.setQueryData(queryKey, snapshot)
  queryClient.getQueryCache().find({ queryKey })?.setOptions({ queryKey, meta: bossProfitPeriodOptions(tab, periodKey).meta })
  return snapshot
}

function store() {
  return useBossProfitStore.getState()
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: NOT_FAKED })
  jest.setSystemTime(PINNED_NOW)
  jest.clearAllMocks()
  queryClient.clear()
  queryClient.setQueryData(queryKeys.trackedOcids(), ['ocid-1'])
  useBossProfitStore.setState({ tab: 'weekly', periodKey: WEEK, partyPlans: {} })
  // 기본은 바로 옆 칸에 기록이 있다.
  findAdjacentMock.mockImplementation(async (_ocids: string[], tab: BossCycle, key: string, direction: 'prev' | 'next') =>
    getAdjacentPeriodKey(tab, key, direction),
  )
  getMonthlyDefeatDatesMock.mockResolvedValue([])
  getRecordedCharacterOcidsMock.mockResolvedValue([])
  upsertBossProfitRecordMock.mockResolvedValue(undefined)
  deleteBossProfitRecordMock.mockResolvedValue(undefined)
  setBossProfitDefeatedOnMock.mockResolvedValue(undefined)
  replaceBossDropRecordsMock.mockResolvedValue([])
  getBossDropRecordsMock.mockResolvedValue([])
  getBossPartySettingsMock.mockResolvedValue([])
  getBossPartyPeriodOverridesMock.mockResolvedValue([])
  setBossPartyPeriodOverrideMock.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.useRealTimers()
})

describe('탭과 지금 기간', () => {
  it('setTab 은 그 탭의 지금 기간으로 간다', () => {
    store().setTab('monthly')

    expect(store()).toMatchObject({ tab: 'monthly', periodKey: MONTH })
  })

  it('goToCurrentPeriod 는 지난 기간에서 지금 기간으로 돌아오고, 이미 거기면 상태를 안 바꾼다', () => {
    useBossProfitStore.setState({ periodKey: PREVIOUS_WEEK })
    store().goToCurrentPeriod()
    expect(store().periodKey).toBe(WEEK)

    const listener = jest.fn()
    const unsubscribe = useBossProfitStore.subscribe(listener)
    store().goToCurrentPeriod()
    unsubscribe()

    expect(listener).not.toHaveBeenCalled()
  })

  // 수익 · 지출을 떠날 때 부른다. 옆 탭인 가계부가 떠나면 주간 · 이번 주로 돌아오는 것과 맞춘다.
  it('resetToCurrentWeek 는 월간 탭에서도 주간 탭의 지난 기간에서도 주간 · 이번 주로 돌린다', () => {
    useBossProfitStore.setState({ tab: 'monthly', periodKey: MONTH })
    store().resetToCurrentWeek()
    expect(store()).toMatchObject({ tab: 'weekly', periodKey: WEEK })

    useBossProfitStore.setState({ periodKey: PREVIOUS_WEEK })
    store().resetToCurrentWeek()
    expect(store()).toMatchObject({ tab: 'weekly', periodKey: WEEK })
  })

  it('resetToCurrentWeek 는 이미 주간 · 이번 주면 상태를 안 바꾼다', () => {
    const listener = jest.fn()
    const unsubscribe = useBossProfitStore.subscribe(listener)

    store().resetToCurrentWeek()
    unsubscribe()

    expect(listener).not.toHaveBeenCalled()
  })

  it('retryPeriod 는 보고 있는 기간을 다시 읽는다', async () => {
    useBossProfitStore.setState({ periodKey: PREVIOUS_WEEK })

    await store().retryPeriod()

    expect(refetchPeriodMock).toHaveBeenCalledWith('weekly', PREVIOUS_WEEK)
  })
})

describe('goToPreviousPeriod', () => {
  it('보는 기간의 이전 화살표가 살아 있지 않으면 기록을 찾지도 움직이지도 않는다', async () => {
    await store().goToPreviousPeriod()
    seedPeriod('weekly', WEEK, { canGoPreviousPeriod: false })
    await store().goToPreviousPeriod()

    expect(store().periodKey).toBe(WEEK)
    expect(findAdjacentMock).not.toHaveBeenCalled()
  })

  // 오래 쉬었다 돌아오면 그 사이가 전부 조회 불가라 한 칸씩 걸으면 예전 기록에 닿는 데 수십 번이 든다.
  it('기록이 있는 가장 가까운 기간으로 건너뛴다', async () => {
    seedPeriod('weekly', WEEK)
    findAdjacentMock.mockResolvedValue('2026-07-02')

    await store().goToPreviousPeriod()

    expect(store().periodKey).toBe('2026-07-02')
  })

  // 화살표가 사는지를 그리는 목록으로 판정하므로 갈 곳도 같은 목록으로 고른다. 추적 목록으로 고르면 관리에서 뺀
  // 캐릭터의 기록만 있는 기간을 건너뛴다.
  it('갈 곳은 추적 목록이 아니라 기록을 남긴 캐릭터까지 넣은 목록으로 고른다', async () => {
    seedPeriod('weekly', WEEK)
    getRecordedCharacterOcidsMock.mockResolvedValue(['ocid-해제'])

    await store().goToPreviousPeriod()

    expect(findAdjacentMock).toHaveBeenCalledWith(['ocid-1', 'ocid-해제'], 'weekly', WEEK, 'prev')
  })

  it('찾는 사이에 다른 이동이 들어오면 그 답은 버린다', async () => {
    seedPeriod('weekly', WEEK)
    let release!: (periodKey: string) => void
    findAdjacentMock.mockReturnValue(new Promise<string>((resolve) => { release = resolve }))

    const moving = store().goToPreviousPeriod()
    store().setTab('monthly')
    release(PREVIOUS_WEEK)
    await moving

    expect(store()).toMatchObject({ tab: 'monthly', periodKey: MONTH })
  })

  it('연타해도 한 칸만 간다', async () => {
    seedPeriod('weekly', WEEK)

    await Promise.all([store().goToPreviousPeriod(), store().goToPreviousPeriod(), store().goToPreviousPeriod()])

    expect(store().periodKey).toBe(PREVIOUS_WEEK)
  })
})

describe('goToNextPeriod', () => {
  it('이미 지금 기간이면 아무것도 안 부른다', async () => {
    await store().goToNextPeriod()

    expect(store().periodKey).toBe(WEEK)
    expect(findAdjacentMock).not.toHaveBeenCalled()
  })

  it('앞에 기록이 있는 가장 가까운 기간으로 가고, 없으면 지금 기간으로 온다', async () => {
    useBossProfitStore.setState({ periodKey: '2026-08-20' })
    findAdjacentMock.mockResolvedValueOnce(PREVIOUS_WEEK).mockResolvedValueOnce(null)

    await store().goToNextPeriod()
    expect(store().periodKey).toBe(PREVIOUS_WEEK)

    await store().goToNextPeriod()
    expect(store().periodKey).toBe(WEEK)
  })

  it('연타해도 지금 기간을 안 넘는다', async () => {
    useBossProfitStore.setState({ periodKey: PREVIOUS_WEEK })

    await Promise.all([store().goToNextPeriod(), store().goToNextPeriod(), store().goToNextPeriod()])

    expect(store().periodKey).toBe(WEEK)
  })
})

describe('loadPartyPlans', () => {
  const 설정 = {
    ocid: 'ocid-1',
    bossKey: 'zakum',
    difficulty: 'chaos',
    partySize: 3,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    splitFeeAuto: false,
    updatedAt: '2026-09-10T00:00:00.000Z',
  }

  it('파티 관리 설정이 지금 주차와 지금 달에 함께 실린다', async () => {
    getBossPartySettingsMock.mockResolvedValue([설정])

    await store().loadPartyPlans(['ocid-1'], PINNED_NOW)

    expect(getBossPartyPeriodOverridesMock).toHaveBeenCalledWith(['ocid-1'], [WEEK, MONTH])
    expect(store().partyPlans[partyPlanKey('ocid-1', 'zakum', 'chaos', WEEK)]?.partySize).toBe(3)
    expect(store().partyPlans[partyPlanKey('ocid-1', 'zakum', 'chaos', MONTH)]?.partySize).toBe(3)
  })

  it('그 기간에 갈라진 값이 설정을 이긴다', async () => {
    getBossPartySettingsMock.mockResolvedValue([설정])
    getBossPartyPeriodOverridesMock.mockResolvedValue([{ ...설정, periodKey: WEEK, partySize: 2, updatedAt: '2026-09-12T00:00:00.000Z' }])

    await store().loadPartyPlans(['ocid-1'], PINNED_NOW)

    expect(store().partyPlans[partyPlanKey('ocid-1', 'zakum', 'chaos', WEEK)]?.partySize).toBe(2)
  })

  it('추적 캐릭터가 없으면 조회하지 않고 표를 비운다', async () => {
    useBossProfitStore.setState({ partyPlans: { stale: { partySize: 9, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, splitFeeAuto: false } } })

    await store().loadPartyPlans([], PINNED_NOW)

    expect(getBossPartySettingsMock).not.toHaveBeenCalled()
    expect(store().partyPlans).toEqual({})
  })
})

describe('setRowParty', () => {
  it.each([0, 7, 1.5])('범위 밖 인원 %p 은 던지고 아무것도 안 쓴다', async (partySize) => {
    const target = row()
    seedPeriod('weekly', WEEK, { rows: [target] })

    await expect(store().setRowParty(target, { partySize, shares: EVEN_SHARES })).rejects.toThrow()

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    expect(setBossPartyPeriodOverrideMock).not.toHaveBeenCalled()
  })

  // 인원만 고치는 upsert 가 출처를 지우면 직접 적은 완료의 표식이 편집 한 번에 사라진다.
  it('완료 행은 그 기록 한 건을 다시 세어 쓰고 출처를 지킨다', async () => {
    const target = row({ source: 'manual' })
    seedPeriod('weekly', WEEK, { rows: [target] })

    await store().setRowParty(target, { partySize: 2, shares: EVEN_SHARES })

    expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ocid: 'ocid-1',
        bossKey: 'zakum',
        difficulty: 'chaos',
        periodKey: WEEK,
        partySize: 2,
        priceMeso: 8_080_000,
        payoutMeso: 4_040_000,
        crystalMyShare: null,
        crystalSharesTotal: null,
        splitFeePercent: null,
        source: 'manual',
      }),
    )
  })

  it('비율을 넘기면 수수료를 역산한 몫을 적고 비율을 그 건에 남긴다', async () => {
    const target = row()
    seedPeriod('weekly', WEEK, { rows: [target] })

    await store().setRowParty(target, { partySize: 2, shares: { myShare: 2, sharesTotal: 3, splitFeePercent: 3 } })

    expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
      // 균등이면 4,040,000 인데 2:1 이라 그보다 많고 수수료만큼 깎인다.
      expect.objectContaining({ partySize: 2, payoutMeso: 5_359_461, crystalMyShare: 2, crystalSharesTotal: 3, splitFeePercent: 3 }),
    )
  })

  // 기록 표에 쓰면 그 조합이 완료로 읽혀 잡지도 않은 보스가 완료로 선다.
  it('미완료 행은 기록을 쓰지 않고 그 기간만의 값으로 적어 파티 계획에 바로 세운다', async () => {
    const target = row({ isComplete: false, partySize: null, payoutMeso: 0 })
    seedPeriod('weekly', WEEK, { rows: [target] })

    await store().setRowParty(target, { partySize: 2, shares: { myShare: 2, sharesTotal: 3, splitFeePercent: 5, splitFeeAuto: true } })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    expect(setBossPartyPeriodOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ocid: 'ocid-1',
        bossKey: 'zakum',
        difficulty: 'chaos',
        periodKey: WEEK,
        partySize: 2,
        crystalMyShare: 2,
        crystalSharesTotal: 3,
        splitFeePercent: 5,
        splitFeeAuto: true,
      }),
    )
    expect(store().partyPlans[partyPlanKey('ocid-1', 'zakum', 'chaos', WEEK)]).toMatchObject({ partySize: 2, splitFeeAuto: true })
  })

  it('가격을 모르는 완료 행은 기록을 안 쓴다', async () => {
    const target = row({ priceMeso: null, payoutMeso: null })
    seedPeriod('weekly', WEEK, { rows: [target] })

    await store().setRowParty(target, { partySize: 3, shares: EVEN_SHARES })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
  })

  it('지난 기간의 행에도 쓴다', async () => {
    const target = row({ periodKey: PREVIOUS_WEEK, partySize: 2, payoutMeso: 4_040_000 })
    useBossProfitStore.setState({ periodKey: PREVIOUS_WEEK })
    seedPeriod('weekly', PREVIOUS_WEEK, { rows: [target] })

    await store().setRowParty(target, { partySize: 3, shares: EVEN_SHARES })

    expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(expect.objectContaining({ periodKey: PREVIOUS_WEEK, partySize: 3, payoutMeso: 2_693_333 }))
  })

  it('보는 기간에 없는 행이면 던지고 아무것도 안 쓴다', async () => {
    seedPeriod('weekly', WEEK, { rows: [row()] })

    await expect(store().setRowParty(row({ difficulty: 'hard' }), { partySize: 2, shares: EVEN_SHARES })).rejects.toThrow('존재하지 않는 보스 행')

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
  })
})

describe('saveManualCompletion', () => {
  function save(target: BossProfitRow, dateKey: string, difficulty: BossProfitRow['difficulty'] = 'extreme') {
    return store().saveManualCompletion(target, { difficulty, dateKey, partySize: 1, shares: EVEN_SHARES })
  }

  // 월간 보스는 잡은 주에 서므로 날짜를 옮기면 그 행이 다른 주로 간다. 보던 주에 두면 방금 적은 것이 사라진다.
  it('적은 날짜의 주로 데려가고, 기록은 직접 적은 출처와 그 날짜로 쓴다', async () => {
    const target = monthlyPlaceholder()
    seedPeriod('weekly', WEEK, { rows: [target] })

    await save(target, '2026-09-02')

    expect(store().periodKey).toBe('2026-08-27')
    expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ bossKey: 'black_mage', difficulty: 'extreme', periodKey: MONTH, partySize: 1, source: 'manual' }),
    )
    expect(setBossProfitDefeatedOnMock).toHaveBeenCalledWith(
      { ocid: 'ocid-1', bossKey: 'black_mage', difficulty: 'extreme', periodKey: MONTH },
      '2026-09-02',
    )
  })

  it('보던 주에 잡았다고 적으면 기간을 안 떠나고, 월간 탭에서는 날짜가 달라도 안 옮긴다', async () => {
    const target = monthlyPlaceholder()
    seedPeriod('weekly', WEEK, { rows: [target] })
    await save(target, '2026-09-11')
    expect(store().periodKey).toBe(WEEK)

    useBossProfitStore.setState({ tab: 'monthly', periodKey: MONTH })
    seedPeriod('monthly', MONTH, { rows: [target] })
    await save(target, '2026-09-02')
    expect(store()).toMatchObject({ tab: 'monthly', periodKey: MONTH })
  })

  // 난이도를 바꾸면 기록 키가 바뀐다. 옛 줄을 안 지우면 같은 처치가 두 줄이 된다.
  it('직접 적은 행의 난이도를 바꾸면 옛 난이도의 줄을 지우고, 동기화가 만든 행이면 지우지 않는다', async () => {
    const manual = monthlyPlaceholder({ difficulty: 'hard', isComplete: true, partySize: 1, payoutMeso: 665_000_000, source: 'manual' })
    seedPeriod('weekly', WEEK, { rows: [manual] })
    await save(manual, '2026-09-11', 'extreme')
    expect(deleteBossProfitRecordMock).toHaveBeenCalledWith({ ocid: 'ocid-1', bossKey: 'black_mage', difficulty: 'hard', periodKey: MONTH })

    deleteBossProfitRecordMock.mockClear()
    const auto = monthlyPlaceholder({ difficulty: 'hard' })
    seedPeriod('weekly', WEEK, { rows: [auto] })
    await save(auto, '2026-09-11', 'extreme')
    expect(deleteBossProfitRecordMock).not.toHaveBeenCalled()
  })

  // 화면은 여기서 안 건드린다. 쓴 기록이 표의 판을 올리면 그 표를 읽는 기간 쿼리가 전부 무효화되어 월간 탭에도 선다.
  it('쓰고 나면 보스 기록의 판이 올라 주간 · 월간 기간 쿼리가 무효화된다', async () => {
    const stop = startRecordInvalidation(queryClient)
    const notifyRecordsRevision = subscribeRecordsMock.mock.calls.at(-1)?.[0] as () => void
    upsertBossProfitRecordMock.mockImplementation(async () => notifyRecordsRevision())
    const target = monthlyPlaceholder()
    seedPeriod('weekly', WEEK, { rows: [target] })
    seedPeriod('monthly', MONTH, { rows: [target] })

    try {
      await save(target, '2026-09-11')
    } finally {
      stop()
    }

    expect(queryClient.getQueryState(queryKeys.bossProfitPeriod('weekly', WEEK))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(queryKeys.bossProfitPeriod('monthly', MONTH))?.isInvalidated).toBe(true)
  })
})

describe('cancelManualCompletion', () => {
  it('그 기록의 드롭을 비운 뒤 기록을 지운다', async () => {
    const target = monthlyPlaceholder({ isComplete: true, partySize: 1, payoutMeso: 8_740_000_000, source: 'manual' })
    seedPeriod('weekly', WEEK, { rows: [target] })

    await store().cancelManualCompletion(target)

    expect(replaceBossDropRecordsMock).toHaveBeenCalledWith('ocid-1', 'black_mage', 'extreme', MONTH, [], expect.any(String), { name: null, key: null })
    expect(deleteBossProfitRecordMock).toHaveBeenCalledWith({ ocid: 'ocid-1', bossKey: 'black_mage', difficulty: 'extreme', periodKey: MONTH })
    expect(replaceBossDropRecordsMock.mock.invocationCallOrder[0]).toBeLessThan(deleteBossProfitRecordMock.mock.invocationCallOrder[0])
  })
})

describe('setBossDrops', () => {
  const target = row({ bossKey: 'lotus', bossName: '스우', difficulty: 'hard' })
  const key = `ocid-1|lotus|hard|${WEEK}`

  it('그 보스 · 기간의 드롭을 통째로 바꿔 쓴다', async () => {
    seedPeriod('weekly', WEEK, { rows: [target] })
    const drops = [drop({ itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크' })]

    await store().setBossDrops(target, drops)

    expect(replaceBossDropRecordsMock).toHaveBeenCalledWith('ocid-1', 'lotus', 'hard', WEEK, drops, expect.any(String), { name: null, key: null })
  })

  // 시트에서 기록한 드롭은 식별자가 없다. INSERT 에서 처음 생기므로 저장소가 돌려준 값으로 보낸다. 가격을 안 적은 드롭도
  // 보낸다. 서버가 pending 으로 든다.
  it('저장한 드롭 전부를 저장소가 돌려준 식별자로 서버에 보낸다', async () => {
    seedPeriod('weekly', WEEK, { rows: [target] })
    replaceBossDropRecordsMock.mockResolvedValue(['id-0', 'id-1'])

    await store().setBossDrops(target, [
      drop({ itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크', priceState: 'entered', priceMeso: 1_200_000_000 }),
      drop(),
    ])

    expect(reportDropPriceMock.mock.calls.map((call) => call[0])).toEqual(['id-0', 'id-1'])
    expect(reportDropRemovedMock).not.toHaveBeenCalled()
  })

  it('저장에서 빠진 드롭은 지우기를 보낸다. 기기에서 기록이 사라진 것이다', async () => {
    const kept = drop({ dropRecordId: 'old-a', itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크' })
    const removed = drop({ dropRecordId: 'old-b', priceState: 'entered', priceMeso: 5 })
    seedPeriod('weekly', WEEK, { rows: [target], dropsByRowKey: { [key]: [kept, removed] } })
    replaceBossDropRecordsMock.mockResolvedValue(['old-a'])

    await store().setBossDrops(target, [kept])

    expect(reportDropPriceMock).toHaveBeenCalledTimes(1)
    expect(reportDropPriceMock).toHaveBeenCalledWith('old-a', expect.any(Date))
    expect(reportDropRemovedMock).toHaveBeenCalledTimes(1)
    expect(reportDropRemovedMock).toHaveBeenCalledWith('old-b', expect.any(Date))
  })

  it('기록 안함도 보낸다. 서버의 그 줄이 skipped 가 된다', async () => {
    seedPeriod('weekly', WEEK, { rows: [target] })
    replaceBossDropRecordsMock.mockResolvedValue(['id-0'])

    await store().setBossDrops(target, [drop({ priceState: 'excluded' })])

    expect(reportDropPriceMock).toHaveBeenCalledWith('id-0', expect.any(Date))
  })

  // 리뷰 요청은 기록한 저장만 센다. 드롭을 전부 뺀 저장은 지우기다.
  it('드롭이 있는 저장은 리뷰 요청의 저장 횟수로 세고, 전부 뺀 저장은 세지 않는다', async () => {
    seedPeriod('weekly', WEEK, { rows: [target] })
    replaceBossDropRecordsMock.mockResolvedValue(['id-0'])

    await store().setBossDrops(target, [drop()])
    expect(countCoreSaveMock).toHaveBeenCalledTimes(1)

    replaceBossDropRecordsMock.mockResolvedValue([])
    await store().setBossDrops(target, [])
    expect(countCoreSaveMock).toHaveBeenCalledTimes(1)
  })

  it('보는 기간에 없는 행이면 던지고 저장소를 안 건드린다', async () => {
    seedPeriod('weekly', WEEK, { rows: [] })

    await expect(store().setBossDrops(target, [])).rejects.toThrow('존재하지 않는 보스 행')

    expect(replaceBossDropRecordsMock).not.toHaveBeenCalled()
  })
})
