// 지출 어댑터.
import spendCatalog from '../../data/spend-catalog.json'
import { SPEND_CATEGORIES } from '../../lib/cashbook/categories'
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

/** 메소로 낸 것. 통화 칸 셋 중 하나만 찬다. */
const mesoSpend: SpendRecord = {
  id: 'spd-1',
  ocid: null,
  spentOn: '2026-08-23',
  category: 'buff',
  item: '세이람의 영약',
  itemKey: 'seiram_elixir',
  formItemKeys: null,
  itemKind: null,
  levelFrom: null,
  levelTo: null,
  quantity: 1,
  mesoAmount: 2_000_000,
  tariffMeso: null,
  pointAmount: null,
  pointPer100mMeso: null,
  cashAmount: null,
  memo: null,
  recordedAt: '2026-08-23T05:00:00.000Z',
}

/** 메포로 낸 것. 시세가 **반드시** 함께 온다. */
const pointSpend: SpendRecord = {
  ...mesoSpend,
  id: 'spd-2',
  category: 'content',
  item: '몬스터 파크',
  itemKey: 'monster_park',
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
      // 갈래는 그때 이름과 key 를 함께 적는다. 이름은 key 를 못 찾을 때 서는 글자다.
      '버프',
      'buff',
      '세이람의 영약',
      'seiram_elixir',
      // 옛 형태 칸은 더 안 쓴다. 형태는 아래 형태별 항목 key 가 든다.
      null,
      null,
      // 종류는 `아이템 구매`의 것이다. 다른 갈래에서는 NULL 이다.
      null,
      null,
      1,
      2_000_000,
      null,
      null,
      null,
      null,
      null,
      '2026-08-23T05:00:00.000Z',
      // 레벨 두 칸은 심볼 강화의 것이다. 다른 갈래에서는 NULL 이다.
      null,
      null,
    ])
  })

  it('심볼 강화는 강화 전 · 강화 후 레벨을 끝의 두 칸에 적는다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    await insertSpendRecord({
      ...mesoSpend,
      category: 'symbol',
      item: '소멸의 여로 Lv.3 → 7',
      itemKey: 'road_of_vanishing',
      levelFrom: 3,
      levelTo: 7,
      quantity: null,
      mesoAmount: 7_700_000,
    })

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('level_from, level_to')
    expect(values.slice(3, 5)).toEqual(['심볼 강화', 'symbol'])
    expect(values.slice(-2)).toEqual([3, 7])
  })

  it('에픽던전 리워드는 형태별 항목 key 를 JSON 한 칸에 적는다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    await insertSpendRecord({
      ...pointSpend,
      item: '하이마운틴 EXP 2단계, 솔 1단계',
      itemKey: null,
      formItemKeys: { exp: 'high_mountain_2', sol_erda: 'high_mountain_1' },
    })

    const values = runMock.mock.calls[0][1]
    expect(values[6]).toBeNull()
    expect(JSON.parse(values[8])).toEqual({ exp: 'high_mountain_2', sol_erda: 'high_mountain_1' })
  })

  it('아이템 구매 종류는 이름과 key 를 함께 적는다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    await insertSpendRecord({ ...mesoSpend, category: 'item_purchase', item: '주문서', itemKey: null, itemKind: 'consumable' })

    const values = runMock.mock.calls[0][1]
    expect(values.slice(3, 5)).toEqual(['아이템 구매', 'item_purchase'])
    expect(values.slice(9, 11)).toEqual(['소비', 'consumable'])
  })

  it('관세는 총액과 그 안의 몫을 **둘 다** 박는다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    // 구입가 8.5억 + 관세 10% = 9.35억. meso_amount 는 **총액**이라 집계가 한 칸만 보면 된다.
    await insertSpendRecord({
      ...mesoSpend,
      category: 'item_purchase',
      item: '앱솔랩스 슈즈',
      itemKey: null,
      itemKind: 'equipment',
      mesoAmount: 935_000_000,
      tariffMeso: 85_000_000,
    })

    const values = runMock.mock.calls[0][1]
    expect(values[12]).toBe(935_000_000)
    expect(values[13]).toBe(85_000_000)
  })
})

