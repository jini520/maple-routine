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
  ocid: null,
  earnedOn: '2026-08-23',
  category: '아이템 판매',
  item: '앱솔랩스 케이프',
  mesoAmount: 1_200_000_000,
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
