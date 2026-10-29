// 가계부의 오케스트레이션.
import type { IncomeDraft, SpendDraft } from '../records'
import type { EnhancementTotal } from '../../../storage/enhancement-totals'


jest.mock('../../../storage/income', () => ({
  insertIncomeRecord: jest.fn(),
  insertIncomeRecords: jest.fn(),
  updateIncomeRecord: jest.fn(),
  deleteIncomeRecord: jest.fn(),
  getIncomeRecordsBetween: jest.fn(),
  getIncomeMonthRows: jest.fn(),
  getFragmentStorage: jest.fn(),
  getIncomeRecordsRevision: jest.fn(),
}))
jest.mock('../../../storage/spend', () => ({
  insertSpendRecord: jest.fn(),
  updateSpendRecord: jest.fn(),
  deleteSpendRecord: jest.fn(),
  getSpendRecordsBetween: jest.fn(),
  getSpendMonthRows: jest.fn(),
}))
jest.mock('../../../storage/last-point-rate', () => ({ setLastPointRate: jest.fn() }))
jest.mock('../../../storage/api-key', () => ({
  getAuthConfig: jest.fn(async () => ({ login: { type: 'login', id: 'account-main', session: 's' }, apiKeys: [] })),
}))
jest.mock('../../../storage/last-hunts', () => ({
  setLastHunt: jest.fn(),
  getLastHunts: jest.fn(),
}))
jest.mock('../../../storage/boss-profit', () => ({
  getDatedBossProfitRecords: jest.fn(),
  getBossProfitRecordsRevision: jest.fn(),
  getRecordedCharacterOcids: jest.fn(),
  getBossProfitMonthRows: jest.fn(),
}))
jest.mock('../../../storage/boss-drops', () => ({
  // 실물과 같은 값이어야 호출 단언이 맞는다. 목이 안 내주면 `undefined` 가 흐른다.
  NO_WORLD: { name: null, key: null },
  getBossDropRecords: jest.fn(),
  getBossDropRecordsRevision: jest.fn(),
}))
jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
jest.mock('../../../storage/character-basic-cache', () => ({ getCachedCharacterBasic: jest.fn() }))
jest.mock('../../character-profile/resolve', () => ({ resolveDisplayProfiles: jest.fn() }))
jest.mock('../../../storage/enhancement-totals', () => ({ loadEnhancementTotals: jest.fn() }))
jest.mock('../../enhancement-history/legacy-totals', () => ({ ensureEnhancementTotals: jest.fn() }))
jest.mock('../../../storage/mvp-grades', () => ({ getMvpGradeHistories: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ getCharacterAccountSightings: jest.fn() }))
jest.mock('../../../lib/mvp/starforce', () => ({ starforceMvpDiscountResolver: jest.fn() }))
jest.mock('../../app-review/request', () => ({ countCoreSave: jest.fn() }))

const income = jest.requireMock('../../../storage/income') as Record<string, jest.Mock>
const spend = jest.requireMock('../../../storage/spend') as Record<string, jest.Mock>
const rate = jest.requireMock('../../../storage/last-point-rate') as Record<string, jest.Mock>
const lastHunts = jest.requireMock('../../../storage/last-hunts') as Record<string, jest.Mock>
const bossProfit = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
const bossDrops = jest.requireMock('../../../storage/boss-drops') as Record<string, jest.Mock>
const selection = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>
const basicCache = jest.requireMock('../../../storage/character-basic-cache') as Record<string, jest.Mock>
const profileLookup = jest.requireMock('../../character-profile/resolve') as Record<string, jest.Mock>
const enhancementTotals = jest.requireMock('../../../storage/enhancement-totals') as Record<string, jest.Mock>
const appReview = jest.requireMock('../../app-review/request') as Record<string, jest.Mock>
const legacyTotals = jest.requireMock('../../enhancement-history/legacy-totals') as Record<string, jest.Mock>
const mvpGrades = jest.requireMock('../../../storage/mvp-grades') as Record<string, jest.Mock>
const characterAccounts = jest.requireMock('../../../storage/character-accounts') as Record<string, jest.Mock>
const mvp = jest.requireMock('../../../lib/mvp/starforce') as Record<string, jest.Mock>

const 지금 = new Date('2026-08-23T05:00:00.000Z')

beforeEach(() => {
  jest.clearAllMocks()
  income.getIncomeRecordsBetween.mockResolvedValue([])
  spend.getSpendRecordsBetween.mockResolvedValue([])
  bossProfit.getDatedBossProfitRecords.mockResolvedValue([])
  bossProfit.getBossProfitRecordsRevision.mockReturnValue(0)
  bossDrops.getBossDropRecords.mockResolvedValue([])
  bossDrops.getBossDropRecordsRevision.mockReturnValue(0)
  income.getIncomeRecordsRevision.mockReturnValue(0)
  selection.getTrackedCharacterOcids.mockResolvedValue(['ocid-1'])
  bossProfit.getRecordedCharacterOcids.mockResolvedValue([])
  basicCache.getCachedCharacterBasic.mockResolvedValue({ profile: { name: '루디' } })
  enhancementTotals.loadEnhancementTotals.mockResolvedValue([])
  legacyTotals.ensureEnhancementTotals.mockResolvedValue(undefined)
  mvpGrades.getMvpGradeHistories.mockResolvedValue(new Map())
  characterAccounts.getCharacterAccountSightings.mockResolvedValue([])
  mvp.starforceMvpDiscountResolver.mockReturnValue(() => 0)
  lastHunts.getLastHunts.mockResolvedValue({})
  income.getIncomeMonthRows.mockResolvedValue([])
  spend.getSpendMonthRows.mockResolvedValue([])
  bossProfit.getBossProfitMonthRows.mockResolvedValue([])
  profileLookup.resolveDisplayProfiles.mockImplementation(
    async (ocids: readonly string[]) =>
      new Map(
        [...new Set(ocids)].map((ocid) => [
          ocid,
          { name: '루디', imageUrl: 'https://img/1.png', world: null, level: 285 },
        ]),
      ),
  )
})

const 수입: IncomeDraft = {
  ocid: null,
  hunt: null,
  quantity: null,
  earnedOn: '2026-08-23',
  category: 'hunting',
  item: '밤의 길 3',
  itemKey: 'tallahart_road_of_night_3',
  mesoAmount: 1_200_000_000,
  // 사냥에는 경매장이 없다. 수수료 칸 둘은 언제나 `null` 이다.
  saleFeePercent: null,
  saleFeeMeso: null,
  saleFeeAuto: false,
  pointAmount: null,
  pointPer100mMeso: null,
  cashAmount: null,
  itemKind: null,
}

const 메포지출: SpendDraft = {
  ocid: null,
  spentOn: '2026-08-23',
  category: 'content',
  item: '하이마운틴 솔 2단계',
  itemKey: null,
  formItemKeys: { sol_erda: 'high_mountain_2' },
  itemKind: null,
  levelFrom: null,
  levelTo: null,
  quantity: 1,
  mesoAmount: null,
  tariffMeso: null,
  pointAmount: 30_000,
  pointPer100mMeso: 1_180,
  cashAmount: null,
}

/**
 * 칸 금액. **달 읽기 하나를 접어서** 낸다.
 *
 * 전에는 `loadCalendarAmounts` 라는 조회가 따로 있었다. 그날 목록과 같은 네 원천을 같은 범위로
 * 읽고 합계만 남기고 행을 버려서, 두 경로가 같은 수를 낸다 를 테스트가 지켜야 했다.
 */
async function 칸금액(from: string, to: string) {
  const { amountsOfDays, loadMonthDays } = require('../records') as typeof import('../records')
  return amountsOfDays(await loadMonthDays(from, to))
}

describe('행의 신원은 여기서 만든다', () => {
  it('저장 시각을 박는다', async () => {
    const { recordIncome } = require('../records') as typeof import('../records')

    await recordIncome(수입, 지금)

    expect(income.insertIncomeRecord.mock.calls[0][0]).toMatchObject({
      recordedAt: '2026-08-23T05:00:00.000Z',
    })
  })

  // 캐릭터 없는 기록이 속할 계정이다. 계정을 고르는 화면이 생기기 전까지는 메인 계정이다.
  it('메인 넥슨 계정 id 를 함께 넘긴다', async () => {
    const { recordIncome } = require('../records') as typeof import('../records')

    await recordIncome(수입, 지금)

    expect(income.insertIncomeRecord.mock.calls[0][1]).toBe('account-main')
  })

  // 손입력은 **같은 날 같은 것을 두 번** 이 정상이라 자연키가 없다.
  it('같은 것을 두 번 넣어도 서로 다른 행이다', async () => {
    const { recordIncome } = require('../records') as typeof import('../records')

    await recordIncome(수입, 지금)
    await recordIncome(수입, 지금)

    const [first, second] = income.insertIncomeRecord.mock.calls.map((call) => call[0].id)
    expect(first).not.toBe(second)
  })
})

