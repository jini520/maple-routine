/// <reference types="node" />
/**
 * 지출 어댑터를 진짜 SQLite 로 태운다. 지출은 가계부 기록 표에 지출 분류의 기록으로 산다. 화면이 쓰는 모양
 * (`SpendRecord`)으로 넣은 것이 같은 모양으로 되읽히는지, 품목 행이 어떻게 갈리는지 본다.
 */
import spendCatalog from '../../__fixtures__/game-data/spend-catalog.json'
import { findCashbookCategoryById, spendCategories } from '../../lib/cashbook/categories'
import { cashbookCategoryIdOf, itemTargetIdOf, spendRewardTypeIdOf } from '../../lib/cashbook/entry-ids'
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
  ocid: 'ocid-1',
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
  mesoMarketFeePercent: null,
  cashAmount: null,
  hexa: null,
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
        'SELECT target_id, spend_reward_type_id, amount_maple_point, maple_point_per_100m_meso FROM cashbook_entry_items ORDER BY rowid',
      ),
    ).toEqual([
      // 하이마운틴 1단계 7,500 · 2단계 30,000 이라 1:4 다. 37,501 의 나머지 1 은 첫 품목에 붙는다.
      {
        target_id: itemTargetIdOf('spend_item', 'high_mountain_1'),
        spend_reward_type_id: spendRewardTypeIdOf('exp'),
        amount_maple_point: 7_501,
        maple_point_per_100m_meso: 1_180,
      },
      {
        target_id: itemTargetIdOf('spend_item', 'high_mountain_2'),
        spend_reward_type_id: spendRewardTypeIdOf('sol_erda'),
        amount_maple_point: 30_000,
        maple_point_per_100m_meso: 1_180,
      },
    ])
  })

  // 품목 표에는 차례 칸이 없고 서버에서 받은 품목은 솔 에르다 → 경험치 차례로 들 수 있다. 기록의 시세는 첫 품목에서 읽는다.
  it('품목 행이 솔 에르다 → 경험치 차례로 들어 있어도 경험치 품목을 첫 품목으로 읽는다', async () => {
    await insertSpendRecord(rewardSpend)
    const exp = spendRewardTypeIdOf('exp')
    real.inspect((db) =>
      db.exec(`CREATE TEMP TABLE moved AS SELECT * FROM cashbook_entry_items WHERE spend_reward_type_id = '${exp}';
               DELETE FROM cashbook_entry_items WHERE spend_reward_type_id = '${exp}';
               INSERT INTO cashbook_entry_items SELECT * FROM moved;
               UPDATE cashbook_entry_items SET maple_point_per_100m_meso = 1200 WHERE spend_reward_type_id = '${exp}';`),
    )
    expect(all('SELECT spend_reward_type_id FROM cashbook_entry_items ORDER BY rowid')).toEqual([
      { spend_reward_type_id: spendRewardTypeIdOf('sol_erda') },
      { spend_reward_type_id: exp },
    ])

    expect(await getSpendRecordsBetween(rewardSpend.spentOn, rewardSpend.spentOn)).toEqual([{ ...rewardSpend, pointPer100mMeso: 1_200 }])
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

    expect(all('SELECT target_type, target_id, item_name FROM cashbook_entry_items ORDER BY target_id')).toEqual([
      { target_type: null, target_id: null, item_name: '패스' },
      { target_type: 'spend_item', target_id: itemTargetIdOf('spend_item', 'seiram_elixir'), item_name: null },
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
    expect(all('SELECT spend_reward_type_id FROM cashbook_entry_items')).toEqual([{ spend_reward_type_id: spendRewardTypeIdOf('exp') }])
    const [entry] = all('SELECT recorded_at, updated_at FROM cashbook_entries')
    expect(entry!.recorded_at).toBe(rewardSpend.recordedAt)
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

// 아이템 구매 · 판매의 메모. 저장 계층이 다듬으므로 어느 시트가 적어도 같은 규칙이다.
describe('메모', () => {
  const purchase: SpendRecord = { ...mesoSpend, category: 'item_purchase', itemKey: 'dreamy_belt', itemKind: 'equipment', quantity: null }

  it('앞뒤 공백을 걷어 저장하고, 공백만 있는 메모는 칸이 비어 메모 없는 기록으로 읽힌다', async () => {
    await insertSpendRecord({ ...purchase, memo: '  17성 3추옵\n경매장 최저가  ' })
    await insertSpendRecord({ ...purchase, id: '6f1b0e2c-0000-4000-8000-000000000009', memo: ' \n ' })

    const [kept, blank] = await getSpendRecordsBetween('2026-08-23', '2026-08-23')
    expect(kept!.memo).toBe('17성 3추옵\n경매장 최저가')
    expect(blank).not.toHaveProperty('memo')
    expect(all('SELECT memo FROM cashbook_entries ORDER BY id')).toEqual([{ memo: '17성 3추옵\n경매장 최저가' }, { memo: null }])
  })

  it('고치면 메모가 바뀌고, 메모를 지우고 고치면 칸이 빈다', async () => {
    await insertSpendRecord({ ...purchase, memo: '첫 메모' })

    await updateSpendRecord({ ...purchase, memo: '고친 메모' })
    expect((await getSpendRecordsBetween('2026-08-23', '2026-08-23'))[0]!.memo).toBe('고친 메모')

    await updateSpendRecord({ ...purchase, memo: '' })
    expect(all('SELECT memo FROM cashbook_entries')).toEqual([{ memo: null }])
  })
})

describe('메이플 ID 기록', () => {
  it('메이플 ID 기록은 캐릭터 없이 그 ID 로 되읽힌다', async () => {
    const accountSpend: SpendRecord = { ...mesoSpend, ocid: null, category: 'event_bm', accountId: 'maple-a' }
    await insertSpendRecord(accountSpend)
    await insertSpendRecord(rewardSpend)

    expect(await getSpendRecordsBetween(mesoSpend.spentOn, mesoSpend.spentOn)).toEqual([accountSpend, rewardSpend])
    expect(all('SELECT ocid, account_id FROM cashbook_entries ORDER BY id')).toEqual([
      { ocid: null, account_id: 'maple-a' },
      { ocid: 'ocid-1', account_id: null },
    ])
  })
})

describe('getSpendRecordsBetween', () => {
  it('두 끝을 포함하는 날짜 범위의 지출만 읽는다. 수입 기록은 안 섞인다', async () => {
    for (const [index, spentOn] of ['2026-08-01', '2026-08-15', '2026-08-31', '2026-09-01'].entries()) {
      await insertSpendRecord({ ...mesoSpend, id: `6f1b0e2c-0000-4000-8000-00000000010${index}`, spentOn })
    }
    real.inspect((db) =>
      db.exec(`INSERT INTO cashbook_entries (id, ocid, category_id, date, recorded_at, updated_at)
               VALUES ('income-1', 'ocid-1', '${cashbookCategoryIdOf('income', 'etc')}', '2026-08-15', '2026-08-15T00:00:00Z',
                       '2026-08-15T00:00:00Z')`),
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

describe('지출 분류 표와 카탈로그', () => {
  // 묶음은 분류를 다른 칸(`cashbookCategories`)의 줄 id 로 가리킨다. 어긋나면 그 묶음이 어느 시트에도 안 선다.
  it('fixture 카탈로그의 묶음은 모두 앱이 폼을 아는 지출 분류를 가리킨다', () => {
    const known = new Set(
      spendCategories()
        .filter((each) => each.known)
        .map((each) => each.key),
    )

    const unknown = spendCatalog.spendGroups.filter(
      (group) => !known.has(findCashbookCategoryById(group.cashbookCategoryId)?.key ?? ''),
    )
    expect(unknown.map((group) => group.key)).toEqual([])
  })
})
