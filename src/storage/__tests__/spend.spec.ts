// 지출 어댑터([[ADR-166]] · [[ADR-170]] 결정 2).
import spendCatalog from '../../data/spend-catalog.json'
import type { SpendRecord } from '../spend'

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

/** 메소로 낸 것 — 통화 칸 셋 중 하나만 찬다. */
const mesoSpend: SpendRecord = {
  id: 'spd-1',
  ocid: null,
  spentOn: '2026-08-23',
  category: '버프',
  item: '세이람의 영약',
  form: null,
  quantity: 1,
  mesoAmount: 2_000_000,
  tariffMeso: null,
  pointAmount: null,
  pointPer100mMeso: null,
  cashAmount: null,
  memo: null,
  recordedAt: '2026-08-23T05:00:00.000Z',
}

/** 메포로 낸 것 — 시세가 **반드시** 함께 온다([[ADR-166]] 정정 2 ③). */
const pointSpend: SpendRecord = {
  ...mesoSpend,
  id: 'spd-2',
  category: '컨텐츠',
  item: '하이마운틴 2단계',
  mesoAmount: null,
  pointAmount: 30_000,
  pointPer100mMeso: 1_180,
}

describe('insertSpendRecord', () => {
  it('안 쓴 통화 칸은 NULL 로 넣는다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    await insertSpendRecord(mesoSpend)

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('INSERT INTO spend_records')
    expect(sql).not.toContain('ON CONFLICT')
    expect(values).toEqual([
      'spd-1',
      null,
      '2026-08-23',
      '버프',
      '세이람의 영약',
      null,
      1,
      2_000_000,
      null,
      null,
      null,
      null,
      null,
      '2026-08-23T05:00:00.000Z',
    ])
  })

  it('관세는 총액과 그 안의 몫을 **둘 다** 박는다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    // 구입가 8.5억 + 관세 10% = 9.35억. meso_amount 는 **총액**이라 집계가 한 칸만 보면 된다.
    await insertSpendRecord({
      ...mesoSpend,
      category: '아이템 구매',
      item: '앱솔랩스 슈즈',
      mesoAmount: 935_000_000,
      tariffMeso: 85_000_000,
    })

    const values = runMock.mock.calls[0][1]
    expect(values[7]).toBe(935_000_000)
    expect(values[8]).toBe(85_000_000)
  })
})

// [[ADR-166]] 정정 2 ③ — 시세 없이 저장하면 그 행은 **영영 메소로 표시할 수 없는 행**이 된다
// (결정 5 가 환율을 행에 박으므로 나중에 채울 수도 없다). 화면이 막더라도 저장소가 한 번 더 막는다.
describe('메포 지출의 시세 요구', () => {
  it('시세가 없으면 저장하지 않고 던진다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    await expect(insertSpendRecord({ ...pointSpend, pointPer100mMeso: null })).rejects.toThrow(
      /시세/,
    )
    expect(runMock).not.toHaveBeenCalled()
  })

  // 환산이 나눗셈이라 0 이면 화면이 깨진다([[ADR-166]] 정정 2 ④ — 메포 × 1억 ÷ 시세).
  it('시세가 0 이하면 던진다 — 환산이 나눗셈이다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    await expect(insertSpendRecord({ ...pointSpend, pointPer100mMeso: 0 })).rejects.toThrow(/시세/)
    expect(runMock).not.toHaveBeenCalled()
  })

  it('시세가 있으면 그대로 넣는다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    await insertSpendRecord(pointSpend)

    const values = runMock.mock.calls[0][1]
    expect(values[9]).toBe(30_000)
    expect(values[10]).toBe(1_180)
  })

  it('메포를 안 썼으면 시세를 안 물어본다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    await expect(insertSpendRecord(mesoSpend)).resolves.toBeUndefined()
  })
})