// 사냥 전리품 판매는 한 번에 여러 아이템을 적고 아이템마다 한 줄이다.
describe('recordIncomes', () => {
  it('한 번에 넣고 줄마다 다른 id 와 같은 저장 시각을 박으며, 리뷰 요청은 한 번만 센다', async () => {
    const { recordIncomes } = require('../records') as typeof import('../records')

    await recordIncomes([수입, { ...수입, mesoAmount: 1 }], 지금)

    expect(income.insertIncomeRecords).toHaveBeenCalledTimes(1)
    const [records, accountId] = income.insertIncomeRecords.mock.calls[0]
    expect(records.map((record: { recordedAt: string }) => record.recordedAt)).toEqual([
      '2026-08-23T05:00:00.000Z',
      '2026-08-23T05:00:00.000Z',
    ])
    expect(records[0].id).not.toBe(records[1].id)
    expect(accountId).toBe('account-main')
    expect(appReview.countCoreSave).toHaveBeenCalledTimes(1)
  })
})

// 리뷰 요청은 저장이 성공한 기록만 센다. 실패한 저장을 세면 기록이 없는 사람에게 묻는다.
describe('리뷰 요청의 저장 횟수', () => {
  it('수입 · 지출 저장이 성공하면 한 번씩 센다', async () => {
    const { recordIncome, recordSpend } = require('../records') as typeof import('../records')

    await recordIncome(수입, 지금)
    await recordSpend(메포지출, 지금)

    expect(appReview.countCoreSave).toHaveBeenCalledTimes(2)
  })

  it('저장이 실패하면 세지 않는다', async () => {
    spend.insertSpendRecord.mockRejectedValueOnce(new Error('저장'))
    const { recordSpend } = require('../records') as typeof import('../records')

    await expect(recordSpend(메포지출, 지금)).rejects.toThrow()

    expect(appReview.countCoreSave).not.toHaveBeenCalled()
  })
})

describe('시세를 기억한다', () => {
  it('메포 지출을 저장하면 그 시세가 다음 기본값이 된다', async () => {
    const { recordSpend } = require('../records') as typeof import('../records')

    await recordSpend(메포지출, 지금)

    expect(rate.setLastPointRate).toHaveBeenCalledWith(1_180)
  })

  it('메소 지출은 시세를 안 건드린다. 물어본 적이 없다', async () => {
    const { recordSpend } = require('../records') as typeof import('../records')

    await recordSpend({ ...메포지출, pointAmount: null, pointPer100mMeso: null }, 지금)

    expect(rate.setLastPointRate).not.toHaveBeenCalled()
  })

  // 던진 입력의 시세를 다음 기본값으로 남기면 안 된다.
  it('저장이 실패하면 기억하지 않는다', async () => {
    spend.insertSpendRecord.mockRejectedValue(new Error('시세'))
    const { recordSpend } = require('../records') as typeof import('../records')

    await expect(recordSpend(메포지출, 지금)).rejects.toThrow()

    expect(rate.setLastPointRate).not.toHaveBeenCalled()
  })
})

/**
 * 사냥은 같은 자리를 반복해서 적는다. 계산기로 새 기록을 저장하면 그 캐릭터 몫으로 사냥터와 켠
 * 아이템을 남기고, 캐릭터를 고를 때 그 값이 선다. 시세를 기억하는 것과 같이 저장이 성공한 뒤에만 남긴다.
 */
describe('캐릭터별 마지막 사냥을 기억한다', () => {
  // 앞 케이스가 저장을 던지게 해 두었고 `clearAllMocks` 는 구현을 안 지운다.
  beforeEach(() => {
    income.insertIncomeRecord.mockResolvedValue(undefined)
  })

  const 계산기사냥: IncomeDraft = {
    ...수입,
    ocid: 'ocid-1',
    hunt: {
      mode: 'calculator',
      characterLevel: 294,
      missedMobs: 0,
      boosts: ['union', 'potion'],
      sojae: 2,
      fragments: 35,
      fragmentPrice: null,
      mesoRate: 149,
      unionTier: 2,
    },
  }

  it('계산기로 적은 사냥은 그 캐릭터 몫으로 사냥터 · 켠 아이템 · 유니온의 부 단계를 남긴다', async () => {
    const { recordIncome } = require('../records') as typeof import('../records')

    await recordIncome(계산기사냥, 지금)

    expect(lastHunts.setLastHunt).toHaveBeenCalledWith('ocid-1', {
      groundKey: 'tallahart_road_of_night_3',
      boosts: ['union', 'potion'],
      unionTier: 2,
    })
  })

  // 수동 폼에는 사냥터 · 아이템 줄이 없다. 거기서 빈 값을 적으면 계산기에서 켜 두던 것이 지워진다.
  it('수동으로 적은 사냥은 기억을 안 건드린다', async () => {
    const { recordIncome } = require('../records') as typeof import('../records')

    await recordIncome(
      {
        ...수입,
        ocid: 'ocid-1',
        item: null,
        itemKey: null,
        hunt: { mode: 'manual', typedMeso: 41_760_000, fragments: 0, fragmentPrice: null },
      },
      지금,
    )

    expect(lastHunts.setLastHunt).not.toHaveBeenCalled()
  })

  // 캐릭터 없는 몫은 없다. 사냥 기록은 캐릭터를 골라야 저장된다.
  it('캐릭터가 없는 행 · 계산 입력이 없는 옛 행 · 다른 갈래는 안 남긴다', async () => {
    const { recordIncome } = require('../records') as typeof import('../records')

    await recordIncome({ ...계산기사냥, ocid: null }, 지금)
    await recordIncome({ ...수입, ocid: 'ocid-1' }, 지금)
    await recordIncome({ ...계산기사냥, category: 'item_sale' }, 지금)

    expect(lastHunts.setLastHunt).not.toHaveBeenCalled()
  })

  // 던진 입력의 사냥을 다음 기본값으로 남기면 적지도 않은 사냥이 다음에 선다.
  it('저장이 실패하면 기억하지 않는다', async () => {
    income.insertIncomeRecord.mockRejectedValue(new Error('사냥'))
    const { recordIncome } = require('../records') as typeof import('../records')

    await expect(recordIncome(계산기사냥, 지금)).rejects.toThrow()

    expect(lastHunts.setLastHunt).not.toHaveBeenCalled()
  })

  // 화면이 저장 뒤에 드는 기억도 같은 규칙이다.
  it('nextLastHunts 는 그 캐릭터 몫만 바꾸고, 남기지 않는 행이면 그대로 둔다', () => {
    const { nextLastHunts } = require('../records') as typeof import('../records')
    const 지금기억 = { 'ocid-2': { groundKey: 'arteria_west', boosts: [], unionTier: 3 as const } }

    expect(nextLastHunts(계산기사냥, 지금기억)).toEqual({
      'ocid-2': { groundKey: 'arteria_west', boosts: [], unionTier: 3 },
      'ocid-1': { groundKey: 'tallahart_road_of_night_3', boosts: ['union', 'potion'], unionTier: 2 },
    })
    expect(nextLastHunts({ ...계산기사냥, ocid: null }, 지금기억)).toBe(지금기억)
  })
})

describe('spendMesoOf: 메소 축으로 접는다', () => {
  const { spendMesoOf } = require('../records') as typeof import('../records')

  // 환산만 보는 줄이라 주화를 안 받는 행이다. 주화는 아래 describe 가 따로 본다.
  const 행 = { ...메포지출, id: 'x', recordedAt: '', formItemKeys: null }

  it('메포는 시세로 환산해 더한다', () => {
    expect(spendMesoOf(행)).toBe(2_542_372_881)
  })

  it('둘 다 쓴 행은 합친다. 아이템 구매의 모양이다', () => {
    expect(spendMesoOf({ ...행, mesoAmount: 935_000_000 })).toBe(935_000_000 + 2_542_372_881)
  })

  // **캐시는 안 든다**. 환산 자체를 안 하므로 칸의 숫자가 그날 지출의
  // 전부가 아니다. 그 사실은 고른 날의 상세가 따로 말한다.
  it('캐시는 메소 축에 안 들어온다', () => {
    expect(spendMesoOf({ ...행, pointAmount: null, pointPer100mMeso: null, cashAmount: 6_900 }))
      .toBe(0)
  })
})

/**
 * 에픽던전 추가 리워드는 세라자르 주화를 주고 그 판매가가 지출에서 빠진다(사용자 제공 2026-09-16).
 *
 * **읽을 때 센다.** 저장 칸이 없어 지난 기록도 다음 읽기부터 뺀 값으로 선다.
 */
