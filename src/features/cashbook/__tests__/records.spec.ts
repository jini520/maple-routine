// 가계부의 오케스트레이션([[ADR-170]] 결정 2·4).
import type { IncomeDraft, SpendDraft } from '../records'

jest.mock('../../../storage/income', () => ({
  insertIncomeRecord: jest.fn(),
  updateIncomeRecord: jest.fn(),
  deleteIncomeRecord: jest.fn(),
  getIncomeRecordsBetween: jest.fn(),
}))
jest.mock('../../../storage/spend', () => ({
  insertSpendRecord: jest.fn(),
  updateSpendRecord: jest.fn(),
  deleteSpendRecord: jest.fn(),
  getSpendRecordsBetween: jest.fn(),
}))
jest.mock('../../../storage/last-point-rate', () => ({ setLastPointRate: jest.fn() }))
jest.mock('../../../storage/boss-profit', () => ({ getDatedBossProfitRecords: jest.fn() }))
jest.mock('../../../storage/boss-drops', () => ({ getBossDropRecords: jest.fn() }))
jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
jest.mock('../../../storage/character-basic-cache', () => ({ getCachedCharacterBasic: jest.fn() }))

const income = jest.requireMock('../../../storage/income') as Record<string, jest.Mock>
const spend = jest.requireMock('../../../storage/spend') as Record<string, jest.Mock>
const rate = jest.requireMock('../../../storage/last-point-rate') as Record<string, jest.Mock>
const bossProfit = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
const bossDrops = jest.requireMock('../../../storage/boss-drops') as Record<string, jest.Mock>
const selection = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>
const basicCache = jest.requireMock('../../../storage/character-basic-cache') as Record<string, jest.Mock>

const 지금 = new Date('2026-08-23T05:00:00.000Z')

beforeEach(() => {
  jest.clearAllMocks()
  income.getIncomeRecordsBetween.mockResolvedValue([])
  spend.getSpendRecordsBetween.mockResolvedValue([])
  bossProfit.getDatedBossProfitRecords.mockResolvedValue([])
  bossDrops.getBossDropRecords.mockResolvedValue([])
  selection.getTrackedCharacterOcids.mockResolvedValue(['ocid-1'])
  basicCache.getCachedCharacterBasic.mockResolvedValue({ profile: { name: '루디' } })
})

const 수입: IncomeDraft = {
  ocid: null,
  earnedOn: '2026-08-23',
  category: '사냥',
  item: '엘리시움',
  mesoAmount: 1_200_000_000,
  memo: null,
}

const 메포지출: SpendDraft = {
  ocid: null,
  spentOn: '2026-08-23',
  category: '컨텐츠',
  item: '하이마운틴 2단계',
  form: '솔 에르다',
  quantity: 1,
  mesoAmount: null,
  tariffMeso: null,
  pointAmount: 30_000,
  pointPer100mMeso: 1_180,
  cashAmount: null,
  memo: null,
}

describe('행의 신원은 여기서 만든다', () => {
  it('저장 시각을 박는다', async () => {
    const { recordIncome } = require('../records') as typeof import('../records')

    await recordIncome(수입, 지금)

    expect(income.insertIncomeRecord.mock.calls[0][0]).toMatchObject({
      recordedAt: '2026-08-23T05:00:00.000Z',
    })
  })

  // 손입력은 «같은 날 같은 것을 두 번» 이 정상이라 자연키가 없다([[ADR-170]] 결정 2).
  it('같은 것을 두 번 넣어도 서로 다른 행이다', async () => {
    const { recordIncome } = require('../records') as typeof import('../records')

    await recordIncome(수입, 지금)
    await recordIncome(수입, 지금)

    const [first, second] = income.insertIncomeRecord.mock.calls.map((call) => call[0].id)
    expect(first).not.toBe(second)
  })
})

