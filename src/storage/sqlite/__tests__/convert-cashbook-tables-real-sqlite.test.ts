/// <reference types="node" />
/**
 * 1.0.15 기기 변환의 가계부 단계를 진짜 SQLite 로 태운다. 1.0.14 의 가계부 기록 표 · 인벤토리 · 기억한 레벨에 줄을 심고 변환을
 * 돌려, 새 표의 줄이 변환 규칙대로인지와 변환한 기록을 수입 · 지출 · 인벤토리의 읽기 함수가 그대로 읽는지 본다. 변환은 줄을 지워
 * 되돌릴 수 없어서, 규칙이 틀리면 사용자의 기록이 사라지거나 다른 물건의 기록이 된다.
 */
import {
  cashbookCategoryIdOf,
  cashbookItemTypeIdOf,
  itemTargetIdOf,
  spendRewardTypeIdOf,
} from '../../../lib/cashbook/entry-ids'
import { findWorld } from '../../../lib/world/worlds'
import { getIncomeRecordsBetween } from '../../income'
import { getOtherFragmentStorage } from '../../inventory'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { getSpendRecordsBetween } from '../../spend'
import { closeBossProfitDb, getBossProfitDbUngated } from '../db'
import { runDeviceConversion, type DeviceConversionContext } from '../device-conversion'
import { __setMigrationCeilingForTest, DB_VERSION } from '../migrations'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
})