describe('spendMesoOf: 세라자르 주화를 뺀다', () => {
  const { spendMesoOf } = require('../records') as typeof import('../records')

  const 행 = { ...메포지출, id: 'x', recordedAt: '' }

  // 솔 에르다 2단계 하나라 주화 8개다. 8 × 40,000,000 = 320,000,000.
  it('고른 단계의 주화 판매가만큼 뺀다', () => {
    expect(spendMesoOf(행)).toBe(2_542_372_881 - 320_000_000)
  })

  // 형태마다 각각 주므로 둘을 다 사면 4 + 8 = 12개다.
  it('형태 둘을 사면 두 형태의 주화를 다 뺀다', () => {
    const 둘 = {
      ...행,
      formItemKeys: { exp: 'high_mountain_1', sol_erda: 'high_mountain_2' },
      pointAmount: 37_500,
    }

    expect(spendMesoOf(둘)).toBe(3_177_966_101 - 480_000_000)
  })

  // 0 에서 멈추면 그 줄과 하루 합계가 조용히 달라진다(사용자 결정).
  it('뺀 값이 음수면 음수 그대로다', () => {
    const 비싼시세 = {
      ...행,
      formItemKeys: { exp: 'high_mountain_1' },
      pointAmount: 7_500,
      pointPer100mMeso: 10_000,
    }

    expect(spendMesoOf(비싼시세)).toBe(75_000_000 - 160_000_000)
  })

  // 무엇을 샀는지 모르는 행이라 셀 주화가 없다.
  it('형태별 항목 key 가 없는 옛 행은 안 뺀다', () => {
    expect(spendMesoOf({ ...행, formItemKeys: null })).toBe(2_542_372_881)
  })

  // 메포를 메소로 환산하지 않는 행이라 뺄 값을 얹을 축이 없다.
  it('시세를 모르는 행은 안 뺀다', () => {
    expect(spendMesoOf({ ...행, mesoAmount: 500_000, pointAmount: null, pointPer100mMeso: null }))
      .toBe(500_000)
  })

  // 주화를 안 주는 갈래는 그대로다. 되짚어도 개수가 0 이다.
  it('에픽던전이 아닌 행은 그대로다', () => {
    expect(spendMesoOf({ ...행, category: 'etc', formItemKeys: null })).toBe(2_542_372_881)
  })
})

describe('칸 금액', () => {
  it('두 원천을 날짜별로 접는다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([
      { ...수입, id: 'a', recordedAt: '' },
      { ...수입, id: 'b', recordedAt: '', mesoAmount: 543_000_000 },
    ])
    spend.getSpendRecordsBetween.mockResolvedValue([{ ...메포지출, id: 'c', recordedAt: '' }])

    const amounts = await 칸금액('2026-08-01', '2026-08-31')

    expect(amounts['2026-08-23']).toEqual({
      incomeMeso: 1_743_000_000,
      // 메포 환산에서 주화 8개(320,000,000)가 빠진 값이다.
      expenseMeso: 2_542_372_881 - 320_000_000,
    })
  })

  it('기록이 없는 날은 아예 없다. 0 을 채워 넣지 않는다', async () => {

    expect(await 칸금액('2026-08-01', '2026-08-31')).toEqual({})
  })

  it('범위를 두 어댑터에 그대로 넘긴다', async () => {

    await 칸금액('2026-08-20', '2026-08-26')

    expect(income.getIncomeRecordsBetween).toHaveBeenCalledWith('2026-08-20', '2026-08-26')
    expect(spend.getSpendRecordsBetween).toHaveBeenCalledWith('2026-08-20', '2026-08-26')
  })
})


// 적은 것은 되돌릴 수 있어야 한다
const 수입행 = {
  hunt: null,
  quantity: null,
  id: 'inc-1',
  ocid: null,
  earnedOn: '2026-08-25',
  category: 'hunting' as const,
  item: '엘리시움',
  itemKey: null,
  mesoAmount: 1_200_000_000,
  saleFeePercent: null,
  saleFeeMeso: null,
  saleFeeAuto: false,
  itemKind: null,
  pointAmount: null,
  pointPer100mMeso: null,
  cashAmount: null,
  recordedAt: '2026-08-25T01:00:00.000Z',
}

const 지출행 = {
  id: 'spd-1',
  ocid: null,
  spentOn: '2026-08-25',
  category: 'content' as const,
  item: '몬스터 파크',
  itemKey: 'monster_park',
  formItemKeys: null,
  itemKind: null,
  levelFrom: null,
  levelTo: null,
  quantity: 2,
  mesoAmount: null,
  tariffMeso: null,
  pointAmount: 1_200,
  pointPer100mMeso: 1_180,
  cashAmount: null,
  recordedAt: '2026-08-25T02:00:00.000Z',
}

/** 하루 목록 카드의 첫 줄 · 둘째 줄. */
function titleOf(entry: import('../records').DayRecord): string {
  return (require('../records') as typeof import('../records')).recordCardOf(entry).title
}
function detailOf(entry: import('../records').DayRecord): string | null {
  return (require('../records') as typeof import('../records')).recordCardOf(entry).detail
}

describe('loadDayRecords: 그날 적은 것을 한 줄씩', () => {
  it('수입과 지출을 한 목록으로 접는다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([수입행])
    spend.getSpendRecordsBetween.mockResolvedValue([지출행])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-25')

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.kind)).toEqual(['income', 'spend'])
    // **하루만** 읽는다. 두 끝이 같다.
    expect(income.getIncomeRecordsBetween).toHaveBeenCalledWith('2026-08-25', '2026-08-25')
  })

  // 적은 순서다. 금액순으로 정렬하면 방금 적은 것이 목록 어디로 튈지 모른다.
  it('적은 순으로 선다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([
      { ...수입행, id: 'inc-late', recordedAt: '2026-08-25T09:00:00.000Z' },
    ])
    spend.getSpendRecordsBetween.mockResolvedValue([지출행])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-25')

    const { rowKeyOf } = require('../records') as typeof import('../records')
    expect(rows.map(rowKeyOf)).toEqual(['spd-1', 'inc-late'])
  })

  // 읽기 실패는 화면을 죽이지 않는다. 캘린더 칸과 같은 처방이다.
  it('읽기가 실패해도 빈 목록으로 진행한다', async () => {
    spend.getSpendRecordsBetween.mockRejectedValue(new Error('stale connection'))
    income.getIncomeRecordsBetween.mockResolvedValue([수입행])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    await expect(loadDayRecords('2026-08-25')).resolves.toHaveLength(1)
  })
})

