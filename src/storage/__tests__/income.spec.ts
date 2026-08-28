// 손입력 수입 어댑터([[ADR-170]] 결정 1·2).
//
// `boss-profit.spec.ts` 와 같은 방식으로 **DB 커넥션만** 가짜로 바꾼다 — SQL 문자열과 파라미터
// 순서가 검증 대상이라 그 위를 목으로 덮으면 안 된다.
import type { IncomeRecord } from '../income'

jest.mock('../sqlite/db', () => ({
  getBossProfitDb: jest.fn(),
}))
const { getBossProfitDb: getBossProfitDbMock } = jest.requireMock('../sqlite/db') as Record<
  string,
  jest.Mock
>

const runMock = jest.fn()
const queryMock = jest.fn()
const fakeDb = { run: runMock, query: queryMock }

beforeEach(() => {
  runMock.mockReset().mockResolvedValue({ changes: { changes: 1 } })
  queryMock.mockReset().mockResolvedValue({ values: [] })
  getBossProfitDbMock.mockReset().mockResolvedValue(fakeDb)
})

const sample: IncomeRecord = {
  id: 'inc-1',
  // 계산기 이전의 행 — 사냥 칸 여섯이 없다([[ADR-175]] 결정 9).
  hunt: null,
  ocid: null,
  earnedOn: '2026-08-23',
  category: '아이템 판매',
  item: '앱솔랩스 케이프',
  mesoAmount: 1_200_000_000,
  saleFeePercent: null,
  saleFeeMeso: null,
  pointAmount: null,
  pointPer100mMeso: null,
  cashAmount: null,
  memo: null,
  recordedAt: '2026-08-23T05:00:00.000Z',
}

describe('insertIncomeRecord', () => {
  it('대리키로 넣는다 — 같은 날 같은 것을 두 번 팔아도 서로 다른 행이다', async () => {
    const { insertIncomeRecord } = require('../income') as typeof import('../income')

    await insertIncomeRecord(sample)
    await insertIncomeRecord({ ...sample, id: 'inc-2' })

    expect(runMock).toHaveBeenCalledTimes(2)
    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('INSERT INTO income_records')
    // **ON CONFLICT 가 없다** — 자연키가 없으므로 덮어쓸 대상이 애초에 없다([[ADR-170]] 결정 2).
    expect(sql).not.toContain('ON CONFLICT')
    expect(values).toEqual([
      'inc-1',
      null,
      '2026-08-23',
      '아이템 판매',
      '앱솔랩스 케이프',
      1_200_000_000,
      null,
      null,
      // 통화 칸 셋([[ADR-170]] 정정 15) — 메소로 번 것이라 셋 다 비어 있다.
      null,
      null,
      null,
      // 사냥 계산 입력 여섯([[ADR-175]] 결정 9) — 아이템 판매라 전부 비어 있다.
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      '2026-08-23T05:00:00.000Z',
    ])
  })

  it('캐릭터를 고르면 그 ocid 가 붙는다 — 기본은 계정 단위(NULL)다', async () => {
    const { insertIncomeRecord } = require('../income') as typeof import('../income')

    await insertIncomeRecord({ ...sample, ocid: 'ocid-1' })

    expect(runMock.mock.calls[0][1][1]).toBe('ocid-1')
  })
})

describe('getIncomeRecordsBetween', () => {
  it('두 끝을 포함하는 날짜 범위를 묻는다', async () => {
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    const [sql, parameters] = queryMock.mock.calls[0]
    expect(sql).toContain('FROM income_records')
    expect(sql).toContain('earned_on BETWEEN ? AND ?')
    expect(parameters).toEqual(['2026-08-20', '2026-08-26'])
  })

  // 가계부는 «내가 번 돈» 이지 «이 캐릭터가 번 돈» 이 아니다([[ADR-166]] 결정 3) — 계정 단위 행과
  // 캐릭터 행이 한 날에 함께 서야 하므로 ocid 로 거르지 않는다.
  it('ocid 로 거르지 않는다', async () => {
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    expect(queryMock.mock.calls[0][0]).not.toContain('ocid')
  })

  it('행을 레코드로 옮긴다 — 빈 칸은 null 로 정규화한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          ocid: null,
          earned_on: '2026-08-23',
          category: '사냥',
          item: '엘리시움',
          meso_amount: 1_200_000_000,
          memo: undefined,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
      ],
    })
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    const records = await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    expect(records).toEqual([
      {
        id: 'inc-1',
        ocid: null,
        earnedOn: '2026-08-23',
        category: '사냥',
        item: '엘리시움',
        mesoAmount: 1_200_000_000,
        saleFeePercent: null,
        saleFeeMeso: null,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        // `hunt_missed_mobs` 가 없으면 계산기로 적힌 행이 아니다([[ADR-175]] 결정 9).
        hunt: null,
        memo: null,
        recordedAt: '2026-08-23T05:00:00.000Z',
      },
    ])
  })

  it('값이 없으면 빈 배열이다 — undefined 를 흘리지 않는다', async () => {
    queryMock.mockResolvedValue({})
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    expect(await getIncomeRecordsBetween('2026-08-20', '2026-08-26')).toEqual([])
  })
})