describe('시세를 기억한다', () => {
  it('메포 지출을 저장하면 그 시세가 다음 기본값이 된다', async () => {
    const { recordSpend } = require('../records') as typeof import('../records')

    await recordSpend(메포지출, 지금)

    expect(rate.setLastPointRate).toHaveBeenCalledWith(1_180)
  })

  it('메소 지출은 시세를 안 건드린다 — 물어본 적이 없다', async () => {
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

describe('spendMesoOf — 메소 축으로 접는다', () => {
  const { spendMesoOf } = require('../records') as typeof import('../records')

  const 행 = { ...메포지출, id: 'x', recordedAt: '' }

  it('메포는 시세로 환산해 더한다', () => {
    expect(spendMesoOf(행)).toBe(2_542_372_881)
  })

  it('메소는 그대로다', () => {
    expect(spendMesoOf({ ...행, mesoAmount: 2_000_000, pointAmount: null, pointPer100mMeso: null }))
      .toBe(2_000_000)
  })

  it('둘 다 쓴 행은 합친다 — 아이템 구매의 모양이다', () => {
    expect(spendMesoOf({ ...행, mesoAmount: 935_000_000 })).toBe(935_000_000 + 2_542_372_881)
  })

  // **캐시는 안 든다**([[ADR-166]] 정정 2 ①) — 환산 자체를 안 하므로 칸의 숫자가 그날 지출의
  // 전부가 아니다. 그 사실은 고른 날의 상세가 따로 말한다.
  it('캐시는 메소 축에 안 들어온다', () => {
    expect(spendMesoOf({ ...행, pointAmount: null, pointPer100mMeso: null, cashAmount: 6_900 }))
      .toBe(0)
  })
})

describe('loadCalendarAmounts', () => {
  it('두 원천을 날짜별로 접는다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([
      { ...수입, id: 'a', recordedAt: '' },
      { ...수입, id: 'b', recordedAt: '', mesoAmount: 543_000_000 },
    ])
    spend.getSpendRecordsBetween.mockResolvedValue([{ ...메포지출, id: 'c', recordedAt: '' }])
    const { loadCalendarAmounts } = require('../records') as typeof import('../records')

    const amounts = await loadCalendarAmounts('2026-08-01', '2026-08-31')

    expect(amounts['2026-08-23']).toEqual({
      incomeMeso: 1_743_000_000,
      expenseMeso: 2_542_372_881,
    })
  })

  it('기록이 없는 날은 아예 없다 — 0 을 채워 넣지 않는다', async () => {
    const { loadCalendarAmounts } = require('../records') as typeof import('../records')

    expect(await loadCalendarAmounts('2026-08-01', '2026-08-31')).toEqual({})
  })

  it('범위를 두 어댑터에 그대로 넘긴다', async () => {
    const { loadCalendarAmounts } = require('../records') as typeof import('../records')

    await loadCalendarAmounts('2026-08-20', '2026-08-26')

    expect(income.getIncomeRecordsBetween).toHaveBeenCalledWith('2026-08-20', '2026-08-26')
    expect(spend.getSpendRecordsBetween).toHaveBeenCalledWith('2026-08-20', '2026-08-26')
  })
})


// ── [[ADR-171]] — 적은 것은 되돌릴 수 있어야 한다 ─────────────────────────────
const 수입행 = {
  id: 'inc-1',
  ocid: null,
  earnedOn: '2026-08-25',
  category: '사냥' as const,
  item: '엘리시움',
  mesoAmount: 1_200_000_000,
  memo: null,
  recordedAt: '2026-08-25T01:00:00.000Z',
}

const 지출행 = {
  id: 'spd-1',
  ocid: null,
  spentOn: '2026-08-25',
  category: '컨텐츠' as const,
  item: '몬스터 파크',
  form: null,
  quantity: 2,
  mesoAmount: null,
  tariffMeso: null,
  pointAmount: 1_200,
  pointPer100mMeso: 1_180,
  cashAmount: null,
  memo: null,
  recordedAt: '2026-08-25T02:00:00.000Z',
}

describe('loadDayRecords — 그날 적은 것을 한 줄씩', () => {
  it('수입과 지출을 한 목록으로 접는다', async () => {
    income.getIncomeRecordsBetween.mockResolvedValue([수입행])
    spend.getSpendRecordsBetween.mockResolvedValue([지출행])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-25')

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.kind)).toEqual(['income', 'spend'])
    // **하루만** 읽는다 — 두 끝이 같다.
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

  // 읽기 실패는 화면을 죽이지 않는다 — 캘린더 칸과 같은 처방이다.
  it('읽기가 실패해도 빈 목록으로 진행한다', async () => {
    spend.getSpendRecordsBetween.mockRejectedValue(new Error('stale connection'))
    income.getIncomeRecordsBetween.mockResolvedValue([수입행])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    await expect(loadDayRecords('2026-08-25')).resolves.toHaveLength(1)
  })
})

describe('줄에 적는 것', () => {
  it('이름이 있으면 이름이다', () => {
    const { recordTitleOf } = require('../records') as typeof import('../records')

    expect(recordTitleOf({ kind: 'spend', record: 지출행 })).toBe('몬스터 파크')
  })

  // 직접 입력에서 사용처를 비우면 이름이 없다 — 빈 줄은 «무엇인지 모르는 줄» 이다.
  it('이름이 없으면 갈래 이름을 대신 적는다', () => {
    const { recordTitleOf } = require('../records') as typeof import('../records')

    expect(recordTitleOf({ kind: 'spend', record: { ...지출행, item: null } })).toBe('컨텐츠')
    expect(recordTitleOf({ kind: 'income', record: { ...수입행, item: null } })).toBe('사냥')
  })
})

describe('줄의 금액', () => {
  it('수입은 메소 그대로다', () => {
    const { recordMesoOf } = require('../records') as typeof import('../records')

    expect(recordMesoOf({ kind: 'income', record: 수입행 })).toBe(1_200_000_000)
  })

  it('메포 지출은 시세로 환산한 메소다', () => {
    const { recordMesoOf } = require('../records') as typeof import('../records')

    expect(recordMesoOf({ kind: 'spend', record: 지출행 })).toBe(101_694_915)
  })

  // 캐시는 환산 자체를 안 한다([[ADR-166]] 정정 2 ①) — 메소 축에 0 으로 들되 줄은 원으로 적는다.
  it('캐시 지출은 메소 축이 0 이고 캐시 금액을 따로 든다', () => {
    const { recordMesoOf, recordCashOf } = require('../records') as typeof import('../records')
    const 캐시행 = { ...지출행, pointAmount: null, pointPer100mMeso: null, cashAmount: 15_000 }

    expect(recordMesoOf({ kind: 'spend', record: 캐시행 })).toBe(0)
    expect(recordCashOf({ kind: 'spend', record: 캐시행 })).toBe(15_000)
    expect(recordCashOf({ kind: 'income', record: 수입행 })).toBeNull()
  })
})

describe('고치기와 지우기', () => {
  it('지출을 고치면 갈아 끼우고 시세를 기억한다', async () => {
    const { editSpend } = require('../records') as typeof import('../records')

    await editSpend({ ...지출행, quantity: 3 })

    expect(spend.updateSpendRecord).toHaveBeenCalledWith({ ...지출행, quantity: 3 })
    expect(rate.setLastPointRate).toHaveBeenCalledWith(1_180)
  })

  // 던진 수정의 시세를 다음 기본값으로 남기면 안 된다 — 넣을 때와 같은 순서다.
  it('수정이 실패하면 시세를 안 기억한다', async () => {
    spend.updateSpendRecord.mockRejectedValue(new Error('no such column'))
    const { editSpend } = require('../records') as typeof import('../records')

    await expect(editSpend(지출행)).rejects.toThrow()
    expect(rate.setLastPointRate).not.toHaveBeenCalled()
  })

  it('수입을 고치면 갈아 끼운다', async () => {
    const { editIncome } = require('../records') as typeof import('../records')

    await editIncome({ ...수입행, mesoAmount: 1 })

    expect(income.updateIncomeRecord).toHaveBeenCalledWith({ ...수입행, mesoAmount: 1 })
  })

  it('갈래대로 지운다', async () => {
    const { removeRecord } = require('../records') as typeof import('../records')

    await removeRecord({ kind: 'spend', record: 지출행 })
    await removeRecord({ kind: 'income', record: 수입행 })

    expect(spend.deleteSpendRecord).toHaveBeenCalledWith('spd-1')
    expect(income.deleteIncomeRecord).toHaveBeenCalledWith('inc-1')
  })
})

// ── 보스 수익이 흘러드는 법 ([[ADR-172]]) ────────────────────────────────────────
const 스우기록 = {
  ocid: 'ocid-1',
  boss: '스우',
  difficulty: '하드',
  periodKey: '2026-08-20',
  payoutMeso: 2_100_000_000,
  defeatedOn: '2026-08-21',
}
const 데미안기록 = { ...스우기록, boss: '데미안', payoutMeso: 1_500_000_000 }

function 드롭(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ocid: 'ocid-1',
    boss: '스우',
    difficulty: '하드',
    periodKey: '2026-08-20',
    dropIndex: 0,
    itemName: '루즈 컨트롤 머신 마크',
    priceState: 'entered',
    priceMeso: 12_000_000_000,
    priceShare: 3,
    ...overrides,
  }
}

