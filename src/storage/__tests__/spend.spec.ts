/// <reference types="node" />
/**
 * 지출 어댑터를 진짜 SQLite 로 태운다. 지출은 가계부 기록 표 셋에 `entry_type = 'spend'` 로 산다. 화면이 쓰는 모양
 * (`SpendRecord`)으로 넣은 것이 같은 모양으로 되읽히는지, 품목 행이 어떻게 갈리는지 본다.
 */
import spendCatalog from '../../data/spend-catalog.json'
import { spendCategories } from '../../lib/cashbook/categories'
import { __resetStoragePortsForTest, setSqlitePort } from '../ports'
import {
  deleteSpendRecord,
  getSpendRecordsBetween,
  getSpendRecordsRevision,
  insertSpendRecord,
  updateSpendRecord,
  type SpendRecord,
} from '../spend'
import { splitAmount } from '../cashbook-entry-shape'
import { closeBossProfitDb } from '../sqlite/db'
import { createRealSqlite, type RealSqlite } from '../sqlite/__tests__/node-sqlite-port'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

type Row = Record<string, unknown>

function all(sql: string): Row[] {
  return real.inspect((db) => db.prepare(sql).all() as Row[])
}

/** 메소로 낸 것. 통화 칸 셋 중 하나만 찬다. */
const mesoSpend: SpendRecord = {
  id: '6f1b0e2c-0000-4000-8000-000000000001',
  ocid: null,
  spentOn: '2026-08-23',
  category: 'buff',
  item: null,
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
  recordedAt: '2026-08-23T05:00:00.000Z',
}

/** 메포로 낸 에픽던전 리워드. 형태 둘을 함께 산다. 시세가 **반드시** 함께 온다. */
const rewardSpend: SpendRecord = {
  ...mesoSpend,
  id: '6f1b0e2c-0000-4000-8000-000000000002',
  category: 'content',
  itemKey: null,
  formItemKeys: { exp: 'high_mountain_1', sol_erda: 'high_mountain_2' },
  mesoAmount: null,
  pointAmount: 37_501,
  pointPer100mMeso: 1_180,
}

describe('넣은 지출을 같은 모양으로 되읽는다', () => {
  it.each<[string, SpendRecord]>([
    ['메소 목록 항목', mesoSpend],
    ['에픽던전 리워드 형태 둘', rewardSpend],
    [
      '심볼 강화 레벨 둘',
      { ...mesoSpend, category: 'symbol', itemKey: 'road_of_vanishing', levelFrom: 3, levelTo: 7, quantity: null },
    ],
    [
      '관세를 낸 장비 구매. 총액과 그 안의 관세를 둘 다 든다',
      {
        ...mesoSpend,
        category: 'item_purchase',
        item: '앱솔랩스 아처슈즈',
        itemKey: null,
        itemKind: 'equipment',
        quantity: null,
        mesoAmount: 1_100_000_000,
        tariffMeso: 100_000_000,
      },
    ],
    [
      '캐시 기타. 캐릭터와 메모가 붙는다',
      {
        ...mesoSpend,
        category: 'etc',
        item: '모멘텀 프라임 패스',
        itemKey: null,
        ocid: 'ocid-1',
        mesoAmount: null,
        cashAmount: 33_000,
      },
    ],
  ])('%s', async (_, record) => {
    await insertSpendRecord(record)

    expect(await getSpendRecordsBetween(record.spentOn, record.spentOn)).toEqual([record])
  })

  // 금액을 품목마다 두므로 형태 둘을 산 기록은 금액이 둘로 나뉜다. 기록의 금액은 두 품목의 합이다.
  it('에픽던전 형태 둘은 품목 둘이 되고, 금액은 단계 단가대로 나뉘며 나머지는 첫 품목에 붙는다', async () => {
    await insertSpendRecord(rewardSpend)

    expect(
      all(
        'SELECT sort_order, item_key, form_key, amount_point, point_per_100m_meso FROM cashbook_entry_items ORDER BY sort_order',
      ),
    ).toEqual([
      // 하이마운틴 1단계 7,500 · 2단계 30,000 이라 1:4 다. 37,501 의 나머지 1 은 첫 품목에 붙는다.
      { sort_order: 0, item_key: 'high_mountain_1', form_key: 'exp', amount_point: 7_501, point_per_100m_meso: 1_180 },
      { sort_order: 1, item_key: 'high_mountain_2', form_key: 'sol_erda', amount_point: 30_000, point_per_100m_meso: 1_180 },
    ])
  })

  // key 가 있는 기록은 이름을 참조표에서 찾는다. 직접 친 이름만 남는다.
  it('key 가 있는 기록은 이름을 안 적고, 직접 친 기록만 이름을 적는다', async () => {
    await insertSpendRecord({ ...mesoSpend, item: '세이람의 영약' })
    await insertSpendRecord({
      ...mesoSpend,
      id: '6f1b0e2c-0000-4000-8000-000000000003',
      category: 'etc',
      item: '패스',
      itemKey: null,
    })

    expect(all('SELECT item_key, item_name FROM cashbook_entry_items ORDER BY item_key')).toEqual([
      { item_key: null, item_name: '패스' },
      { item_key: 'seiram_elixir', item_name: null },
    ])
  })
})

describe('메포 지출의 시세 요구', () => {
  // 시세 없이 저장하면 그 행은 영영 메소로 표시할 수 없다. 환율이 행에 박히므로 나중에 채울 수도 없다.
  it('시세가 없거나 0 이하면 넣지도 고치지도 않고 던진다', async () => {
    await expect(insertSpendRecord({ ...rewardSpend, pointPer100mMeso: null })).rejects.toThrow('시세')
    await expect(insertSpendRecord({ ...rewardSpend, pointPer100mMeso: 0 })).rejects.toThrow('시세')
    await insertSpendRecord(rewardSpend)
    await expect(updateSpendRecord({ ...rewardSpend, pointPer100mMeso: null })).rejects.toThrow('시세')

    expect(await getSpendRecordsBetween('2026-08-23', '2026-08-23')).toEqual([rewardSpend])
  })
})