describe('INCOME_CATEGORIES', () => {
  // [[ADR-170]] 결정 1 — 사용자가 준 둘 + 안전망 하나. 「기타」가 없으면 갈래가 안 잡히는 수입이
  // 기록 자체를 못 남긴다.
  it('사용자가 준 갈래 둘과 안전망 「기타」다', () => {
    const { INCOME_CATEGORIES } = require('../income') as typeof import('../income')

    expect(INCOME_CATEGORIES).toEqual(['아이템 판매', '사냥', '기타'])
  })
})


// [[ADR-171]] 결정 4·6 — 지출과 같은 계약이다.
describe('updateIncomeRecord', () => {
  it('id 로 갈아 끼운다 — 지우고 다시 넣지 않는다', async () => {
    const { updateIncomeRecord } = require('../income') as typeof import('../income')

    await updateIncomeRecord({ ...sample, mesoAmount: 999 })

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('UPDATE income_records')
    expect(sql).toContain('WHERE id = ?')
    expect(sql).not.toContain('DELETE')
    expect(values[values.length - 1]).toBe('inc-1')
  })

  it('recorded_at 을 SET 에 안 넣는다', async () => {
    const { updateIncomeRecord } = require('../income') as typeof import('../income')

    await updateIncomeRecord(sample)

    const [sql] = runMock.mock.calls[0]
    expect(sql.slice(0, sql.indexOf('WHERE'))).not.toContain('recorded_at')
  })
})

describe('deleteIncomeRecord', () => {
  it('id 하나만 지운다', async () => {
    const { deleteIncomeRecord } = require('../income') as typeof import('../income')

    await deleteIncomeRecord('inc-1')

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('DELETE FROM income_records')
    expect(sql).toContain('WHERE id = ?')
    expect(values).toEqual(['inc-1'])
  })
})

/**
 * **받는 돈과 뗀 몫이 둘 다 행에 남는다**([[ADR-170]] 정정 9 ⑤).
 *
 * `meso_amount` 는 수수료를 **뗀** 값이다 — 캘린더도 합계도 이 칸 하나를 더하므로 판매 대금을
 * 넣으면 번 적 없는 돈이 수입으로 선다.
 */
describe('판매 수수료 칸 둘 ([[ADR-170]] 정정 9)', () => {
  const 수수료낸판매: IncomeRecord = {
    ...sample,
    mesoAmount: 1_140_000_000,
    saleFeePercent: 5,
    saleFeeMeso: 60_000_000,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
  }

  it('넣을 때 함께 박는다', async () => {
    const { insertIncomeRecord } = require('../income') as typeof import('../income')

    await insertIncomeRecord(수수료낸판매)

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('sale_fee_percent')
    expect(sql).toContain('sale_fee_meso')
    expect(values).toContain(5)
    expect(values).toContain(60_000_000)
    // 집계가 보는 칸은 **받는 돈**이다 — 판매 대금(12억)이 아니다.
    expect(values).toContain(1_140_000_000)
  })

  it('고칠 때도 함께 간다 — 요율을 바꾸면 행의 몫도 바뀐다', async () => {
    const { updateIncomeRecord } = require('../income') as typeof import('../income')

    await updateIncomeRecord(수수료낸판매)

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('sale_fee_percent = ?')
    expect(sql).toContain('sale_fee_meso = ?')
    expect(values).toContain(60_000_000)
  })

  it('읽을 때 되살린다 — 없으면 null 이다', async () => {
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          ocid: null,
          earned_on: '2026-08-23',
          category: '아이템 판매',
          item: '앱솔랩스 케이프',
          meso_amount: 1_140_000_000,
          sale_fee_percent: 5,
          sale_fee_meso: 60_000_000,
          memo: null,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
        // 정정 9 **이전에 적힌 행** — 칸이 아예 없다. `undefined` 를 `null` 로 접어 화면이 한
        // 형태만 다루게 한다(이 파일의 다른 칸들과 같은 처리).
        {
          id: 'inc-0',
          ocid: null,
          earned_on: '2026-08-22',
          category: '아이템 판매',
          item: null,
          meso_amount: 500_000_000,
          memo: null,
          recorded_at: '2026-08-22T05:00:00.000Z',
        },
      ],
    })

    const [있는것, 옛것] = await getIncomeRecordsBetween('2026-08-01', '2026-08-31')

    expect(있는것.saleFeePercent).toBe(5)
    expect(있는것.saleFeeMeso).toBe(60_000_000)
    expect(옛것.saleFeePercent).toBeNull()
    expect(옛것.saleFeeMeso).toBeNull()
  })
})
