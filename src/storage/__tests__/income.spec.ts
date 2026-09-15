// 손입력 수입 어댑터.
//
// `boss-profit.spec.ts` 와 같은 방식으로 **DB 커넥션만** 가짜로 바꾼다. SQL 문자열과 파라미터
// 순서가 검증 대상이라 그 위를 목으로 덮으면 안 된다.
import type { HuntingCalculatorDetail, HuntingManualDetail, IncomeRecord } from '../income'

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
  // 계산기 이전의 행. 사냥 칸 여섯이 없다.
  hunt: null,
  quantity: null,
  ocid: null,
  earnedOn: '2026-08-23',
  category: 'item_sale',
  item: '앱솔랩스 케이프',
  itemKey: null,
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
  it('대리키로 넣는다. 같은 날 같은 것을 두 번 팔아도 서로 다른 행이다', async () => {
    const { insertIncomeRecord } = require('../income') as typeof import('../income')

    await insertIncomeRecord(sample)
    await insertIncomeRecord({ ...sample, id: 'inc-2' })

    expect(runMock).toHaveBeenCalledTimes(2)
    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('INSERT INTO income_records')
    // **ON CONFLICT 가 없다**. 자연키가 없으므로 덮어쓸 대상이 애초에 없다.
    expect(sql).not.toContain('ON CONFLICT')
    expect(values).toEqual([
      'inc-1',
      null,
      '2026-08-23',
      // 갈래는 그때 이름과 key 를 함께 적는다. 사냥터 key 는 사냥 갈래만 든다.
      '아이템 판매',
      'item_sale',
      '앱솔랩스 케이프',
      null,
      1_200_000_000,
      null,
      null,
      // 통화 칸 셋. 메소로 번 것이라 셋 다 비어 있다.
      null,
      null,
      null,
      // 수량. `기타`가 아니라 비어 있다.
      null,
      // 사냥 칸 아홉(조각 가격 나중에 입력 포함). 아이템
      // 판매라 전부 비어 있다.
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      // memo
      null,
      '2026-08-23T05:00:00.000Z',
    ])
  })

  it('캐릭터를 고르면 그 ocid 가 붙는다. 기본은 계정 단위(NULL)다', async () => {
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

  // 가계부는 **내가 번 돈** 이지 **이 캐릭터가 번 돈** 이 아니다. 계정 단위 행과
  // 캐릭터 행이 한 날에 함께 서야 하므로 ocid 로 거르지 않는다.
  it('ocid 로 거르지 않는다', async () => {
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    expect(queryMock.mock.calls[0][0]).not.toContain('ocid')
  })

  it('행을 레코드로 옮긴다. 빈 칸은 null 로 정규화한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          ocid: null,
          earned_on: '2026-08-23',
          category: '사냥',
          category_key: 'hunting',
          item: '엘리시움',
          item_key: null,
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
        category: 'hunting',
        item: '엘리시움',
        itemKey: null,
        mesoAmount: 1_200_000_000,
        saleFeePercent: null,
        saleFeeMeso: null,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        // `hunt_missed_mobs` 가 없으면 계산기로 적힌 행이 아니다.
        hunt: null,
        quantity: null,
        memo: null,
        recordedAt: '2026-08-23T05:00:00.000Z',
      },
    ])
  })

  it('값이 없으면 빈 배열이다. undefined 를 흘리지 않는다', async () => {
    queryMock.mockResolvedValue({})
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    expect(await getIncomeRecordsBetween('2026-08-20', '2026-08-26')).toEqual([])
  })
})