describe('고치기 · 지우기', () => {
  it('고치면 id 와 저장 시각은 그대로이고 품목이 통째로 바뀐다', async () => {
    await insertSpendRecord(rewardSpend)

    const edited: SpendRecord = {
      ...rewardSpend,
      spentOn: '2026-08-24',
      formItemKeys: { exp: 'high_mountain_2' },
      pointAmount: 15_000,
    }
    await updateSpendRecord(edited)

    expect(await getSpendRecordsBetween('2026-08-01', '2026-08-31')).toEqual([edited])
    expect(all('SELECT form_key FROM cashbook_entry_items')).toEqual([{ form_key: 'exp' }])
    const [entry] = all('SELECT created_at, updated_at FROM cashbook_entries')
    expect(entry!.created_at).toBe(rewardSpend.recordedAt)
    expect(entry!.updated_at).not.toBe(rewardSpend.recordedAt)
  })

  it('지우면 그 기록과 품목만 사라진다', async () => {
    await insertSpendRecord(mesoSpend)
    await insertSpendRecord(rewardSpend)

    await deleteSpendRecord(rewardSpend.id)

    expect(await getSpendRecordsBetween('2026-08-23', '2026-08-23')).toEqual([mesoSpend])
    expect(all('SELECT count(*) AS n FROM cashbook_entry_items')).toEqual([{ n: 1 }])
  })

  it('넣기 · 고치기 · 지우기마다 판이 오른다. 통계 화면이 이것으로 쓰기를 안다', async () => {
    const before = getSpendRecordsRevision()
    await insertSpendRecord(mesoSpend)
    await updateSpendRecord(mesoSpend)
    await deleteSpendRecord(mesoSpend.id)

    expect(getSpendRecordsRevision()).toBe(before + 3)
  })
})

// 캐릭터 없는 기록은 ocid 로 계정을 찾을 수 없어 넥슨 계정을 직접 든다. 다계정이면 그 계정의 기록으로 갈린다.
describe('캐릭터 없는 기록의 넥슨 계정', () => {
  it('캐릭터 없는 기록만 계정을 적고, 캐릭터가 있는 기록은 비워 둔다', async () => {
    await insertSpendRecord(mesoSpend, 'account-a')
    await insertSpendRecord({ ...rewardSpend, ocid: 'ocid-1' }, 'account-a')

    expect(all('SELECT id, nexon_account_id FROM cashbook_entries ORDER BY id')).toEqual([
      { id: mesoSpend.id, nexon_account_id: 'account-a' },
      { id: rewardSpend.id, nexon_account_id: null },
    ])
  })

  it('고쳐도 처음 속한 계정을 지키고, 캐릭터를 고르면 계정 칸을 비운다', async () => {
    await insertSpendRecord(mesoSpend, 'account-a')

    await updateSpendRecord({ ...mesoSpend}, 'account-b')
    expect(all('SELECT nexon_account_id FROM cashbook_entries')).toEqual([{ nexon_account_id: 'account-a' }])

    await updateSpendRecord({ ...mesoSpend, ocid: 'ocid-1' }, 'account-b')
    expect(all('SELECT nexon_account_id FROM cashbook_entries')).toEqual([{ nexon_account_id: null }])

    await updateSpendRecord(mesoSpend, 'account-b')
    expect(all('SELECT nexon_account_id FROM cashbook_entries')).toEqual([{ nexon_account_id: 'account-b' }])
  })
})

describe('getSpendRecordsBetween', () => {
  it('두 끝을 포함하는 날짜 범위의 지출만 읽는다. 수입 기록은 안 섞인다', async () => {
    for (const [index, spentOn] of ['2026-08-01', '2026-08-15', '2026-08-31', '2026-09-01'].entries()) {
      await insertSpendRecord({ ...mesoSpend, id: `6f1b0e2c-0000-4000-8000-00000000010${index}`, spentOn })
    }
    real.inspect((db) =>
      db.exec(`INSERT INTO cashbook_entries (id, entry_type, category_key, entry_date, created_at, updated_at)
               VALUES ('income-1', 'income', 'etc', '2026-08-15', '2026-08-15T00:00:00Z', '2026-08-15T00:00:00Z')`),
    )

    const rows = await getSpendRecordsBetween('2026-08-01', '2026-08-31')
    expect(rows.map((row) => row.spentOn)).toEqual(['2026-08-01', '2026-08-15', '2026-08-31'])
  })
})

describe('splitAmount', () => {
  it('가중치대로 나누고 버린 나머지는 첫 몫에 붙여 합이 같다. 단가를 모르는 몫이 있으면 전부 첫 몫이다', () => {
    expect(splitAmount(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(splitAmount(100, [1, 0])).toEqual([100, 0])
    expect(splitAmount(null, [1, 2])).toEqual([null, null])
  })
})

describe('지출 갈래 표와 카탈로그', () => {
  // 갈래 key 가 **두 칸**에 산다. 목록을 갖는 묶음은 카탈로그에 있고 갈래는 갈래 칸에 있다. 어긋나면 그 묶음이
  // 어느 시트에도 안 선다.
  it('번들 카탈로그의 묶음은 모두 앱이 폼을 아는 지출 갈래를 가리킨다', () => {
    const keys = spendCategories()
      .filter((each) => each.known)
      .map((each) => each.key)

    for (const category of new Set(spendCatalog.groups.map((group) => group.category))) {
      expect(keys).toContain(category)
    }
  })
})