// 카드 두 줄의 규칙은 갈래마다 다르다. 이름 · 제목 · 단위는 서버 표에서 찾고, 사용자가 확정한 카드 이름표가 그 모양이다.
describe('하루 목록 카드의 두 줄', () => {
  const 카드 = (entry: import('../records').DayRecord) => [titleOf(entry), detailOf(entry)]

  it('지출 목록 항목은 묶음 제목과 항목 이름 + 수량 단위다. 이름이 제목과 같으면 수량만 적는다', () => {
    expect(카드({ kind: 'spend', record: 지출행, characterName: '루디' })).toEqual(['루디 · 몬스터 파크', '2회'])
    expect(
      카드({ kind: 'spend', record: { ...지출행, category: 'buff', itemKey: 'boss_killer_potion', quantity: 1 }, characterName: '' }),
    ).toEqual(['버프(보스)', '보스 킬러 비약 1개'])
    // 원본 이름이 선다. 시트 타일의 줄인 이름(블루베리 농장)이 아니다.
    expect(
      카드({ kind: 'spend', record: { ...지출행, category: 'event_bm', itemKey: 'blueberry_farm', quantity: 1 }, characterName: '' }),
    ).toEqual(['메이플 포인트 샵', '블루베리 농장 입장권 1개'])
  })

  it('에픽던전 리워드는 묶음 제목과 형태마다의 단계다', () => {
    expect(
      카드({
        kind: 'spend',
        record: { ...지출행, item: '옛 이름', itemKey: null, formItemKeys: { exp: 'high_mountain_2', sol_erda: 'high_mountain_1' } },
        characterName: '',
      }),
    ).toEqual(['에픽던전', '하이마운틴 경험치 2단계, 솔 에르다 1단계'])
  })

  it('심볼 강화는 갈래 제목과 심볼 이름 · 두 레벨이고, 심볼을 못 찾으면 적어 둔 이름이다', () => {
    const 심볼행 = { ...지출행, category: 'symbol' as const, item: '옛 이름', itemKey: 'cernium', levelFrom: 7, levelTo: 10, quantity: null }

    expect(카드({ kind: 'spend', record: 심볼행, characterName: '루디' })).toEqual(['루디 · 심볼강화', '세르니움 7 → 10'])
    expect(카드({ kind: 'spend', record: { ...심볼행, itemKey: 'removed_symbol' }, characterName: '' })).toEqual(['심볼강화', '옛 이름'])
  })

  it('아이템 구매 · 판매는 직접 친 이름이고 소비 · 기타만 수량을 붙인다', () => {
    const 구매 = { ...지출행, category: 'item_purchase' as const, item: '앱솔랩스 아처슈즈', itemKey: null, quantity: null, itemKind: 'equipment' as const }

    expect(카드({ kind: 'spend', record: 구매, characterName: '' })).toEqual(['아이템 구매', '앱솔랩스 아처슈즈'])
    expect(카드({ kind: 'spend', record: { ...구매, item: '마력의 돌', itemKind: 'consumable', quantity: 10 }, characterName: '' })).toEqual([
      '아이템 구매',
      '마력의 돌 10개',
    ])
    expect(
      카드({ kind: 'income', record: { ...수입행, category: 'item_sale', item: '마력의 돌', itemKind: 'etc', quantity: 3 }, characterName: '' }),
    ).toEqual(['아이템 판매', '마력의 돌 3개'])
  })

  it('기타는 직접 친 이름이고 수량이 2 이상일 때만 붙인다. 이름이 없으면 둘째 줄이 없다', () => {
    const 기타 = { ...지출행, category: 'etc' as const, item: '모멘텀 프라임 패스', itemKey: null, quantity: 1 }

    expect(카드({ kind: 'spend', record: 기타, characterName: '' })).toEqual(['기타', '모멘텀 프라임 패스'])
    expect(카드({ kind: 'spend', record: { ...기타, quantity: 2 }, characterName: '' })).toEqual(['기타', '모멘텀 프라임 패스 2개'])
    expect(카드({ kind: 'spend', record: { ...기타, item: null }, characterName: '' })).toEqual(['기타', null])
  })

  it('사냥은 소재 수이고, 조각 가격을 적었으면 판 개수를 잇는다. 계산기가 아니면 직접 입력이다', () => {
    const 계산기 = {
      ...수입행,
      itemKey: 'tallahart_road_of_night_3',
      hunt: {
        mode: 'calculator' as const,
        characterLevel: 285,
        missedMobs: 0,
        boosts: [],
        sojae: 8,
        fragments: 30,
        fragmentPrice: null,
        mesoRate: 0,
        unionTier: 3 as const,
      },
    }

    expect(카드({ kind: 'income', record: 계산기, characterName: '루디' })).toEqual(['루디 · 사냥', '8소재'])
    expect(
      카드({ kind: 'income', record: { ...계산기, hunt: { ...계산기.hunt, fragmentPrice: 5_000_000 } }, characterName: '' }),
    ).toEqual(['사냥', '8소재, 솔 에르다 조각 30개 판매'])
    expect(카드({ kind: 'income', record: 수입행, characterName: '' })).toEqual(['사냥', '직접 입력'])
  })

  it('솔 에르다 조각 정산은 사냥 제목과 판 개수다', () => {
    expect(
      카드({ kind: 'income', record: { ...수입행, category: 'sol_erda_fragment', item: null, quantity: 120 }, characterName: '' }),
    ).toEqual(['사냥', '솔 에르다 조각 120개 판매'])
  })

  // 아이템마다 한 줄로 저장해서 줄마다 무엇을 팔았는지가 선다. 이름은 기록이 아니라 전리품 표의 key 로 찾는다.
  it('사냥 전리품 판매는 전리품 표에서 찾은 아이템 이름과 판 개수다', () => {
    const 전리품 = { ...수입행, category: 'hunt_loot_sale' as const, item: null, itemKey: 'reindeer_milk', quantity: 300 }
    expect(detailOf({ kind: 'income', record: 전리품, characterName: '' })).toBe('순록의 우유 300개 판매')
  })
})

describe('줄의 금액', () => {

  it('메포 지출은 시세로 환산한 메소다', () => {
    const { recordMesoOf } = require('../records') as typeof import('../records')

    expect(recordMesoOf({ kind: 'spend', record: 지출행, characterName: '' })).toBe(101_694_915)
  })

  // 캐시는 환산 자체를 안 한다. 메소 축에 0 으로 들되 줄은 원으로 적는다.
  it('캐시 지출은 메소 축이 0 이고 캐시 금액을 따로 든다', () => {
    const { recordMesoOf, recordCashOf } = require('../records') as typeof import('../records')
    const 캐시행 = { ...지출행, pointAmount: null, pointPer100mMeso: null, cashAmount: 15_000 }

    expect(recordMesoOf({ kind: 'spend', record: 캐시행, characterName: '' })).toBe(0)
    expect(recordCashOf({ kind: 'spend', record: 캐시행, characterName: '' })).toBe(15_000)
    expect(recordCashOf({ kind: 'income', record: 수입행, characterName: '' })).toBeNull()
  })
})

describe('고치기와 지우기', () => {
  it('지출을 고치면 갈아 끼우고 시세를 기억한다', async () => {
    const { editSpend } = require('../records') as typeof import('../records')

    await editSpend({ ...지출행, quantity: 3 })

    expect(spend.updateSpendRecord).toHaveBeenCalledWith({ ...지출행, quantity: 3 }, 'account-main')
    expect(rate.setLastPointRate).toHaveBeenCalledWith(1_180)
  })

  // 던진 수정의 시세를 다음 기본값으로 남기면 안 된다. 넣을 때와 같은 순서다.
  it('수정이 실패하면 시세를 안 기억한다', async () => {
    spend.updateSpendRecord.mockRejectedValue(new Error('no such column'))
    const { editSpend } = require('../records') as typeof import('../records')

    await expect(editSpend(지출행)).rejects.toThrow()
    expect(rate.setLastPointRate).not.toHaveBeenCalled()
  })

  it('갈래대로 지운다', async () => {
    const { removeRecord } = require('../records') as typeof import('../records')

    await removeRecord({ kind: 'spend', record: 지출행, characterName: '' })
    await removeRecord({ kind: 'income', record: 수입행, characterName: '' })

    expect(spend.deleteSpendRecord).toHaveBeenCalledWith('spd-1')
    expect(income.deleteIncomeRecord).toHaveBeenCalledWith('inc-1')
  })
})

// 보스 수익이 흘러드는 법
const 스우기록 = {
  ocid: 'ocid-1',
  bossKey: 'lotus',
  boss: '스우',
  difficulty: 'hard',
  periodKey: '2026-08-20',
  payoutMeso: 2_100_000_000,
  defeatedOn: '2026-08-21',
}
const 데미안기록 = { ...스우기록, bossKey: 'damien', boss: '데미안', payoutMeso: 1_500_000_000 }

function 드롭(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ocid: 'ocid-1',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'hard',
    periodKey: '2026-08-20',
    dropIndex: 0,
    itemKey: 'loose_control_machine_mark',
    itemName: '루즈 컨트롤 머신 마크',
    priceState: 'entered',
    priceMeso: 12_000_000_000,
    priceShare: 3,
    ...overrides,
  }
}

describe('칸 금액: 보스가 칸에 든다', () => {
  it('결정석과 아이템 판매를 그 날의 수익에 더한다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    bossDrops.getBossDropRecords.mockResolvedValue([드롭()])

    const amounts = await 칸금액('2026-08-01', '2026-08-31')

    // 결정석 21억 + 판매 120억/3 = 40억 → 61억
    expect(amounts['2026-08-21']).toEqual({ incomeMeso: 6_100_000_000, expenseMeso: 0 })
  })

  it('드롭은 자기 날짜가 없다. 짝인 보스 행의 날짜에 선다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([{ ...스우기록, defeatedOn: '2026-08-22' }])
    bossDrops.getBossDropRecords.mockResolvedValue([드롭()])

    const amounts = await 칸금액('2026-08-01', '2026-08-31')

    expect(amounts['2026-08-22']?.incomeMeso).toBe(6_100_000_000)
    expect(amounts['2026-08-21']).toBeUndefined()
  })

  it('짝인 보스 행이 없는 드롭은 어느 칸에도 안 든다. 물려받을 날짜가 없다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    bossDrops.getBossDropRecords.mockResolvedValue([드롭({ bossKey: 'guardian_angel_slime', boss: '가디언 엔젤 슬라임' })])

    const amounts = await 칸금액('2026-08-01', '2026-08-31')

    expect(amounts['2026-08-21']?.incomeMeso).toBe(2_100_000_000)
  })

  it('추적 캐릭터가 없으면 보스 테이블을 안 읽는다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(null)

    await 칸금액('2026-08-01', '2026-08-31')

    expect(bossProfit.getDatedBossProfitRecords).not.toHaveBeenCalled()
  })

  it('보스 기록이 없으면 드롭도 안 읽는다. 물려받을 날짜가 없다', async () => {

    await 칸금액('2026-08-01', '2026-08-31')

    expect(bossDrops.getBossDropRecords).not.toHaveBeenCalled()
  })
})