// 지출과 같은 계약이다.
describe('updateIncomeRecord', () => {
  it('id 로 갈아 끼운다. 지우고 다시 넣지 않는다', async () => {
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
 * **받는 돈과 뗀 몫이 둘 다 행에 남는다**.
 *
 * `meso_amount` 는 수수료를 **뗀** 값이다. 캘린더도 합계도 이 칸 하나를 더하므로 판매 대금을
 * 넣으면 번 적 없는 돈이 수입으로 선다.
 */
describe('판매 수수료 칸 둘', () => {
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
    // 집계가 보는 칸은 **받는 돈**이다. 판매 대금(12억)이 아니다.
    expect(values).toContain(1_140_000_000)
  })

  it('고칠 때도 함께 간다. 요율을 바꾸면 행의 몫도 바뀐다', async () => {
    const { updateIncomeRecord } = require('../income') as typeof import('../income')

    await updateIncomeRecord(수수료낸판매)

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('sale_fee_percent = ?')
    expect(sql).toContain('sale_fee_meso = ?')
    expect(values).toContain(60_000_000)
  })

  it('읽을 때 되살린다. 없으면 null 이다', async () => {
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          ocid: null,
          earned_on: '2026-08-23',
          category: '아이템 판매',
          category_key: 'item_sale',
          item: '앱솔랩스 케이프',
          item_key: null,
          meso_amount: 1_140_000_000,
          sale_fee_percent: 5,
          sale_fee_meso: 60_000_000,
          memo: null,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
        // 수수료 칸이 생기기 전에 적힌 행. 칸이 아예 없다. `undefined` 를 `null` 로 접어
        // 화면이 한 형태만 다루게 한다.
        {
          id: 'inc-0',
          ocid: null,
          earned_on: '2026-08-22',
          category: '아이템 판매',
          category_key: 'item_sale',
          item: null,
          item_key: null,
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

// 메소 획득량 칸
describe('hunt_meso_rate: 그때의 메소 획득량', () => {
  const 계산기입력: HuntingCalculatorDetail = {
    mode: 'calculator',
    characterLevel: 294,
    missedMobs: 1,
    boosts: ['union', 'potion'],
    sojae: 2,
    fragments: 83,
    fragmentPrice: 8_000_000,
    fragmentsDeferred: false,
    mesoRate: 149,
  }
  const 계산기행: IncomeRecord = {
    ...sample,
    category: 'hunting',
    item: '밤의 길 3',
    itemKey: 'tallahart_road_of_night_3',
    hunt: 계산기입력,
  }

  it('넣을 때 칸 일곱째로 실린다', async () => {
    const { insertIncomeRecord } = require('../income') as typeof import('../income')

    await insertIncomeRecord(계산기행)

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('hunt_meso_rate')
    // 사냥 칸 일곱이 나란히 간다. 레벨· 놓침· 아이템· 소재· 조각· 조각가· **메획**.
    expect(values).toEqual(expect.arrayContaining([294, 1, 'union,potion', 2, 83, 8_000_000, 149]))
  })

  it('고칠 때도 함께 갈아 끼운다', async () => {
    const { updateIncomeRecord } = require('../income') as typeof import('../income')

    await updateIncomeRecord({ ...계산기행, hunt: { ...계산기입력, mesoRate: 161 } })

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('hunt_meso_rate = ?')
    expect(values).toEqual(expect.arrayContaining([161]))
  })

  it('다른 갈래의 행은 그 칸도 null 이다', async () => {
    const { insertIncomeRecord } = require('../income') as typeof import('../income')

    await insertIncomeRecord(sample)

    const [, values] = runMock.mock.calls[0]
    // 사냥 칸 일곱이 전부 null 이다.
    expect(values.filter((each: unknown) => each === null).length).toBeGreaterThanOrEqual(7)
  })

  //  이전에 적힌 계산기 행. 그때는 메획이 계산에 없었다.
  it('NULL 은 0 으로 읽는다. 없는 값을 지어내지 않는다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          ocid: null,
          earned_on: '2026-08-23',
          category: '사냥',
          category_key: 'hunting',
          item: '밤의 길 3',
          item_key: 'tallahart_road_of_night_3',
          meso_amount: 1_200_000_000,
          hunt_character_level: 294,
          hunt_missed_mobs: 1,
          hunt_boosts: 'union',
          hunt_sojae: 2,
          hunt_fragments: 0,
          hunt_fragment_price: 0,
          hunt_meso_rate: null,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
      ],
    })
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    const [record] = await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    expect(record.hunt).toMatchObject({ mode: 'calculator', mesoRate: 0 })
  })

  it('값이 있으면 그대로 읽는다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          earned_on: '2026-08-23',
          category: '사냥',
          category_key: 'hunting',
          item: '밤의 길 3',
          item_key: 'tallahart_road_of_night_3',
          meso_amount: 1_200_000_000,
          hunt_missed_mobs: 0,
          hunt_meso_rate: 149,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
      ],
    })
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    const [record] = await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    expect(record.hunt).toMatchObject({ mode: 'calculator', mesoRate: 149 })
  })
})