afterEach(async () => {
  __setMigrationCeilingForTest(null)
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

type Row = Record<string, unknown>

function all(sql: string): Row[] {
  return real.inspect((db) => db.prepare(sql).all() as Row[])
}

const AT = '2026-11-20T00:00:00.000Z'
const worldId = (key: string) => findWorld(key)!.id

/** 줄 하나를 넣는 문장. 칸 이름과 값을 그대로 적는다. */
function insert(table: string, row: Record<string, string | number | null>): string {
  const values = Object.values(row).map((value) =>
    value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${value.replace(/'/g, "''")}'`,
  )
  return `INSERT INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${values.join(', ')})`
}

/** 1.0.14 의 가계부 기록 한 건. 주인은 캐릭터 · 메이플 ID · 넥슨 계정 칸 가운데 넘긴 것만 찬다. */
function entry(
  id: string,
  type: 'income' | 'spend',
  categoryKey: string,
  owner: { ocid?: string; accountId?: string; nexonAccountId?: string; worldKey?: string } = { ocid: 'o1', worldKey: 'scania' },
): string {
  return insert('cashbook_entries', {
    id,
    ocid: owner.ocid ?? null,
    account_id: owner.accountId ?? null,
    nexon_account_id: owner.nexonAccountId ?? null,
    world_key: owner.worldKey ?? null,
    entry_type: type,
    category_key: categoryKey,
    entry_date: '2026-11-19',
    memo: null,
    created_at: AT,
    updated_at: AT,
  })
}

/** 1.0.14 의 품목 한 줄. 넘긴 칸만 찬다. */
function item(id: string, entryId: string, fields: Record<string, string | number | null> = {}): string {
  return insert('cashbook_entry_items', { id, entry_id: entryId, sort_order: 0, ...fields })
}

function profile(ocid: string, jobClass: string | null, worldKey = 'scania'): string {
  return insert('character_profiles', {
    ocid, name: ocid, image_url: '', world: worldKey, world_key: worldKey, level: 285, job_class: jobClass, updated_at: AT,
  })
}

function sighting(ocid: string, accountId: string, nexonAccountId: string, lastSeen = '2026-11-01'): string {
  return insert('character_accounts', {
    ocid, name: ocid, account_id: accountId, nexon_account_id: nexonAccountId, first_seen_date: '2026-01-01', last_seen_date: lastSeen,
  })
}

/** 1.0.14 의 표에 줄을 심고 변환을 돈다. 새 DB 는 처음 열 때 변환을 돌아서 이관 상한으로 막는다. */
async function convert(seed: string[], context: DeviceConversionContext = {}): Promise<void> {
  __setMigrationCeilingForTest(DB_VERSION)
  const db = await getBossProfitDbUngated()
  for (const statement of seed) await db.execute(statement)
  await runDeviceConversion(db, { backup: false, context })
}

describe('가계부 단계: 분류와 품목의 대상', () => {
  // 기록 표는 key 대신 줄 id 를 적는다. 품목의 대상은 기록의 분류가 정한 표의 줄이고, 반지는 레벨 줄이다.
  it('분류는 수입 · 지출의 분류 줄로, 품목은 분류가 정한 표의 줄로 옮기고 종류 칸도 줄 id 로 바꾼다', async () => {
    await convert([
      entry('e-hunt', 'income', 'hunting'),
      item('i-hunt', 'e-hunt', { item_key: 'tallahart_road_of_night_3', quantity: 8, amount_meso: 900 }),
      entry('e-sale', 'income', 'item_sale'),
      item('i-sale', 'e-sale', { item_key: 'restraint_ring', ring_level: 4, item_kind_key: 'equipment', sale_fee_percent: 5, sale_fee_auto: 1 }),
      entry('e-reward', 'spend', 'content'),
      item('i-exp', 'e-reward', { item_key: 'high_mountain_1', form_key: 'exp', amount_point: 7501, point_per_100m_meso: 1180 }),
      insert('cashbook_entry_items', { id: 'i-sol', entry_id: 'e-reward', sort_order: 1, item_key: 'high_mountain_2', form_key: 'sol_erda', amount_point: 30000 }),
      entry('e-symbol', 'spend', 'symbol'),
      item('i-symbol', 'e-symbol', { item_key: 'cernium', from_level: 7, to_level: 10 }),
      entry('e-etc', 'income', 'etc'),
      item('i-etc', 'e-etc', { item_name: '이벤트 보상', amount_meso: 100 }),
    ])

    expect(all('SELECT id, category_id, world_id, date, recorded_at FROM cashbook_entries ORDER BY id')).toEqual([
      { id: 'e-etc', category_id: cashbookCategoryIdOf('income', 'etc'), world_id: worldId('scania'), date: '2026-11-19', recorded_at: AT },
      { id: 'e-hunt', category_id: cashbookCategoryIdOf('income', 'hunting'), world_id: worldId('scania'), date: '2026-11-19', recorded_at: AT },
      { id: 'e-reward', category_id: cashbookCategoryIdOf('spend', 'content'), world_id: worldId('scania'), date: '2026-11-19', recorded_at: AT },
      { id: 'e-sale', category_id: cashbookCategoryIdOf('income', 'item_sale'), world_id: worldId('scania'), date: '2026-11-19', recorded_at: AT },
      { id: 'e-symbol', category_id: cashbookCategoryIdOf('spend', 'symbol'), world_id: worldId('scania'), date: '2026-11-19', recorded_at: AT },
    ])
    expect(
      all(`SELECT id, target_type, target_id, item_name, spend_reward_type_id, item_type_id, sale_fee_follows_mvp_grade,
                  amount_maple_point FROM cashbook_entry_items ORDER BY id`),
    ).toEqual([
      { id: 'i-etc', target_type: null, target_id: null, item_name: '이벤트 보상', spend_reward_type_id: null, item_type_id: null, sale_fee_follows_mvp_grade: 0, amount_maple_point: null },
      { id: 'i-exp', target_type: 'spend_item', target_id: itemTargetIdOf('spend_item', 'high_mountain_1'), item_name: null, spend_reward_type_id: spendRewardTypeIdOf('exp'), item_type_id: null, sale_fee_follows_mvp_grade: 0, amount_maple_point: 7501 },
      { id: 'i-hunt', target_type: 'hunting_ground', target_id: itemTargetIdOf('hunting_ground', 'tallahart_road_of_night_3'), item_name: null, spend_reward_type_id: null, item_type_id: null, sale_fee_follows_mvp_grade: 0, amount_maple_point: null },
      { id: 'i-sale', target_type: 'item', target_id: itemTargetIdOf('item', 'restraint_ring', { ringLevel: 4 }), item_name: null, spend_reward_type_id: null, item_type_id: cashbookItemTypeIdOf('equipment'), sale_fee_follows_mvp_grade: 1, amount_maple_point: null },
      { id: 'i-sol', target_type: 'spend_item', target_id: itemTargetIdOf('spend_item', 'high_mountain_2'), item_name: null, spend_reward_type_id: spendRewardTypeIdOf('sol_erda'), item_type_id: null, sale_fee_follows_mvp_grade: 0, amount_maple_point: 30000 },
      { id: 'i-symbol', target_type: 'symbol', target_id: itemTargetIdOf('symbol', 'cernium'), item_name: null, spend_reward_type_id: null, item_type_id: null, sale_fee_follows_mvp_grade: 0, amount_maple_point: null },
    ])
  })

  // 같은 이름의 코어가 직업마다 다른 줄이다. 직업에서 못 찾은 코어는 손으로 적은 기록이라 지우지 않고 이름을 남긴다.
  it('헥사 코어는 그 캐릭터 직업과 전직업의 코어에서 찾고, 못 찾으면 이름을 item_name 으로 옮기며, 헥사 스탯은 스탯 줄이다', async () => {
    await convert([
      profile('o1', '팔라딘'),
      profile('o2', '비숍'),
      entry('e-core', 'spend', 'hexa_matrix', { ocid: 'o1' }),
      item('i-core', 'e-core', { item_key: '블리츠 실드 VI/블리츠 버스트', fragment_count: 10, untradable_fragment_count: 0 }),
      entry('e-shared', 'spend', 'hexa_matrix', { ocid: 'o2' }),
      item('i-shared', 'e-shared', { item_key: '솔 야누스' }),
      entry('e-lost', 'spend', 'hexa_matrix', { ocid: 'o2' }),
      item('i-lost', 'e-lost', { item_key: '블리츠 실드 VI/블리츠 버스트' }),
      entry('e-stat', 'spend', 'hexa_matrix', { ocid: 'o1' }),
      item('i-stat', 'e-stat', { item_key: 'hexa_stat_1', hexa_activation: 0, hexa_use_storage: 1, hexa_storage_as_spend: 0 }),
    ])

    expect(
      all(`SELECT id, target_type, target_id, item_name, fragment_quantity, includes_hexa_activation, uses_stored_fragments,
                  counts_stored_fragments_as_spend FROM cashbook_entry_items ORDER BY id`),
    ).toEqual([
      { id: 'i-core', target_type: 'hexa_core', target_id: itemTargetIdOf('hexa_core', '블리츠 실드 VI/블리츠 버스트', { job: '팔라딘' }), item_name: null, fragment_quantity: 10, includes_hexa_activation: null, uses_stored_fragments: null, counts_stored_fragments_as_spend: null },
      { id: 'i-lost', target_type: null, target_id: null, item_name: '블리츠 실드 VI/블리츠 버스트', fragment_quantity: null, includes_hexa_activation: null, uses_stored_fragments: null, counts_stored_fragments_as_spend: null },
      { id: 'i-shared', target_type: 'hexa_core', target_id: itemTargetIdOf('hexa_core', '솔 야누스', { job: null }), item_name: null, fragment_quantity: null, includes_hexa_activation: null, uses_stored_fragments: null, counts_stored_fragments_as_spend: null },
      { id: 'i-stat', target_type: 'hexa_stat', target_id: itemTargetIdOf('hexa_stat', 'hexa_stat_1'), item_name: null, fragment_quantity: null, includes_hexa_activation: 0, uses_stored_fragments: 1, counts_stored_fragments_as_spend: 0 },
    ])
  })

  // 손으로 적은 기록이라 지우지 않는다. 이름만 남고 금액이 비면 지출 합계에서 그 강화가 빠진다.
  it('직업에서 못 찾은 헥사 코어 기록은 금액 · 레벨 · 조각을 지키고, 지출 기록을 읽으면 그 이름이 코어 key 로 나온다', async () => {
    await convert([
      profile('o2', '비숍'),
      entry('e-lost', 'spend', 'hexa_matrix', { ocid: 'o2' }),
      item('i-lost', 'e-lost', {
        item_key: '블리츠 실드 VI/블리츠 버스트', from_level: 3, to_level: 5, amount_meso: 1000, fragment_count: 10,
        untradable_fragment_count: 0, fragment_price_meso: 100,
      }),
    ])

    expect(await getSpendRecordsBetween('2026-11-19', '2026-11-19')).toEqual([
      expect.objectContaining({
        id: 'e-lost',
        ocid: 'o2',
        category: 'hexa_matrix',
        item: null,
        itemKey: '블리츠 실드 VI/블리츠 버스트',
        levelFrom: 3,
        levelTo: 5,
        mesoAmount: 1000,
        hexa: expect.objectContaining({ fragmentCount: 10, untradableFragmentCount: 0, fragmentPrice: 100 }),
      }),
    ])
  })

  // 품목만 지우면 금액이 빈 기록이 남는다. 서버 표에 없는 분류 · 물건을 가리키는 기록은 기록째 옮기지 않는다.
  // 기타는 수입 · 지출에 같은 key 로 있어, 기록의 종류가 어느 분류 줄인지 가른다.
  it('모르는 분류와 모르는 품목 key 의 기록은 딸린 줄과 함께 옮기지 않고, 수입 · 지출의 기타 기록은 각자의 분류 줄로 옮기며, 대상이 없는 분류의 key 는 버린다', async () => {
    await convert([
      entry('e-unknown-category', 'spend', 'no_such_category'),
      item('i-1', 'e-unknown-category', { item_name: '옛 지출' }),
      entry('e-unknown-item', 'spend', 'buff'),
      item('i-2', 'e-unknown-item', { item_key: 'no_such_buff' }),
      insert('cashbook_entry_fragment_uses', { id: 'u-1', entry_id: 'e-unknown-item', fragment_source: 'hunt', ocid: 'o1', fragments: 3 }),
      entry('e-keyed-etc', 'spend', 'etc'),
      item('i-3', 'e-keyed-etc', { item_key: 'seiram_elixir', amount_meso: 100 }),
      entry('e-income-etc', 'income', 'etc', { accountId: 'maple-1' }),
      item('i-4', 'e-income-etc', { item_name: '이벤트 보상', amount_meso: 50 }),
    ])

    expect(all('SELECT id, category_id FROM cashbook_entries ORDER BY id')).toEqual([
      { id: 'e-income-etc', category_id: cashbookCategoryIdOf('income', 'etc') },
      { id: 'e-keyed-etc', category_id: cashbookCategoryIdOf('spend', 'etc') },
    ])
    expect(all('SELECT id, target_type, target_id, item_name FROM cashbook_entry_items ORDER BY id')).toEqual([
      { id: 'i-3', target_type: null, target_id: null, item_name: null },
      { id: 'i-4', target_type: null, target_id: null, item_name: '이벤트 보상' },
    ])
    expect(all('SELECT count(*) AS n FROM cashbook_entry_fragment_uses')).toEqual([{ n: 0 }])
  })

  it('같은 기록에 추가 리워드 종류가 같은 품목이 둘이면 먼저 적은 품목만 남긴다', async () => {
    await convert([
      entry('e1', 'spend', 'content'),
      item('i-first', 'e1', { item_key: 'high_mountain_1', form_key: 'exp' }),
      insert('cashbook_entry_items', { id: 'i-second', entry_id: 'e1', sort_order: 1, item_key: 'high_mountain_2', form_key: 'exp' }),
    ])

    expect(all('SELECT id FROM cashbook_entry_items')).toEqual([{ id: 'i-first' }])
  })
})

describe('가계부 단계: 딸린 입력', () => {
  // 서버는 켠 효과를 칸 둘로 든다. 직접 입력 사냥은 효과를 고르지 않아 두 칸이 비고, 계산기 기록은 켜지 않았으면 거짓이다.
  it('사냥 효과를 두 칸으로 나누고 차례는 보지 않는다. 빈 글자는 둘 다 거짓, 직접 입력은 둘 다 비운다', async () => {
    const hunt = (id: string, fields: Record<string, string | number | null>) => [
      entry(id, 'income', 'hunting'),
      insert('cashbook_entry_hunt_inputs', { id: `h-${id}`, entry_id: id, ...fields }),
    ]
    await convert([
      ...hunt('both', { missed_mobs: 2, boosts: 'union,potion', fragments: 30, meso_rate: 120, union_tier: 2 }),
      ...hunt('none', { missed_mobs: 0, boosts: '', fragments: 0, meso_rate: 100 }),
      ...hunt('typed', { typed_meso: 500, fragments: 12, fragment_price_meso: 0 }),
    ])

    expect(
      all(`SELECT entry_id, missed_mob_quantity, uses_wealth_potion, uses_union_wealth, union_wealth_tier, fragment_quantity,
                  meso_acquisition_percent, typed_meso FROM cashbook_entry_hunt_inputs ORDER BY entry_id`),
    ).toEqual([
      { entry_id: 'both', missed_mob_quantity: 2, uses_wealth_potion: 1, uses_union_wealth: 1, union_wealth_tier: 2, fragment_quantity: 30, meso_acquisition_percent: 120, typed_meso: null },
      { entry_id: 'none', missed_mob_quantity: 0, uses_wealth_potion: 0, uses_union_wealth: 0, union_wealth_tier: null, fragment_quantity: 0, meso_acquisition_percent: 100, typed_meso: null },
      { entry_id: 'typed', missed_mob_quantity: null, uses_wealth_potion: null, uses_union_wealth: null, union_wealth_tier: null, fragment_quantity: 12, meso_acquisition_percent: null, typed_meso: 500 },
    ])
  })

  // 서버의 조각 사용 줄은 기록 · 보관 · 캐릭터마다 하나다. 넣은 차례는 헥사 강화가 보관을 가져간 차례라 지킨다.
  it('사냥 조각 줄은 캐릭터를 지키고, 인벤토리 조각 줄은 캐릭터 없이 옮기며, 같은 캐릭터의 줄 둘은 더해 한 줄로 합친다', async () => {
    await convert([
      entry('e-hexa', 'spend', 'hexa_matrix'),
      item('i-hexa', 'e-hexa', { item_key: 'hexa_stat_1', hexa_activation: 1 }),
      insert('cashbook_entry_fragment_uses', { id: 'u-b', entry_id: 'e-hexa', fragment_source: 'hunt', ocid: 'o2', fragments: 5 }),
      insert('cashbook_entry_fragment_uses', { id: 'u-a', entry_id: 'e-hexa', fragment_source: 'hunt', ocid: 'o1', fragments: 7 }),
      insert('cashbook_entry_fragment_uses', { id: 'u-b2', entry_id: 'e-hexa', fragment_source: 'hunt', ocid: 'o2', fragments: 1 }),
      insert('cashbook_entry_fragment_uses', {
        id: 'u-other', entry_id: 'e-hexa', fragment_source: 'other', account_id: 'maple-1', world_key: 'scania', fragments: 4,
      }),
      entry('e-transfer', 'spend', 'etc'),
      item('i-transfer', 'e-transfer', { item_name: '주간 보스 수입 이전', amount_meso: 108 }),
      insert('cashbook_entry_transfer_inputs', { id: 't1', entry_id: 'e-transfer', receiver_ocid: 'o2', transfer_meso: 3600, fee_percent: 3, fee_auto: 1 }),
      entry('e-exchange', 'spend', 'etc'),
      item('i-exchange', 'e-exchange', { item_name: '메소마켓 환전 수수료', amount_meso: 4 }),
      insert('cashbook_entry_exchange_inputs', {
        id: 'x1', entry_id: 'e-exchange', sold_meso: 500, sell_point_per_100m_meso: 2116, meso_market_fee_percent: 1,
      }),
    ])

    expect(all('SELECT id, fragment_source, ocid, fragment_quantity FROM cashbook_entry_fragment_uses ORDER BY rowid')).toEqual([
      { id: 'u-b', fragment_source: 'hunt', ocid: 'o2', fragment_quantity: 6 },
      { id: 'u-a', fragment_source: 'hunt', ocid: 'o1', fragment_quantity: 7 },
      { id: 'u-other', fragment_source: 'inventory', ocid: null, fragment_quantity: 4 },
    ])
    expect(all('SELECT receiver_ocid, fee_percent, fee_follows_mvp_grade FROM cashbook_entry_transfer_inputs')).toEqual([
      { receiver_ocid: 'o2', fee_percent: 3, fee_follows_mvp_grade: 1 },
    ])
    expect(all('SELECT sold_meso, sell_maple_point_per_100m_meso, buy_maple_point_per_100m_meso FROM cashbook_entry_exchange_inputs')).toEqual([
      { sold_meso: 500, sell_maple_point_per_100m_meso: 2116, buy_maple_point_per_100m_meso: null },
    ])
  })
})

describe('가계부 단계: 인벤토리에서 판 기타 조각의 월드', () => {
  // 조각 사용 줄은 메이플 ID · 월드 칸이 없어진다. 남은 조각 수를 월드마다 세려면 그 월드가 기록에 있어야 한다.
  it('메이플 ID 기록과 월드가 빈 캐릭터 기록은 기타 조각 사용 줄의 월드를 기록으로 옮기고, 월드가 찬 캐릭터 기록은 그대로 둔다', async () => {
    const otherUse = (id: string, entryId: string, worldKey: string) =>
      insert('cashbook_entry_fragment_uses', { id, entry_id: entryId, fragment_source: 'other', account_id: 'maple-1', world_key: worldKey, fragments: 2 })
    await convert([
      entry('e-sale', 'income', 'item_sale', { accountId: 'maple-1' }),
      item('i-sale', 'e-sale', { item_key: 'sol_erda_fragment', item_kind_key: 'etc', quantity: 2 }),
      otherUse('u-sale', 'e-sale', 'bera'),
      entry('e-no-world', 'spend', 'hexa_matrix', { ocid: 'o1' }),
      item('i-no-world', 'e-no-world', { item_key: 'hexa_stat_1', hexa_activation: 1 }),
      otherUse('u-no-world', 'e-no-world', 'luna'),
      entry('e-world', 'spend', 'hexa_matrix', { ocid: 'o1', worldKey: 'scania' }),
      item('i-world', 'e-world', { item_key: 'hexa_stat_1', hexa_activation: 1 }),
      otherUse('u-world', 'e-world', 'scania'),
    ])

    expect(all('SELECT id, world_id FROM cashbook_entries ORDER BY id')).toEqual([
      { id: 'e-no-world', world_id: worldId('luna') },
      { id: 'e-sale', world_id: worldId('bera') },
      { id: 'e-world', world_id: worldId('scania') },
    ])
  })

  // 변환 뒤에는 조각 사용 줄의 메이플 ID · 월드를 기록에서 찾는다. 어긋나면 다른 메이플 ID · 월드의 조각이 빠진다.
  it('월드 둘의 남은 기타 조각은 변환 뒤에도 월드마다 넣은 개수에서 판매 · 헥사 강화가 가져간 개수를 뺀 값이다', async () => {
    const fragments = (id: string, worldKey: string, quantity: number) =>
      insert('inventory_items', {
        id, account_id: 'maple-1', world_key: worldKey, item_key: 'sol_erda_fragment', item_kind_key: 'etc', quantity,
        ring_level: null, created_at: AT, updated_at: AT,
      })
    const otherUse = (id: string, entryId: string, worldKey: string, count: number) =>
      insert('cashbook_entry_fragment_uses', { id, entry_id: entryId, fragment_source: 'other', account_id: 'maple-1', world_key: worldKey, fragments: count })
    await convert([
      sighting('o1', 'maple-1', 'account-main'),
      fragments('inv-scania', 'scania', 10),
      fragments('inv-luna', 'luna', 6),
      entry('e-sale', 'income', 'item_sale', { accountId: 'maple-1' }),
      item('i-sale', 'e-sale', { item_key: 'sol_erda_fragment', item_kind_key: 'etc', quantity: 3, amount_meso: 300 }),
      otherUse('u-sale', 'e-sale', 'scania', 3),
      entry('e-hexa', 'spend', 'hexa_matrix', { ocid: 'o1' }),
      item('i-hexa', 'e-hexa', { item_key: 'hexa_stat_1', hexa_activation: 1, fragment_count: 4, untradable_fragment_count: 0 }),
      otherUse('u-hexa', 'e-hexa', 'luna', 4),
    ])

    await expect(getOtherFragmentStorage('maple-1', 'scania')).resolves.toBe(10 - 3)
    await expect(getOtherFragmentStorage('maple-1', 'luna')).resolves.toBe(6 - 4)
  })
})

describe('가계부 단계: 주인을 모르는 옛 손입력', () => {
  // 서버는 메이플 ID 없는 기록을 받지 않는다. 켜기 단계가 하던 붙이기를 옮기기 전에 한 번 더 돌고, 붙일 곳이 없는 기록은 지운다.
  it('빈 글자 계정 칸을 메인 계정으로 채워 그 계정의 하나뿐인 메이플 ID 로 옮기고, 남은 기록은 대표 캐릭터에게 붙인다', async () => {
    await convert(
      [
        sighting('o1', 'maple-1', ''),
        sighting('o9', 'maple-9', 'account-sub'),
        sighting('o9', 'maple-8', 'account-sub', '2026-10-01'),
        profile('o9', '히어로', 'elysium'),
        entry('e-single', 'spend', 'etc', { nexonAccountId: '' }),
        item('i-single', 'e-single', { item_name: '패스' }),
        entry('e-two-ids', 'spend', 'etc', { nexonAccountId: 'account-sub' }),
        item('i-two-ids', 'e-two-ids', { item_name: '패스' }),
        entry('e-character-only', 'spend', 'buff', { nexonAccountId: '' }),
        item('i-character-only', 'e-character-only', { item_key: 'seiram_elixir' }),
      ],
      { mainNexonAccountId: 'account-main', representativeOcid: 'o9' },
    )

    expect(all('SELECT id, ocid, account_id, world_id FROM cashbook_entries ORDER BY id')).toEqual([
      // 캐릭터만 고르는 분류는 메이플 ID 로 옮기지 않고 대표 캐릭터에 붙는다. 그 캐릭터의 월드를 든다.
      { id: 'e-character-only', ocid: 'o9', account_id: null, world_id: worldId('elysium') },
      { id: 'e-single', ocid: null, account_id: 'maple-1', world_id: null },
      // 넥슨 계정의 메이플 ID 가 둘이면 어느 ID 의 기록인지 몰라 대표 캐릭터를 가장 늦게 본 메이플 ID 에 붙는다.
      { id: 'e-two-ids', ocid: null, account_id: 'maple-9', world_id: null },
    ])
  })

  it('붙일 대표 캐릭터가 없으면 주인을 모르는 기록은 옮기지 않는다', async () => {
    await convert([
      entry('e-ownerless', 'spend', 'etc', {}),
      item('i-ownerless', 'e-ownerless', { item_name: '패스' }),
      entry('e-kept', 'spend', 'etc', { accountId: 'maple-1' }),
      item('i-kept', 'e-kept', { item_name: '패스' }),
    ])

    expect(all('SELECT id FROM cashbook_entries')).toEqual([{ id: 'e-kept' }])
    expect(all('SELECT entry_id FROM cashbook_entry_items')).toEqual([{ entry_id: 'e-kept' }])
  })
})

describe('가계부 단계: 인벤토리와 기억한 레벨', () => {
  it('인벤토리를 줄 id 로 옮기고, 못 찾는 줄은 지우며 그 줄을 가리키던 품목의 인벤토리 칸을 비운다', async () => {
    const inventory = (id: string, itemKey: string, ringLevel: number | null, worldKey = 'scania') =>
      insert('inventory_items', {
        id, account_id: 'maple-1', world_key: worldKey, item_key: itemKey, item_kind_key: 'equipment', quantity: 1,
        ring_level: ringLevel, created_at: AT, updated_at: AT,
      })
    await convert([
      inventory('inv-ring', 'restraint_ring', 4),
      inventory('inv-unknown-item', 'no_such_item', null),
      inventory('inv-unknown-world', 'restraint_ring', null, 'no_such_world'),
      entry('e-sale', 'income', 'item_sale', { accountId: 'maple-1' }),
      item('i-sale', 'e-sale', { item_key: 'restraint_ring', ring_level: 4, item_kind_key: 'equipment', inventory_item_id: 'inv-unknown-world' }),
    ])

    expect(all('SELECT id, world_id, item_id, cashbook_item_type_id, added_quantity FROM inventory_items')).toEqual([
      {
        id: 'inv-ring',
        world_id: worldId('scania'),
        item_id: itemTargetIdOf('item', 'restraint_ring', { ringLevel: 4 }),
        cashbook_item_type_id: cashbookItemTypeIdOf('equipment'),
        added_quantity: 1,
      },
    ])
    expect(all('SELECT id, inventory_item_id FROM cashbook_entry_items')).toEqual([{ id: 'i-sale', inventory_item_id: null }])
  })

  // 대상 칸 하나가 심볼 · 코어 두 표를 가리킨다. 코어는 같은 이름도 직업마다 다른 줄이라 그 캐릭터 직업의 줄이다.
  it('기억한 레벨을 대상 줄 id 로 옮기고, 못 찾은 대상은 버리며, 한 대상으로 모이면 늦게 고친 줄을 남긴다', async () => {
    const level = (id: string, kind: string, key: string, value: number, updatedAt = AT) =>
      insert('remembered_levels', { id, ocid: 'o1', kind, item_key: key, level: value, updated_at: updatedAt })
    await convert([
      profile('o1', '팔라딘'),
      level('r-symbol', 'symbol', 'cernium', 7),
      level('r-core', 'hexa', '블리츠 실드 VI/블리츠 버스트', 20),
      level('r-core-space', 'hexa', '블리츠 실드 VI/블리츠 버스트 ', 22, '2026-11-21T00:00:00.000Z'),
      level('r-other-job', 'hexa', '스피릿 칼리버', 5),
      level('r-unknown', 'symbol', 'no_such_symbol', 3),
    ])

    expect(all('SELECT id, type, target_id, level FROM remembered_levels ORDER BY id')).toEqual([
      { id: 'r-core-space', type: 'hexa', target_id: itemTargetIdOf('hexa_core', '블리츠 실드 VI/블리츠 버스트', { job: '팔라딘' }), level: 22 },
      { id: 'r-symbol', type: 'symbol', target_id: itemTargetIdOf('symbol', 'cernium'), level: 7 },
    ])
  })
})

describe('가계부 단계: 변환한 기록 읽기', () => {
  // 변환은 분류 · 종류를 줄 id 로 바꾸고, 읽을 때 그 id 로 수입 · 지출을 가르고 종류 key 를 되찾는다. 어긋나면 기록이 빠지거나 다른 쪽 기록으로 읽힌다.
  it('변환한 수입 · 지출 기록을 날짜 범위로 읽으면 빠짐없이 섞이지 않고 나오며, 캐시 아이템 구매는 종류를 지킨다', async () => {
    await convert([
      entry('e-in-hunt', 'income', 'hunting'),
      item('i-in-hunt', 'e-in-hunt', { item_key: 'tallahart_road_of_night_3', quantity: 8, amount_meso: 900 }),
      entry('e-in-etc', 'income', 'etc', { accountId: 'maple-1' }),
      item('i-in-etc', 'e-in-etc', { item_name: '이벤트 보상', amount_meso: 100 }),
      entry('e-out-etc', 'spend', 'etc', { accountId: 'maple-1' }),
      item('i-out-etc', 'e-out-etc', { item_name: '패스', amount_meso: 200 }),
      entry('e-out-cash', 'spend', 'item_purchase'),
      item('i-out-cash', 'e-out-cash', { item_key: 'boutique_ticket', item_kind_key: 'cash', quantity: 2, amount_meso: 300 }),
    ])

    const income = await getIncomeRecordsBetween('2026-11-19', '2026-11-19')
    const spend = await getSpendRecordsBetween('2026-11-19', '2026-11-19')

    expect(income.map((record) => [record.id, record.category])).toEqual([
      ['e-in-etc', 'etc'],
      ['e-in-hunt', 'hunting'],
    ])
    expect(spend.map((record) => [record.id, record.category])).toEqual([
      ['e-out-cash', 'item_purchase'],
      ['e-out-etc', 'etc'],
    ])
    expect(spend.find((record) => record.id === 'e-out-cash')).toMatchObject({
      itemKey: 'boutique_ticket',
      itemKind: 'cash',
      quantity: 2,
      mesoAmount: 300,
    })
  })
})

describe('가계부 단계: 표', () => {
  // DB 를 열 때 도는 칸 보강과 인덱스는 옛 칸을 쓴다. 변환 뒤에 돌면 없는 칸을 만지다 DB 가 열리지 않는다.
  it('변환한 DB 를 다시 열어도 옛 칸 · 옛 인덱스를 다시 만들지 않고, 날짜 인덱스는 새 칸에 건다', async () => {
    await convert([entry('e1', 'spend', 'etc', { accountId: 'maple-1' }), item('i1', 'e1', { item_name: '패스' })])
    await closeBossProfitDb()
    __setMigrationCeilingForTest(null)

    await getBossProfitDbUngated()

    const columns = all('PRAGMA table_info(cashbook_entries)').map((row) => row.name)
    expect(columns).not.toContain('entry_type')
    expect(columns).not.toContain('nexon_account_id')
    expect(all(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%_unconverted'`)).toEqual([])
    expect(all(`SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('inventory_items_owner_item', 'cashbook_entries_entry_date')`)).toEqual([])
    expect(all(`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'cashbook_entries_date'`)).toEqual([
      { sql: 'CREATE INDEX cashbook_entries_date ON cashbook_entries (date)' },
    ])
    expect(all('SELECT id FROM cashbook_entries')).toEqual([{ id: 'e1' }])
  })
})