describe('loadDayRecords: 캐릭터당 두 줄 (결정 7)', () => {
  it('결정석과 판매를 갈라 두 줄로 세운다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록, 데미안기록])
    bossDrops.getBossDropRecords.mockResolvedValue([드롭(), 드롭({ dropIndex: 1, priceState: null, priceMeso: null })])
    const { loadDayRecords, recordMesoOf } =
      require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(rows.map(titleOf)).toEqual(['루디 · 보스 결정석', '루디 · 보스 드롭 판매'])
    expect(rows.map(recordMesoOf)).toEqual([3_600_000_000, 4_000_000_000])
    expect(rows.map(detailOf)).toEqual(['2마리', '1건'])
  })

  it('판매가 하나도 없으면 그 줄이 안 선다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(rows.map(titleOf)).toEqual(['루디 · 보스 결정석'])
  })

  /**
   * 미입력만 있으면 줄이 안 선다.
   *
   * 가계부는 돈이 오간 기록을 세는 자리라, 아직 값이 없는 건이 0원으로 서면 그날의 목록이
   * 그만큼 헐거워진다.
   */
  it('미입력만 있으면 줄이 **안 선다**', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    bossDrops.getBossDropRecords.mockResolvedValue([드롭({ priceState: null, priceMeso: null })])
    const { loadDayRecords } =
      require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    // 결정석 줄만 남는다.
    expect(rows.map(titleOf)).toEqual(['루디 · 보스 결정석'])
  })

  // 판 것이 하나라도 있으면 그 줄은 선다. 가계부는 판 것만 보여 줘 `미입력` 을 안 적는다.
  it('판 것이 섞여 있으면 줄이 서고 판 건수만 적는다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    bossDrops.getBossDropRecords.mockResolvedValue([
      드롭({ priceState: 'entered', priceMeso: 1_000_000 }),
      드롭({ itemKey: null, itemName: '칠흑의 보스 반지 상자', priceState: null, priceMeso: null }),
    ])
    const { loadDayRecords } =
      require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(detailOf(rows[1])).toBe('1건')
  })

  // 판매 줄을 펼치면 그날 판 아이템이 한 줄씩 뜬다. 값을 넣은 드롭만 들고 한 행이 한 줄이다.
  describe('판매 줄의 판 아이템', () => {
    async function 판매줄(drops: Record<string, unknown>[]) {
      bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
      bossDrops.getBossDropRecords.mockResolvedValue(drops)
      const { loadDayRecords } = require('../records') as typeof import('../records')
      const rows = await loadDayRecords('2026-08-21')
      return rows.find((row) => row.kind === 'dropSale')
    }

    it('값을 넣은 드롭만 표 이름과 분배 후 금액으로 든다', async () => {
      const row = await 판매줄([
        드롭(),
        드롭({ dropIndex: 1, priceState: null, priceMeso: null }),
        드롭({ dropIndex: 2, priceState: 'excluded', priceMeso: null }),
      ])

      expect(row?.kind === 'dropSale' && row.items).toEqual([
        { itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크', payoutMeso: 4_000_000_000 },
      ])
    })

    // 표에 없는 key 면 기록에 적어 둔 이름이다.
    it('보이는 이름은 아이템 key 로 찾은 표 이름이고 없으면 기록의 이름이다', async () => {
      const row = await 판매줄([드롭({ itemName: '옛 이름' }), 드롭({ dropIndex: 1, itemKey: null, itemName: '없어진 아이템' })])

      expect(row?.kind === 'dropSale' && row.items.map((item) => item.itemName)).toEqual(['루즈 컨트롤 머신 마크', '없어진 아이템'])
    })

    // 같은 아이템을 둘 팔았으면 두 줄이다(사용자 결정). 금액이 큰 순이고 같으면 이름 순이다.
    it('행마다 한 줄이고 금액이 큰 순, 같으면 이름 순이다', async () => {
      const row = await 판매줄([
        드롭({ dropIndex: 0, itemKey: 'dreamy_belt', itemName: '몽환의 벨트', priceMeso: 300, priceShare: 1 }),
        드롭({ dropIndex: 1, priceMeso: 900, priceShare: 1 }),
        드롭({ dropIndex: 2, priceMeso: 300, priceShare: 1 }),
        드롭({ dropIndex: 3, itemKey: 'dreamy_belt', itemName: '몽환의 벨트', priceMeso: 300, priceShare: 1 }),
      ])

      expect(row?.kind === 'dropSale' && row.items.map((item) => [item.itemName, item.payoutMeso])).toEqual([
        ['루즈 컨트롤 머신 마크', 900],
        ['루즈 컨트롤 머신 마크', 300],
        ['몽환의 벨트', 300],
        ['몽환의 벨트', 300],
      ])
    })
  })

  /**
   * 손입력 줄도 **캐릭터 이름을 든다**.
   *
   * 이름 표를 **한 번에** 찾는 것이 계약이다. 손입력과 보스가 같은 캐릭터를 가리킬 수 있어,
   * 갈라 부르면 같은 `ocid` 를 두 번 읽는다.
   */
  it('손입력 줄이 캐릭터 이름을 든다. 없으면 빈 문자열이다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([
      { id: 'i1', ocid: 'ocid-1', earnedOn: '2026-08-21', category: 'item_sale', item: '엘리시움', mesoAmount: 1, recordedAt: 'a' },
      { id: 'i2', ocid: null, earnedOn: '2026-08-21', category: 'item_sale', item: '리우', mesoAmount: 1, recordedAt: 'b' },
    ])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(rows.map(titleOf)).toEqual(['루디 · 아이템 판매', '아이템 판매'])
    // 같은 `ocid` 를 두 번 읽지 않는다. 표를 한 번에 찾는다.
    expect(profileLookup.resolveDisplayProfiles).toHaveBeenCalledTimes(1)
  })

  it('보스 줄이 손입력보다 위에 선다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    income.getIncomeRecordsBetween.mockResolvedValue([
      { id: 'i1', earnedOn: '2026-08-21', category: 'hunting', item: null, mesoAmount: 1, recordedAt: 'z' },
    ])
    const { loadDayRecords, isManualRecord } = require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(rows.map(isManualRecord)).toEqual([false, true])
  })

  it('이름을 모르면 ocid 대신 `알 수 없음` 을 안 적는다. 표에도 캐시에도 없으면 갈래만 적는다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    profileLookup.resolveDisplayProfiles.mockResolvedValue(new Map())
    const { loadDayRecords } = require('../records') as typeof import('../records')

    expect((await loadDayRecords('2026-08-21')).map(titleOf)).toEqual(['보스 결정석'])
  })

  // 캐릭터를 관리 목록에서 빼도 그날의 결정석·판매 줄은 남아야 한다. 같은 화면의 손입력 줄은
  // 날짜로만 골라 이미 남아 있었으므로, 전에는 한 목록 안에서 줄의 출처에 따라 다르게
  // 살아남고 있었다.
  it('추적에서 빠진 캐릭터의 보스 줄도 조회 범위에 든다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(['ocid-1'])
    bossProfit.getRecordedCharacterOcids.mockResolvedValue(['ocid-1', 'ocid-해제'])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    await loadDayRecords('2026-08-21')

    expect(bossProfit.getDatedBossProfitRecords).toHaveBeenCalledWith(
      ['ocid-1', 'ocid-해제'],
      '2026-08-21',
      '2026-08-21',
    )
  })

  it('추적 목록이 비어도 기록이 있으면 보스 줄을 읽는다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(null)
    bossProfit.getRecordedCharacterOcids.mockResolvedValue(['ocid-해제'])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    await loadDayRecords('2026-08-21')

    expect(bossProfit.getDatedBossProfitRecords).toHaveBeenCalledWith(
      ['ocid-해제'],
      '2026-08-21',
      '2026-08-21',
    )
  })

  // 줄을 펼치면 뜰 것. 그날 잡은 보스다. **새로 읽는 것이 없다**:
  // 접어서 버리던 보스·난이도를 들고 있게 한 것뿐이다.
  it('결정석 줄이 그날 잡은 보스를 들고 있다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록, 데미안기록])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const [줄] = await loadDayRecords('2026-08-21')

    expect(줄.kind).toBe('bossCrystal')
    expect(줄.kind === 'bossCrystal' ? 줄.bosses : null).toEqual([
      { bossKey: 'lotus', bossName: '스우', difficulty: 'hard', payoutMeso: 2_100_000_000 },
      { bossKey: 'damien', bossName: '데미안', difficulty: 'hard', payoutMeso: 1_500_000_000 },
    ])
  })