// 시세 없이 저장하면 그 행은 영영 메소로 표시할 수 없는 행이 된다.
// 화면이 막더라도 저장소가 한 번 더 막는다.
describe('메포 지출의 시세 요구', () => {
  it('시세가 없으면 저장하지 않고 던진다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    await expect(insertSpendRecord({ ...pointSpend, pointPer100mMeso: null })).rejects.toThrow(
      /시세/,
    )
    expect(runMock).not.toHaveBeenCalled()
  })

  // 환산이 나눗셈이라 0 이면 화면이 깨진다(메포 × 1억 ÷ 시세).
  it('시세가 0 이하면 던진다. 환산이 나눗셈이다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    await expect(insertSpendRecord({ ...pointSpend, pointPer100mMeso: 0 })).rejects.toThrow(/시세/)
    expect(runMock).not.toHaveBeenCalled()
  })

  it('시세가 있으면 그대로 넣는다', async () => {
    const { insertSpendRecord } = require('../spend') as typeof import('../spend')

    await insertSpendRecord(pointSpend)

    const values = runMock.mock.calls[0][1]
    expect(values[14]).toBe(30_000)
    expect(values[15]).toBe(1_180)
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

  it('행을 레코드로 옮긴다. 빈 칸은 null 로 정규화한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'spd-2',
          ocid: undefined,
          spent_on: '2026-08-23',
          category: '컨텐츠',
          category_key: 'content',
          item: '몬스터 파크',
          item_key: 'monster_park',
          form: undefined,
          form_item_keys: null,
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

  /**
   * **종류는 칸 하나로 왕복한다**. 이름이 어긋나면 타입 에러 없이
   * 소비로 적은 행이 **장비로 열리고**(NULL → 장비) 수량 줄이 사라진다.
   */
  it('종류를 그대로 되읽는다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'spd-3',
          ocid: null,
          spent_on: '2026-08-28',
          category: '아이템 구매',
          category_key: 'item_purchase',
          item: '주문서',
          item_key: null,
          form: null,
          form_item_keys: null,
          item_kind: '소비',
          item_kind_key: 'consumable',
          quantity: 300,
          meso_amount: 3_600_000,
          tariff_meso: null,
          point_amount: null,
          point_per_100m_meso: null,
          cash_amount: null,
          memo: null,
          recorded_at: '2026-08-28T05:00:00.000Z',
        },
      ],
    })
    const { getSpendRecordsBetween } = require('../spend') as typeof import('../spend')

    const [row] = await getSpendRecordsBetween('2026-08-01', '2026-08-31')
    expect(row).toMatchObject({ category: 'item_purchase', itemKind: 'consumable', quantity: 300, mesoAmount: 3_600_000 })
  })

  it('형태별 항목 key 는 JSON 을 풀어 되읽는다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'spd-4',
          ocid: null,
          spent_on: '2026-09-01',
          category: '컨텐츠',
          category_key: 'content',
          item: '하이마운틴 솔 2단계',
          item_key: null,
          form: null,
          form_item_keys: '{"sol_erda":"high_mountain_2"}',
          item_kind: null,
          item_kind_key: null,
          quantity: 1,
          meso_amount: null,
          tariff_meso: null,
          point_amount: 30_000,
          point_per_100m_meso: 1_180,
          cash_amount: null,
          memo: null,
          recorded_at: '2026-09-01T05:00:00.000Z',
        },
      ],
    })
    const { getSpendRecordsBetween } = require('../spend') as typeof import('../spend')

    const [row] = await getSpendRecordsBetween('2026-09-01', '2026-09-30')
    expect(row).toMatchObject({ itemKey: null, formItemKeys: { sol_erda: 'high_mountain_2' } })
  })

  it('심볼 강화의 두 레벨을 되읽는다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'spd-5',
          ocid: null,
          spent_on: '2026-09-19',
          category: '심볼 강화',
          category_key: 'symbol',
          item: '소멸의 여로 Lv.3 → 7',
          item_key: 'road_of_vanishing',
          form: null,
          form_item_keys: null,
          item_kind: null,
          item_kind_key: null,
          level_from: 3,
          level_to: 7,
          quantity: null,
          meso_amount: 7_700_000,
          tariff_meso: null,
          point_amount: null,
          point_per_100m_meso: null,
          cash_amount: null,
          memo: null,
          recorded_at: '2026-09-19T05:00:00.000Z',
        },
      ],
    })
    const { getSpendRecordsBetween } = require('../spend') as typeof import('../spend')

    const [row] = await getSpendRecordsBetween('2026-09-01', '2026-09-30')
    expect(row).toMatchObject({ category: 'symbol', itemKey: 'road_of_vanishing', levelFrom: 3, levelTo: 7, quantity: null })
  })

  it('값이 없으면 빈 배열이다', async () => {
    queryMock.mockResolvedValue({})
    const { getSpendRecordsBetween } = require('../spend') as typeof import('../spend')

    expect(await getSpendRecordsBetween('2026-08-01', '2026-08-31')).toEqual([])
  })
})