// 수동 입력 칸
describe('hunt_typed_meso: 수동으로 적힌 사냥', () => {
  const 수동입력: HuntingManualDetail = {
    mode: 'manual',
    typedMeso: 1_000_000_000,
    fragments: 83,
    fragmentPrice: 8_000_000,
    fragmentsDeferred: false,
  }
  const 수동행: IncomeRecord = {
    ...sample,
    category: 'hunting',
    item: null,
    itemKey: null,
    mesoAmount: 1_664_000_000,
    hunt: 수동입력,
  }

  it('계산기 칸을 비우고 친 메소만 싣는다', async () => {
    const { insertIncomeRecord } = require('../income') as typeof import('../income')

    await insertIncomeRecord(수동행)

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('hunt_typed_meso')
    // 사냥 칸 여덟. 레벨· 놓침· 아이템· 소재· 조각· 조각가· 메획· **친 메소**.
    // 계산기 칸 넷이 null 인 것이 **앱이 센 값이 아니다** 를 말한다.
    expect(values.slice(14, 22)).toEqual([
      null,
      null,
      null,
      null,
      83,
      8_000_000,
      null,
      1_000_000_000,
    ])
  })

  it('고칠 때도 함께 갈아 끼운다', async () => {
    const { updateIncomeRecord } = require('../income') as typeof import('../income')

    await updateIncomeRecord({ ...수동행, hunt: { ...수동입력, typedMeso: 2_000_000_000 } })

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('hunt_typed_meso = ?')
    expect(values).toEqual(expect.arrayContaining([2_000_000_000]))
  })

  it('값이 있으면 수동으로 읽는다. 계산기 칸을 안 본다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          earned_on: '2026-08-23',
          category: '사냥',
          category_key: 'hunting',
          item: null,
          item_key: null,
          meso_amount: 1_664_000_000,
          hunt_missed_mobs: null,
          hunt_fragments: 83,
          hunt_fragment_price: 8_000_000,
          hunt_typed_meso: 1_000_000_000,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
      ],
    })
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    const [record] = await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    expect(record.hunt).toEqual({
      mode: 'manual',
      typedMeso: 1_000_000_000,
      fragmentsDeferred: false,
      fragments: 83,
      fragmentPrice: 8_000_000,
    })
  })

  // 조각을 안 넣은 수동 행. 합계가 곧 친 메소다.
  it('조각이 없으면 0 으로 읽는다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          earned_on: '2026-08-23',
          category: '사냥',
          category_key: 'hunting',
          meso_amount: 500_000_000,
          hunt_typed_meso: 500_000_000,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
      ],
    })
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    const [record] = await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    expect(record.hunt).toEqual({
      mode: 'manual',
      typedMeso: 500_000_000,
      fragmentsDeferred: false,
      fragments: 0,
      fragmentPrice: 0,
    })
  })

  // 친 메소가 0 이어도 **수동으로 적힌 행**이다. 조각만 먹은 사냥이 그렇다.
  // `0` 과 `NULL` 이 갈리는 자리라, 여기서 접히면 그 행이 계산기 행으로 둔갑한다.
  it('친 메소가 0 이어도 수동으로 읽는다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          earned_on: '2026-08-23',
          category: '사냥',
          category_key: 'hunting',
          meso_amount: 664_000_000,
          hunt_typed_meso: 0,
          hunt_fragments: 83,
          hunt_fragment_price: 8_000_000,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
      ],
    })
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    const [record] = await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    expect(record.hunt?.mode).toBe('manual')
  })

  //  이전에 적힌 행. 칸이 여덟 다 비어 있다. 지어낼 것이 없으므로 `null` 이다.
  it('칸이 전부 비면 여전히 null 이다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          earned_on: '2026-08-23',
          category: '사냥',
          category_key: 'hunting',
          item: '엘리시움',
          item_key: null,
          meso_amount: 1_200_000_000,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
      ],
    })
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    const [record] = await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    expect(record.hunt).toBeNull()
  })
})