// 순서는 `bosses.json` 정규 순서다. 같은 보스 무리가 앱의 네
  // 자리에서 서는데 차례가 자리마다 다르면 그것이 같은 목록임을 사람이 못 알아본다. `제일 큰 것`
  // 의 자리는 마리당 금액이 실제로 적힌 보스 수익 탭으로 남는다(타일 판은 금액을 안 적는다).
  it('금액이 아니라 bosses.json 순서로 선다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([
      { ...스우기록, bossKey: 'lucid', boss: '루시드', payoutMeso: 1_500_000_000 },
      { ...스우기록, bossKey: 'black_mage', boss: '검은마법사', difficulty: 'hard', payoutMeso: 9_000_000_000 },
      스우기록,
    ])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const [줄] = await loadDayRecords('2026-08-21')

    // 보스 표: 스우(7) < 루시드(10) < 검은 마법사(monthly, 맨 뒤). 금액 순이면 검은 마법사가 앞이다. 이름은 표의 API 표기다.
    expect(줄.kind === 'bossCrystal' ? 줄.bosses.map((boss) => boss.bossName) : null).toEqual([
      '스우',
      '루시드',
      '검은 마법사',
    ])
  })

  // 같은 보스를 난이도를 갈아 두 번 잡는 것은 정상이라(주간 한도가 보스별이 아니다) 두 타일이다.
  it('난이도가 다르면 다른 타일이다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([
      스우기록,
      { ...스우기록, difficulty: 'normal', payoutMeso: 500_000_000 },
    ])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const [줄] = await loadDayRecords('2026-08-21')

    // 같은 보스면 난이도 순서다(이지 < 노멀 < 하드 …).
    expect(줄.kind === 'bossCrystal' ? 줄.bosses : null).toEqual([
      { bossKey: 'lotus', bossName: '스우', difficulty: 'normal', payoutMeso: 500_000_000 },
      { bossKey: 'lotus', bossName: '스우', difficulty: 'hard', payoutMeso: 2_100_000_000 },
    ])
  })

  /**
   * 상세의 합계와 칸 금액은 **같은 수여야 한다**.
   *
   * 둘이 다른 길로 나오므로(하나는 그날 읽기, 하나는 범위 읽기) 이 등식이 깨지면 **화면이
   * 서로를 반박한다**. 칸에는 61억인데 그 칸을 누르면 다른 수가 뜬다. 네 원천을 다 세운다.
   */
  it('그날 합계는 칸 금액과 같은 수다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    bossDrops.getBossDropRecords.mockResolvedValue([드롭()])
    income.getIncomeRecordsBetween.mockResolvedValue([
      { id: 'i1', earnedOn: '2026-08-21', category: 'hunting', item: null, mesoAmount: 700_000_000, recordedAt: 'a' },
    ])
    spend.getSpendRecordsBetween.mockResolvedValue([
      {
        id: 's1', spentOn: '2026-08-21', category: 'content', item: '몬스터 파크', itemKey: 'monster_park', formItemKeys: null, itemKind: null, levelFrom: null, levelTo: null,
        quantity: 1, mesoAmount: 50_000_000, tariffMeso: null, pointAmount: 1_200,
        pointPer100mMeso: 1_180, cashAmount: null, recordedAt: 'b',
      },
    ])
    const { loadDayRecords, dayTotalsOf } = require('../records') as typeof import('../records')

    const [rows, amounts] = await Promise.all([
      loadDayRecords('2026-08-21'),
      칸금액('2026-08-21', '2026-08-21'),
    ])

    expect(dayTotalsOf(rows)).toEqual(amounts['2026-08-21'])
  })

  it('보스 줄은 손입력이 아니다. 여기서 못 고친다 (결정 8)', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    const { loadDayRecords, isManualRecord, rowKeyOf } = require('../records') as typeof import('../records')

    const [row] = await loadDayRecords('2026-08-21')

    expect(isManualRecord(row)).toBe(false)
    expect(rowKeyOf(row)).toBe('bossCrystal:ocid-1')
  })
})

/**
 * 시트가 고를 수 있는 캐릭터(캐릭터를 선택해서 입력하는 방법).
 *
 * **이름을 모르는 캐릭터는 안 든다**. `ocid` 는 사용자에게 아무 뜻도 없는 문자열이라, 그것을
 * 목록에 세우면 있지도 않은 캐릭터 가 하나 생긴다.
 */
describe('loadTrackedCharacters', () => {
  it('추적 캐릭터를 이름 · 레벨 · 월드와 함께 든다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(['ocid-1', 'ocid-2'])
    basicCache.getCachedCharacterBasic.mockImplementation(async (ocid: string) => ({
      profile:
        ocid === 'ocid-1'
          ? { name: '루디', level: 294, worldKey: 'scania' }
          : { name: '아델', level: 275, worldKey: 'elysium' },
    }))
    const { loadTrackedCharacters } = require('../records') as typeof import('../records')

    // 레벨은 사냥 계산기가 쓴다. 지역을 ±20 으로 거르고 페널티를 낸다.
    expect(await loadTrackedCharacters()).toEqual([
      { ocid: 'ocid-1', name: '루디', level: 294, worldKey: 'scania' },
      { ocid: 'ocid-2', name: '아델', level: 275, worldKey: 'elysium' },
    ])
  })

  // 캐시가 따뜻해지기 전이면 레벨만 없다. 이름이 있으면 목록에는 선다. 그때 계산기는 페널티
  // 없이 세고, 그 사실을 시트가 한 줄로 말한다.
  it('레벨 · 월드를 모르면 null 로 든다. 그 캐릭터를 빼지는 않는다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(['ocid-1'])
    basicCache.getCachedCharacterBasic.mockResolvedValue({ profile: { name: '루디' } })
    const { loadTrackedCharacters } = require('../records') as typeof import('../records')

    expect(await loadTrackedCharacters()).toEqual([{ ocid: 'ocid-1', name: '루디', level: null, worldKey: null }])
  })

  it('캐시가 비어 이름을 모르는 캐릭터는 뺀다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(['ocid-1', 'ocid-2'])
    basicCache.getCachedCharacterBasic.mockImplementation(async (ocid: string) =>
      ocid === 'ocid-1' ? { profile: { name: '루디' } } : null,
    )
    const { loadTrackedCharacters } = require('../records') as typeof import('../records')

    expect(await loadTrackedCharacters()).toEqual([
      { ocid: 'ocid-1', name: '루디', level: null, worldKey: null },
    ])
  })

  // 못 읽으면 목록이 빈다. 그때 고르개에는 `선택 안함` 하나만 선다. 던지지 않는다.
  it('추적 목록을 못 읽으면 빈 목록이다', async () => {
    selection.getTrackedCharacterOcids.mockRejectedValue(new Error('no such table'))
    const { loadTrackedCharacters } = require('../records') as typeof import('../records')

    expect(await loadTrackedCharacters()).toEqual([])
  })
})

/**
 * 사냥 줄은 `캐릭터 · 사냥` + `n소재` 다.
 *
 * 그 줄이 답하는 것은 오늘 무엇으로 벌었나 이고 어느 맵이었나 는 열어 봐야 뜻이 생기는 값이다.
 * 갈래 이름이 그 자리를 들고, 몇 소재를 돌았나 를 세는 칸이 보스 줄의 n마리와 같은 자리·같은
 * 모양으로 선다. 글자가 시트의 시간 줄과 같은 이름이라(1소재 = 30분) 한 수가 두 이름을 안 갖는다.
 */
describe('사냥 줄의 이름과 셈', () => {
  const 사냥기록 = {
    id: 'inc-h',
    ocid: 'ocid-1',
    earnedOn: '2026-08-21',
    category: 'hunting' as const,
    item: '밤의 길 3',
    itemKey: 'tallahart_road_of_night_3',
    mesoAmount: 41_760_000,
    saleFeePercent: null,
    saleFeeMeso: null,
    saleFeeAuto: false,
    itemKind: null,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    hunt: {
      mode: 'calculator' as const,
      characterLevel: 294,
      missedMobs: 0,
      boosts: [],
      sojae: 2,
      fragments: 0,
      fragmentPrice: 0,
      mesoRate: 149,
      unionTier: 3,
    },
    recordedAt: '2026-08-21T01:00:00.000Z',
  }

  it('첫 칸이 **사냥터가 아니라 갈래**다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([사냥기록])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(rows.map(titleOf)).toEqual(['루디 · 사냥'])
  })

  it('**n소재**를 센다. 보스 줄의 `n마리`와 같은 자리다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([사냥기록])
    const { loadDayRecords } =
      require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(detailOf(rows[0])).toBe('2소재')
  })

  // 수동으로 적은 행에는 소재 줄이 없다. 셀 것이 없으니 칸도 안 선다.
  it('수동으로 적은 행은 직접 입력이라고 적는다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([
      {
        ...사냥기록,
        item: null,
        hunt: { mode: 'manual' as const, typedMeso: 41_760_000, fragments: 0, fragmentPrice: 0 },
      },
    ])
    const { loadDayRecords } =
      require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(titleOf(rows[0])).toBe('루디 · 사냥')
    expect(detailOf(rows[0])).toBe('직접 입력')
  })

  //  이전에 적힌 사냥 행은 계산 입력이 없다. 셀 것이 없으니 칸도 안 선다.
  it('계산기 이전 행도 직접 입력이라고 적는다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([{ ...사냥기록, hunt: null }])
    const { loadDayRecords } =
      require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(titleOf(rows[0])).toBe('루디 · 사냥')
    expect(detailOf(rows[0])).toBe('직접 입력')
  })
})