describe('loadCalendarAmounts — 보스가 칸에 든다', () => {
  it('결정석과 아이템 판매를 그 날의 수익에 더한다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    bossDrops.getBossDropRecords.mockResolvedValue([드롭()])
    const { loadCalendarAmounts } = require('../records') as typeof import('../records')

    const amounts = await loadCalendarAmounts('2026-08-01', '2026-08-31')

    // 결정석 21억 + 판매 120억/3 = 40억 → 61억
    expect(amounts['2026-08-21']).toEqual({ incomeMeso: 6_100_000_000, expenseMeso: 0 })
  })

  it('드롭은 자기 날짜가 없다 — 짝인 보스 행의 날짜에 선다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([{ ...스우기록, defeatedOn: '2026-08-22' }])
    bossDrops.getBossDropRecords.mockResolvedValue([드롭()])
    const { loadCalendarAmounts } = require('../records') as typeof import('../records')

    const amounts = await loadCalendarAmounts('2026-08-01', '2026-08-31')

    expect(amounts['2026-08-22']?.incomeMeso).toBe(6_100_000_000)
    expect(amounts['2026-08-21']).toBeUndefined()
  })

  it('짝인 보스 행이 없는 드롭은 어느 칸에도 안 든다 — 물려받을 날짜가 없다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    bossDrops.getBossDropRecords.mockResolvedValue([드롭({ boss: '가디언 엔젤 슬라임' })])
    const { loadCalendarAmounts } = require('../records') as typeof import('../records')

    const amounts = await loadCalendarAmounts('2026-08-01', '2026-08-31')

    expect(amounts['2026-08-21']?.incomeMeso).toBe(2_100_000_000)
  })

  it('추적 캐릭터가 없으면 보스 테이블을 안 읽는다', async () => {
    selection.getTrackedCharacterOcids.mockResolvedValue(null)
    const { loadCalendarAmounts } = require('../records') as typeof import('../records')

    await loadCalendarAmounts('2026-08-01', '2026-08-31')

    expect(bossProfit.getDatedBossProfitRecords).not.toHaveBeenCalled()
  })

  it('보스 기록이 없으면 드롭도 안 읽는다 — 물려받을 날짜가 없다', async () => {
    const { loadCalendarAmounts } = require('../records') as typeof import('../records')

    await loadCalendarAmounts('2026-08-01', '2026-08-31')

    expect(bossDrops.getBossDropRecords).not.toHaveBeenCalled()
  })
})