describe('SPEND_CATEGORIES 와 카탈로그', () => {
  // 갈래 key 가 **두 곳**에 산다. 목록을 갖는 넷은 카탈로그에도 있다. 어긋나면 고른 항목의 갈래가
  // 기록의 갈래와 달라진다.
  it('카탈로그가 아는 넷을 그대로 품는다', () => {
    const keys = SPEND_CATEGORIES.map((each) => each.key)

    for (const category of spendCatalog.categories) {
      expect(keys).toContain(category)
    }
  })

  // 나머지 둘은 **직접 입력**이라 카탈로그에 항목이 없다.
  it('직접 입력 둘은 카탈로그에 없다', () => {
    expect(spendCatalog.categories).not.toContain('item_purchase')
    expect(spendCatalog.categories).not.toContain('etc')
  })
})


// 적은 것은 되돌릴 수 있어야 한다.
describe('updateSpendRecord', () => {
  it('id 로 갈아 끼운다. 지우고 다시 넣지 않는다', async () => {
    const { updateSpendRecord } = require('../spend') as typeof import('../spend')

    await updateSpendRecord({ ...mesoSpend, quantity: 3, mesoAmount: 6_000_000 })

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('UPDATE spend_records')
    expect(sql).toContain('WHERE id = ?')
    expect(sql).not.toContain('DELETE')
    // **마지막 인자가 id 다**. WHERE 가 SET 뒤에 오므로.
    expect(values[values.length - 1]).toBe('spd-1')
  })

  // `recordedAt` 은 `적은 시각`이지 `마지막으로 만진 시각`이 아니다.
  it('recorded_at 을 SET 에 안 넣는다', async () => {
    const { updateSpendRecord } = require('../spend') as typeof import('../spend')

    await updateSpendRecord(mesoSpend)

    const [sql] = runMock.mock.calls[0]
    expect(sql.slice(0, sql.indexOf('WHERE'))).not.toContain('recorded_at')
  })

  it('두 레벨도 고친다. 수정 시트에서 손잡이를 옮길 수 있다', async () => {
    const { updateSpendRecord } = require('../spend') as typeof import('../spend')

    await updateSpendRecord({ ...mesoSpend, category: 'symbol', levelFrom: 2, levelTo: 9 })

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('level_from = ?, level_to = ?')
    expect(values.slice(-3)).toEqual([2, 9, 'spd-1'])
  })

  // 수정으로 시세 없는 메포 행을 만들 수 있으면 저장소의 방어가 반쪽이 된다.
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