/**
 * 솔 에르다 조각 정산 줄은 `캐릭터 · 솔 에르다 조각` + `n개` 다(사용자 지정). 개수는 사냥 줄의 `n소재` 가
 * 서는 자리다.
 */
describe('솔 에르다 조각 정산 줄', () => {
  const 정산기록 = {
    id: 'inc-s',
    ocid: 'ocid-1',
    earnedOn: '2026-08-21',
    category: 'sol_erda_fragment' as const,
    item: null,
    itemKey: null,
    mesoAmount: 400_000_000,
    saleFeePercent: null,
    saleFeeMeso: null,
    saleFeeAuto: false,
    itemKind: null,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    hunt: null,
    quantity: 50,
    recordedAt: '2026-08-21T01:00:00.000Z',
  }

  it('제목은 캐릭터 · 사냥이고 판 개수를 센다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([정산기록])
    const { loadDayRecords, recordMesoOf } =
      require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(titleOf(rows[0])).toBe('루디 · 사냥')
    expect(detailOf(rows[0])).toBe('솔 에르다 조각 50개 판매')
    expect(recordMesoOf(rows[0])).toBe(400_000_000)
  })
})

/** 아이템 판매 줄도 수량이 있으면(소비 · 기타) 판 개수를 센다. 조각 정산 줄과 같은 자리다. */
describe('아이템 판매 줄의 개수', () => {
  const 판매기록 = {
    id: 'inc-i',
    ocid: 'ocid-1',
    earnedOn: '2026-08-21',
    category: 'item_sale' as const,
    item: '파워 엘릭서',
    itemKey: null,
    itemKind: 'consumable' as const,
    mesoAmount: 97_000_000,
    saleFeePercent: 3 as const,
    saleFeeMeso: 3_000_000,
    saleFeeAuto: false,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    hunt: null,
    quantity: 100,
    recordedAt: '2026-08-21T01:00:00.000Z',
  }

  it('소비 · 기타는 판 개수를 센다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([판매기록])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(detailOf(rows[0])).toBe('파워 엘릭서 100개')
  })

  it('장비와 옛 행은 수량 없이 이름만 적는다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([
      { ...판매기록, itemKind: 'equipment' as const, quantity: null },
    ])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(detailOf(rows[0])).toBe('파워 엘릭서')
  })
})

/**
 * 정산 폼이 보는 보관 개수. 시트는 저장소를 모르므로 이 층이 감싸 화면에 넘긴다.
 *
 * 못 읽으면 `null` 이다. 0 으로 읽으면 보관이 있는데도 없다고 적는다.
 */
describe('loadFragmentStorage', () => {
  it('못 읽으면 null 이다', async () => {
    income.getFragmentStorage.mockRejectedValue(new Error('db'))
    const { loadFragmentStorage } = require('../records') as typeof import('../records')

    await expect(loadFragmentStorage('ocid-1', '2026-09-10', undefined)).resolves.toBeNull()
  })
})

/**
 * 화면이 내 숫자가 낡았나 를 묻는 값. 화면은 `storage/` 를 직접 안 부르므로
 * (CLAUDE.md CRITICAL) 두 표의 판을 여기서 하나로 접는다.
 */
describe('cashbookDataRevision', () => {
  it('원천 셋의 판을 합한다. 어느 쪽이 올라도 값이 달라진다', () => {
    const { cashbookDataRevision } = require('../records') as typeof import('../records')

    expect(cashbookDataRevision()).toBe(0)

    bossDrops.getBossDropRecordsRevision.mockReturnValue(1)
    expect(cashbookDataRevision()).toBe(1)

    bossProfit.getBossProfitRecordsRevision.mockReturnValue(4)
    expect(cashbookDataRevision()).toBe(5)

    // 이어서 하는 작업이 수입 기록의 수수료를 고쳐 쓰면 오른다
    income.getIncomeRecordsRevision.mockReturnValue(2)
    expect(cashbookDataRevision()).toBe(7)
  })
})

/** 기기 `enhancement_totals` 한 줄. 기본은 큐브 한 번 450,000 메소다. */
const 합계 = (over: Partial<EnhancementTotal> = {}): EnhancementTotal => ({
  id: 't1',
  nexonAccountId: 'account-main',
  historyDate: '2026-08-23',
  characterName: '낟낟',
  enhancementType: 'cube',
  enhancementCategory: 'cube_reset',
  itemGroup: 'key:arcane_umbra_knuckle',
  itemKey: 'arcane_umbra_knuckle',
  itemName: '아케인셰이드 클로',
  attempts: 1,
  attemptCostMeso: 450_000,
  destroyDefenceCostMeso: 0,
  eventWorld: false,
  ...over,
})

const 스타포스합계 = (over: Partial<EnhancementTotal> = {}) =>
  합계({ enhancementType: 'starforce', enhancementCategory: 'starforce', ...over })

// 강화 합계는 넷째 원천이다. 저장된 값은 MVP 할인 전이라 할인은 여기서 붙인다.
describe('강화 지출이 칸에 든다', () => {
  it('합계의 비용이 지출로 더해진다', async () => {
    enhancementTotals.loadEnhancementTotals.mockResolvedValue([합계()])

    expect((await 칸금액('2026-08-01', '2026-08-31'))['2026-08-23']).toEqual({
      incomeMeso: 0,
      expenseMeso: 450_000,
    })
  })

  it('손입력 지출과 한 칸에서 합쳐진다', async () => {
    spend.getSpendRecordsBetween.mockResolvedValue([{ ...메포지출, id: 'c', recordedAt: '' }])
    enhancementTotals.loadEnhancementTotals.mockResolvedValue([합계()])

    expect((await 칸금액('2026-08-01', '2026-08-31'))['2026-08-23'].expenseMeso)
      .toBe(2_542_372_881 - 320_000_000 + 450_000)
  })

  // 판정하지 못한 줄을 세우면 이벤트 월드 지출까지 섞여 지출이 부푼다.
  it('이벤트 월드 줄과 판정하지 못한 줄은 빠진다', async () => {
    enhancementTotals.loadEnhancementTotals.mockResolvedValue([
      합계({ eventWorld: true }),
      합계({ id: 't2', characterName: '둘째', eventWorld: null }),
    ])

    expect(await 칸금액('2026-08-01', '2026-08-31')).toEqual({})
  })

  // 파괴 방지 추가분은 MVP 할인을 받지 않는다. 두 몫을 따로 저장한 이유다.
  it('스타포스는 그 캐릭터 · 날짜의 MVP 할인을 시도 비용에만 붙인다', async () => {
    const asked: [string, string][] = []
    mvp.starforceMvpDiscountResolver.mockReturnValue((name: string, dateKey: string) => {
      asked.push([name, dateKey])
      return 10
    })
    enhancementTotals.loadEnhancementTotals.mockResolvedValue([
      스타포스합계({ attemptCostMeso: 1_000_000, destroyDefenceCostMeso: 2_000_000 }),
    ])

    expect((await 칸금액('2026-08-01', '2026-08-31'))['2026-08-23'].expenseMeso).toBe(900_000 + 2_000_000)
    expect(asked).toEqual([['낟낟', '2026-08-23']])
  })

  it('MVP 할인은 스타포스에만 붙는다', async () => {
    mvp.starforceMvpDiscountResolver.mockReturnValue(() => 10)
    enhancementTotals.loadEnhancementTotals.mockResolvedValue([합계()])

    expect((await 칸금액('2026-08-01', '2026-08-31'))['2026-08-23'].expenseMeso).toBe(450_000)
  })

  // 옮기기 전에 읽으면 업데이트 직후 첫 화면에서 지난 강화 지출이 통째로 비어 보인다.
  it('옛 원본을 합계로 옮긴 뒤에 범위를 읽는다', async () => {
    const order: string[] = []
    legacyTotals.ensureEnhancementTotals.mockImplementation(async () => {
      order.push('move')
    })
    enhancementTotals.loadEnhancementTotals.mockImplementation(async () => {
      order.push('load')
      return []
    })

    await 칸금액('2026-08-23', '2026-08-25')

    expect(order).toEqual(['move', 'load'])
    expect(enhancementTotals.loadEnhancementTotals).toHaveBeenCalledWith('2026-08-23', '2026-08-25')
  })
})