describe('getSpendRecordsBetween', () => {
  it('두 끝을 포함하는 날짜 범위를 묻는다', async () => {
    const { getSpendRecordsBetween } = require('../spend') as typeof import('../spend')

    await getSpendRecordsBetween('2026-08-01', '2026-08-31')

    const [sql, parameters] = queryMock.mock.calls[0]
    expect(sql).toContain('FROM spend_records')
    expect(sql).toContain('spent_on BETWEEN ? AND ?')
    expect(parameters).toEqual(['2026-08-01', '2026-08-31'])
  })

  it('행을 레코드로 옮긴다 — 빈 칸은 null 로 정규화한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'spd-2',
          ocid: undefined,
          spent_on: '2026-08-23',
          category: '컨텐츠',
          item: '하이마운틴 2단계',
          form: undefined,
          quantity: 1,
          meso_amount: null,
          tariff_meso: null,
          point_amount: 30_000,
          point_per_100m_meso: 1_180,
          cash_amount: null,
          memo: null,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
      ],
    })
    const { getSpendRecordsBetween } = require('../spend') as typeof import('../spend')

    expect(await getSpendRecordsBetween('2026-08-01', '2026-08-31')).toEqual([pointSpend])
  })

  it('값이 없으면 빈 배열이다', async () => {
    queryMock.mockResolvedValue({})
    const { getSpendRecordsBetween } = require('../spend') as typeof import('../spend')

    expect(await getSpendRecordsBetween('2026-08-01', '2026-08-31')).toEqual([])
  })
})

describe('SPEND_CATEGORIES', () => {
  it('[[ADR-166]] 정정 1 ② 의 다섯이다', () => {
    const { SPEND_CATEGORIES } = require('../spend') as typeof import('../spend')

    expect(SPEND_CATEGORIES).toEqual(['컨텐츠', '이벤트·BM', '버프', '아이템 구매', '기타'])
  })

  // 갈래 이름이 **두 곳**에 산다 — 목록을 갖는 셋은 카탈로그에도 있다. 어긋나면 고른 항목의
  // 카테고리가 레코드의 카테고리와 달라져 집계에서 조용히 빠진다.
  it('카탈로그가 아는 셋을 그대로 품는다', () => {
    const { SPEND_CATEGORIES } = require('../spend') as typeof import('../spend')

    for (const category of spendCatalog.categories) {
      expect(SPEND_CATEGORIES).toContain(category)
    }
  })

  // 나머지 둘은 **직접 입력**이라 카탈로그에 항목이 없다([[ADR-166]] 정정 1 ②).
  it('직접 입력 둘은 카탈로그에 없다', () => {
    expect(spendCatalog.categories).not.toContain('아이템 구매')
    expect(spendCatalog.categories).not.toContain('기타')
  })
})


// [[ADR-171]] 결정 4·6 — 적은 것은 되돌릴 수 있어야 한다.
describe('updateSpendRecord', () => {
  it('id 로 갈아 끼운다 — 지우고 다시 넣지 않는다', async () => {
    const { updateSpendRecord } = require('../spend') as typeof import('../spend')

    await updateSpendRecord({ ...mesoSpend, quantity: 3, mesoAmount: 6_000_000 })

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('UPDATE spend_records')
    expect(sql).toContain('WHERE id = ?')
    expect(sql).not.toContain('DELETE')
    // **마지막 인자가 id 다** — WHERE 가 SET 뒤에 오므로.
    expect(values[values.length - 1]).toBe('spd-1')
  })

  // `recordedAt` 은 「적은 시각」이지 「마지막으로 만진 시각」이 아니다([[ADR-171]] 결정 4).
  it('recorded_at 을 SET 에 안 넣는다', async () => {
    const { updateSpendRecord } = require('../spend') as typeof import('../spend')

    await updateSpendRecord(mesoSpend)

    const [sql] = runMock.mock.calls[0]
    expect(sql.slice(0, sql.indexOf('WHERE'))).not.toContain('recorded_at')
  })

  // 수정으로 시세 없는 메포 행을 만들 수 있으면 정정 2 ③ 의 방어가 반쪽이 된다.
  it('시세 없는 메포 행으로는 못 고친다', async () => {
    const { updateSpendRecord } = require('../spend') as typeof import('../spend')

    await expect(
      updateSpendRecord({ ...pointSpend, pointPer100mMeso: null }),
    ).rejects.toThrow('메소마켓 시세')
    expect(runMock).not.toHaveBeenCalled()
  })
})

describe('deleteSpendRecord', () => {
  it('id 하나만 지운다', async () => {
    const { deleteSpendRecord } = require('../spend') as typeof import('../spend')

    await deleteSpendRecord('spd-1')

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('DELETE FROM spend_records')
    expect(sql).toContain('WHERE id = ?')
    expect(values).toEqual(['spd-1'])
  })
})