describe('loadDayRecords — 캐릭터당 두 줄 (결정 7)', () => {
  it('결정석과 판매를 갈라 두 줄로 세운다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록, 데미안기록])
    bossDrops.getBossDropRecords.mockResolvedValue([드롭(), 드롭({ dropIndex: 1, priceState: null, priceMeso: null })])
    const { loadDayRecords, recordTitleOf, recordMesoOf, recordCountLabelOf } =
      require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(rows.map(recordTitleOf)).toEqual(['루디 · 보스 결정석', '루디 · 아이템 판매'])
    expect(rows.map(recordMesoOf)).toEqual([3_600_000_000, 4_000_000_000])
    expect(rows.map(recordCountLabelOf)).toEqual(['2마리', '1건 · 미입력 1'])
  })

  it('판매가 하나도 없으면 그 줄이 안 선다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    const { loadDayRecords, recordTitleOf } = require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(rows.map(recordTitleOf)).toEqual(['루디 · 보스 결정석'])
  })

  it('안 판 드롭만 있어도 줄이 선다 — 「미입력」 이 할 말이다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    bossDrops.getBossDropRecords.mockResolvedValue([드롭({ priceState: null, priceMeso: null })])
    const { loadDayRecords, recordCountLabelOf, recordMesoOf } =
      require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(rows).toHaveLength(2)
    expect(recordCountLabelOf(rows[1])).toBe('0건 · 미입력 1')
    expect(recordMesoOf(rows[1])).toBe(0)
  })

  it('보스 줄이 손입력보다 위에 선다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    income.getIncomeRecordsBetween.mockResolvedValue([
      { id: 'i1', earnedOn: '2026-08-21', category: '사냥', item: null, mesoAmount: 1, recordedAt: 'z' },
    ])
    const { loadDayRecords, isManualRecord } = require('../records') as typeof import('../records')

    const rows = await loadDayRecords('2026-08-21')

    expect(rows.map(isManualRecord)).toEqual([false, true])
  })

  it('이름을 모르면 ocid 대신 「알 수 없음」 을 안 적는다 — 캐시가 비면 빈 이름 대신 갈래만 적는다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    basicCache.getCachedCharacterBasic.mockResolvedValue(null)
    const { loadDayRecords, recordTitleOf } = require('../records') as typeof import('../records')

    expect((await loadDayRecords('2026-08-21')).map(recordTitleOf)).toEqual(['보스 결정석'])
  })

  // 줄을 펼치면 뜰 것 — 그날 잡은 보스다([[ADR-172]] 정정 1). **새로 읽는 것이 없다**:
  // 접어서 버리던 보스·난이도를 들고 있게 한 것뿐이다.
  it('결정석 줄이 그날 잡은 보스를 들고 있다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록, 데미안기록])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const [줄] = await loadDayRecords('2026-08-21')

    expect(줄.kind).toBe('bossCrystal')
    expect(줄.kind === 'bossCrystal' ? 줄.bosses : null).toEqual([
      { boss: '스우', difficulty: '하드' },
      { boss: '데미안', difficulty: '하드' },
    ])
  })

  // 게임 순서로 세우면 «오늘 제일 큰 것이 무엇이었나» 를 눈으로 못 찾는다.
  it('큰 것부터 선다 — 결정석이 비싼 순이다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([
      { ...스우기록, boss: '데미안', payoutMeso: 1_500_000_000 },
      { ...스우기록, boss: '검은 마법사', difficulty: '하드', payoutMeso: 9_000_000_000 },
      스우기록,
    ])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const [줄] = await loadDayRecords('2026-08-21')

    expect(줄.kind === 'bossCrystal' ? 줄.bosses.map((boss) => boss.boss) : null).toEqual([
      '검은 마법사',
      '스우',
      '데미안',
    ])
  })

  // 같은 보스를 난이도를 갈아 두 번 잡는 것은 정상이라(주간 한도가 보스별이 아니다) 두 타일이다.
  it('난이도가 다르면 다른 타일이다', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([
      스우기록,
      { ...스우기록, difficulty: '노멀', payoutMeso: 500_000_000 },
    ])
    const { loadDayRecords } = require('../records') as typeof import('../records')

    const [줄] = await loadDayRecords('2026-08-21')

    expect(줄.kind === 'bossCrystal' ? 줄.bosses : null).toEqual([
      { boss: '스우', difficulty: '하드' },
      { boss: '스우', difficulty: '노멀' },
    ])
  })

  it('보스 줄은 손입력이 아니다 — 여기서 못 고친다 (결정 8)', async () => {
    bossProfit.getDatedBossProfitRecords.mockResolvedValue([스우기록])
    const { loadDayRecords, isManualRecord, rowKeyOf } = require('../records') as typeof import('../records')

    const [row] = await loadDayRecords('2026-08-21')

    expect(isManualRecord(row)).toBe(false)
    expect(rowKeyOf(row)).toBe('bossCrystal:ocid-1')
  })
})