// 자동 줄인데 지출이다. 앞의 둘(결정석·판매)과 갈리는 자리가 이것뿐이다.
describe('강화 줄', () => {
  const 잠재합계 = (over: Partial<EnhancementTotal> = {}) =>
    합계({ enhancementType: 'potential', enhancementCategory: 'potential', attemptCostMeso: 38_250_000, ...over })

  async function 줄들(rows: EnhancementTotal[]) {
    enhancementTotals.loadEnhancementTotals.mockResolvedValue(rows)
    const { loadDayRecords } = require('../records') as typeof import('../records')
    return await loadDayRecords('2026-08-23')
  }

  // 하루 수백 건이라 안 접으면 목록이 그것만으로 찬다.
  it('캐릭터 하나에 분류마다 한 줄로 접는다', async () => {
    const rows = await 줄들([
      합계(),
      합계({ id: 't2', itemGroup: 'key:dea_sidus_earring', itemKey: 'dea_sidus_earring' }),
      합계({ id: 't3', characterName: '풉품' }),
    ])

    expect(rows.filter((row) => row.kind === 'enhancement')).toHaveLength(2)
  })

  // 넷을 안 묶는다. 비용이 서는 방식이 아예 달라 묶으면 무엇에 썼는지가 한 숫자에 가려진다.
  it('큐브·스타포스·잠재능력·에디셔널을 따로 센다', async () => {
    const rows = await 줄들([
      합계(),
      스타포스합계({ id: 't2' }),
      잠재합계({ id: 't3' }),
      잠재합계({ id: 't4', enhancementCategory: 'additional_potential' }),
    ])

    expect(
      rows.flatMap((row) => (row.kind === 'enhancement' ? [row.category] : [])).sort(),
    ).toEqual(['additional_potential', 'cube_reset', 'potential', 'starforce'])
  })

  it('장비별 합계의 금액과 횟수를 모은다', async () => {
    const [row] = await 줄들([
      합계({ attempts: 2, attemptCostMeso: 900_000 }),
      합계({ id: 't2', itemGroup: 'key:dea_sidus_earring', itemKey: 'dea_sidus_earring', attemptCostMeso: 338_000 }),
    ])

    expect(row).toMatchObject({
      kind: 'enhancement',
      category: 'cube_reset',
      characterName: '낟낟',
      payoutMeso: 1_238_000,
      count: 3,
    })
    expect(detailOf(row)).toMatch(/ 3회$/)
  })

  it('줄의 신원이 분류와 이름이다. ocid 가 안 온다', async () => {
    const { rowKeyOf } = require('../records') as typeof import('../records')
    const [row] = await 줄들([합계()])

    expect(rowKeyOf(row)).toBe('enhancement:cube_reset:낟낟')
  })

  // 캐릭터로 먼저 모으고 그 안에서 큰 금액이 위다. 분류를 고정 순서로 두면 그날 제일 많이 쓴
  // 것이 목록 가운데에 숨는다.
  it('캐릭터로 모으고 그 안에서 큰 금액이 위다', async () => {
    const rows = await 줄들([합계(), 잠재합계({ id: 't2' }), 합계({ id: 't3', characterName: '가가' })])

    expect(
      rows.flatMap((row) =>
        row.kind === 'enhancement' ? [`${row.characterName}/${row.category}`] : [],
      ),
    ).toEqual(['가가/cube_reset', '낟낟/potential', '낟낟/cube_reset'])
  })

  // 금액까지 같으면 분류 글자 순서다. key 순서로 가르면 전과 달리 큐브가 스타포스 앞에 선다.
  it('금액이 같은 분류 줄은 보이는 글자 순서다', async () => {
    const rows = await 줄들([합계(), 스타포스합계({ id: 't2' })])

    expect(rows.flatMap((row) => (row.kind === 'enhancement' ? [row.category] : []))).toEqual(['starforce', 'cube_reset'])
  })

  // 펼쳐서 보는 이유가 **어디에 썼나** 라서 이름순이면 그 답이 안 보인다.
  it('만진 장비를 큰 금액부터 담는다', async () => {
    const [row] = await 줄들([
      합계({ itemGroup: 'key:dea_sidus_earring', itemKey: 'dea_sidus_earring', itemName: '데아 시두스 이어링', attemptCostMeso: 338_000 }),
      합계({ id: 't2', attempts: 2, attemptCostMeso: 1_600_000 }),
    ])

    expect(row.kind === 'enhancement' && row.items).toEqual([
      { itemKey: 'arcane_umbra_knuckle', targetItem: '아케인셰이드 클로', count: 2, costMeso: 1_600_000 },
      { itemKey: 'dea_sidus_earring', targetItem: '데아 시두스 이어링', count: 1, costMeso: 338_000 },
    ])
  })

  // 금액이 같으면 순서가 흔들리면 안 된다. 다시 그릴 때마다 줄이 자리를 바꾼다.
  it('금액이 같으면 건수로, 그것도 같으면 이름으로 가른다', async () => {
    const [row] = await 줄들([
      합계({ itemGroup: 'name:나', itemKey: null, itemName: '나' }),
      합계({ id: 't2', itemGroup: 'name:가', itemKey: null, itemName: '가' }),
    ])

    expect(row.kind === 'enhancement' && row.items.map((item) => item.targetItem)).toEqual(['가', '나'])
  })

  // 120 이하 장비의 큐브는 감정비용이 없고 강화권을 쓴 스타포스도 메소가 안 든다.
  // `낟넘 · 큐브 재설정 9회 −0` 같은 줄은 읽을 것이 없다(사용자 지정).
  it('한 푼도 안 쓴 줄은 안 세운다', async () => {
    expect(await 줄들([합계({ attempts: 9, attemptCostMeso: 0 })])).toEqual([])
  })

  it('섞여 있으면 안 쓴 장비만 펼침에서 빠진다', async () => {
    const [row] = await 줄들([
      합계(),
      합계({ id: 't2', itemGroup: 'name:초보자의장갑', itemKey: null, itemName: '초보자의 장갑', attemptCostMeso: 0 }),
    ])

    expect(row.kind === 'enhancement' && row.items.map((item) => item.targetItem)).toEqual(['아케인셰이드 클로'])
  })

  it('제목은 이름 · 강화이고 둘째 줄이 강화 분류를 든다', async () => {
    const [큐브줄] = await 줄들([합계()])
    const [잠재줄] = await 줄들([잠재합계({ enhancementCategory: 'additional_potential' })])

    expect(titleOf(큐브줄)).toBe('낟낟 · 강화')
    expect([detailOf(큐브줄), detailOf(잠재줄)].map((detail) => detail?.split(' ')[0])).toEqual(['큐브', '에디셔널'])
  })

  // 여기가 핵심이다. 자동 줄이라고 수익으로 세면 그날 합계가 두 배로 어긋난다.
  it('합계에서 지출로 센다', async () => {
    const { dayTotalsOf } = require('../records') as typeof import('../records')
    const rows = await 줄들([합계()])

    expect(dayTotalsOf(rows)).toEqual({ incomeMeso: 0, expenseMeso: 450_000 })
  })

  // 칸에 적힌 수와 그 칸을 눌러 나온 수가 갈리면 안 된다.
  it('칸 금액과 상세 합계가 같은 수를 낸다', async () => {
    const { loadDayRecords, dayTotalsOf } = require('../records') as typeof import('../records')
    mvp.starforceMvpDiscountResolver.mockReturnValue(() => 10)
    enhancementTotals.loadEnhancementTotals.mockResolvedValue([
      합계(),
      잠재합계({ id: 't2' }),
      스타포스합계({ id: 't3', attemptCostMeso: 1_000_000, destroyDefenceCostMeso: 2_000_000 }),
    ])

    const cell = (await 칸금액('2026-08-23', '2026-08-23'))['2026-08-23']
    const detail = dayTotalsOf(await loadDayRecords('2026-08-23'))

    expect(detail.expenseMeso).toBe(cell.expenseMeso)
  })
})

// 캐시로만 적은 지출은 메소가 0 이지만 원이 있다. 그것까지 숨기면 적은 기록이 사라진다.
describe('손입력 지출의 0', () => {
  async function 줄들(records: unknown[]) {
    spend.getSpendRecordsBetween.mockResolvedValue(records)
    const { loadDayRecords } = require('../records') as typeof import('../records')
    return await loadDayRecords('2026-08-23')
  }

  it('메소도 원도 0 이면 안 세운다', async () => {
    const rows = await 줄들([
      { ...메포지출, id: 'x', recordedAt: '', mesoAmount: 0, pointAmount: null, pointPer100mMeso: null, cashAmount: null },
    ])

    expect(rows).toEqual([])
  })

  it('원이 있으면 세운다', async () => {
    const rows = await 줄들([
      { ...메포지출, id: 'x', recordedAt: '', mesoAmount: 0, pointAmount: null, pointPer100mMeso: null, cashAmount: 6_900 },
    ])

    expect(rows).toHaveLength(1)
  })
})
