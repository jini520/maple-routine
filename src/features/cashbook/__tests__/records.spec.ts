// 가계부의 오케스트레이션([[ADR-170]] 결정 2·4).
import type { IncomeDraft, SpendDraft } from '../records'

jest.mock('../../../storage/income', () => ({
  insertIncomeRecord: jest.fn(),
  getIncomeRecordsBetween: jest.fn(),
}))
jest.mock('../../../storage/spend', () => ({
  insertSpendRecord: jest.fn(),
  getSpendRecordsBetween: jest.fn(),
}))
jest.mock('../../../storage/last-point-rate', () => ({ setLastPointRate: jest.fn() }))

const income = jest.requireMock('../../../storage/income') as Record<string, jest.Mock>
const spend = jest.requireMock('../../../storage/spend') as Record<string, jest.Mock>
const rate = jest.requireMock('../../../storage/last-point-rate') as Record<string, jest.Mock>

const 지금 = new Date('2026-08-23T05:00:00.000Z')

beforeEach(() => {
  jest.clearAllMocks()
  income.getIncomeRecordsBetween.mockResolvedValue([])
  spend.getSpendRecordsBetween.mockResolvedValue([])
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