// 수입 `기타`도 지출과 같이 **금액 × 수량**이다.
//
// 수량을 안 저장하면 그 행을 수정으로 다시 열 때 수량이 늘 1 로 서고 금액 칸에 총액이 들어간다.
// 사용자가 안 적은 값이 사용자가 적은 값처럼 보이는 자리라 칸을 하나 더 든다.
describe('quantity: 수입의 수량', () => {
  const 세번받은보상: IncomeRecord = {
    ...sample,
    category: 'etc',
    item: '이벤트 보상',
    itemKey: null,
    mesoAmount: 300_000_000,
    quantity: 3,
  }

  it('넣을 때 함께 싣는다', async () => {
    const { insertIncomeRecord } = require('../income') as typeof import('../income')

    await insertIncomeRecord(세번받은보상)

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('quantity')
    expect(values[13]).toBe(3)
  })

  it('고칠 때도 함께 갈아 끼운다', async () => {
    const { updateIncomeRecord } = require('../income') as typeof import('../income')

    await updateIncomeRecord({ ...세번받은보상, quantity: 5 })

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('quantity = ?')
    expect(values).toEqual(expect.arrayContaining([5]))
  })

  it('읽어 온다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          earned_on: '2026-08-23',
          category: '기타',
          category_key: 'etc',
          item: '이벤트 보상',
          item_key: null,
          meso_amount: 300_000_000,
          quantity: 3,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
      ],
    })
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    const [record] = await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    expect(record.quantity).toBe(3)
  })

  // 이 칸이 없던 시절의 행. 수량 1 로 열리고 총액이 곧 금액이다.
  it('칸이 비면 null 이다. 0 으로 접지 않는다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'inc-1',
          earned_on: '2026-08-23',
          category: '기타',
          category_key: 'etc',
          meso_amount: 300_000_000,
          recorded_at: '2026-08-23T05:00:00.000Z',
        },
      ],
    })
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    const [record] = await getIncomeRecordsBetween('2026-08-20', '2026-08-26')

    expect(record.quantity).toBeNull()
  })
})

describe('hunt_fragments_deferred: 조각 가격 나중에 입력', () => {
  const 나중에: HuntingManualDetail = {
    mode: 'manual',
    typedMeso: 1_000_000_000,
    fragments: 80,
    fragmentPrice: 0,
    fragmentsDeferred: true,
  }
  const 사냥행: IncomeRecord = { ...sample, ocid: 'ocid-adele', category: 'hunting', item: null, mesoAmount: 1_000_000_000, hunt: 나중에 }

  // 가격 0 · NULL 인 옛 기록은 지금 판매다. 둘과 갈리는 칸이 따로 있어야 한다.
  it('사냥 칸 여덟 뒤에 나중에 입력(1 · 0)을 싣는다', async () => {
    const { insertIncomeRecord } = require('../income') as typeof import('../income')

    await insertIncomeRecord(사냥행)
    await insertIncomeRecord({ ...사냥행, hunt: { ...나중에, fragmentsDeferred: false } })

    const [sql, deferred] = runMock.mock.calls[0]
    expect(sql).toContain('hunt_fragments_deferred')
    expect(deferred[22]).toBe(1)
    expect(runMock.mock.calls[1][1][22]).toBe(0)
  })

  it('사냥이 아닌 행은 비운다', async () => {
    const { insertIncomeRecord } = require('../income') as typeof import('../income')

    await insertIncomeRecord(sample)

    expect(runMock.mock.calls[0][1][22]).toBeNull()
  })

  it('고칠 때도 함께 갈아 끼운다', async () => {
    const { updateIncomeRecord } = require('../income') as typeof import('../income')

    await updateIncomeRecord(사냥행)

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('hunt_fragments_deferred = ?')
    expect(values[21]).toBe(1)
  })

  it('1 이면 나중에 입력으로 읽고 NULL · 0 은 지금 판매다', async () => {
    const row = (id: string, deferred: number | null): Record<string, unknown> => ({
      id,
      earned_on: '2026-09-01',
      category: '사냥',
      category_key: 'hunting',
      meso_amount: 1_000_000_000,
      hunt_fragments: 80,
      hunt_fragment_price: 0,
      hunt_typed_meso: 1_000_000_000,
      hunt_fragments_deferred: deferred,
      recorded_at: '2026-09-01T05:00:00.000Z',
    })
    queryMock.mockResolvedValue({ values: [row('a', 1), row('b', 0), row('c', null)] })
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    const records = await getIncomeRecordsBetween('2026-09-01', '2026-09-01')

    expect(records.map((record) => record.hunt?.fragmentsDeferred)).toEqual([true, false, false])
  })

  it('계산기 행도 읽는다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          id: 'calc',
          earned_on: '2026-09-01',
          category: '사냥',
          category_key: 'hunting',
          meso_amount: 900_000_000,
          hunt_missed_mobs: 0,
          hunt_boosts: '',
          hunt_sojae: 4,
          hunt_fragments: 50,
          hunt_fragment_price: 0,
          hunt_meso_rate: 100,
          hunt_fragments_deferred: 1,
          recorded_at: '2026-09-01T05:00:00.000Z',
        },
      ],
    })
    const { getIncomeRecordsBetween } = require('../income') as typeof import('../income')

    const [record] = await getIncomeRecordsBetween('2026-09-01', '2026-09-01')

    expect(record?.hunt).toMatchObject({ mode: 'calculator', fragments: 50, fragmentsDeferred: true })
  })
})

describe('getFragmentStorage: 캐릭터별 솔 에르다 조각 보관', () => {
  // 보관은 따로 저장하지 않고 기록에서 센다. 나중에 입력 사냥의 조각 합 − 정산이 판 개수 합.
  it('캐릭터 · 고른 날까지 · 뺄 기록으로 한 번 묻는다', async () => {
    queryMock.mockResolvedValue({ values: [{ stored: 70 }] })
    const { getFragmentStorage } = require('../income') as typeof import('../income')

    await expect(getFragmentStorage('ocid-adele', '2026-09-10', 'settle-1')).resolves.toBe(70)

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain('hunt_fragments_deferred = 1')
    expect(sql).toContain("category_key = 'sol_erda_fragment'")
    expect(sql).toContain('earned_on <= ?')
    expect(values).toEqual(['ocid-adele', '2026-09-10', 'settle-1'])
  })

  it('뺄 기록이 없으면 빈 id 로 묻는다', async () => {
    queryMock.mockResolvedValue({ values: [{ stored: 0 }] })
    const { getFragmentStorage } = require('../income') as typeof import('../income')

    await getFragmentStorage('ocid-adele', '2026-09-10')

    expect(queryMock.mock.calls[0][1]).toEqual(['ocid-adele', '2026-09-10', ''])
  })

  // 가계부의 오차는 사용자가 고친다. 0 으로 맞추지 않는다.
  it('마이너스도 그대로 · 기록이 없으면 0', async () => {
    const { getFragmentStorage } = require('../income') as typeof import('../income')

    queryMock.mockResolvedValueOnce({ values: [{ stored: -50 }] })
    await expect(getFragmentStorage('ocid-adele', '2026-09-10')).resolves.toBe(-50)

    queryMock.mockResolvedValueOnce({ values: [] })
    await expect(getFragmentStorage('ocid-adele', '2026-09-10')).resolves.toBe(0)
  })
})
