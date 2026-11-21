/**
 * 1.0.15 기기 변환의 가계부 단계. 가계부 기록 표 여섯 · 인벤토리 · 기억한 레벨을 서버 표와 같은 모양으로 옮긴다.
 *
 * 분류 · 품목의 대상 · 아이템 · 월드를 새 게임 데이터의 줄 id 로 찾으므로 게임 데이터가 준비된 뒤에 돈다. 옮기기 전에 주인을 모르는
 * 옛 손입력을 붙이고, 그래도 주인이 없는 기록은 옮기지 않는다. 줄이 없는 새 DB 에서는 찾을 것이 없어 게임 데이터 없이 돈다.
 */
import { ACCOUNT_INCOME_CATEGORY_KEYS, ACCOUNT_SPEND_CATEGORY_KEYS } from '../../lib/cashbook/categories'
import {
  cashbookCategoryIdOf,
  cashbookItemTypeIdOf,
  itemTargetIdOf,
  itemTargetTypeOf,
  spendRewardTypeIdOf,
  type CashbookEntryType,
} from '../../lib/cashbook/entry-ids'
import { findItem, ringLevelItemOf } from '../../lib/item-catalog'
import { findWorld } from '../../lib/world/worlds'
import type { SqliteDbConnection } from '../ports'
import {
  CASHBOOK_ENTRIES_BODY,
  CASHBOOK_ENTRIES_DATE_INDEX,
  CASHBOOK_ENTRY_EXCHANGE_INPUTS_BODY,
  CASHBOOK_ENTRY_FRAGMENT_USES_BODY,
  CASHBOOK_ENTRY_HUNT_INPUTS_BODY,
  CASHBOOK_ENTRY_ITEMS_BODY,
  CASHBOOK_ENTRY_TRANSFER_INPUTS_BODY,
  INVENTORY_ITEMS_BODY,
} from './cashbook-tables'
import type { DeviceConversionContext } from './device-conversion'
import { assignLegacyEntryAccounts, assignOwnerlessEntries } from './legacy-cashbook-entries'
import { REMEMBERED_LEVELS_BODY } from './remembered-level-tables'

type Row = Record<string, unknown>

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const integer = (value: unknown): number | null => (typeof value === 'number' ? value : null)
/** 1 · 0 · NULL 칸. 1 이 아닌 값은 거짓이다. */
const flag = (value: unknown): number | null => (value == null ? null : Number(value) === 1 ? 1 : 0)

/** 옮기는 표. 부모가 앞이다. 표 이름이 그대로라 옛 표를 `…_unconverted` 로 비켜 두고 새 표를 만든다. */
const TABLES = [
  ['inventory_items', INVENTORY_ITEMS_BODY],
  ['cashbook_entries', CASHBOOK_ENTRIES_BODY],
  ['cashbook_entry_items', CASHBOOK_ENTRY_ITEMS_BODY],
  ['cashbook_entry_hunt_inputs', CASHBOOK_ENTRY_HUNT_INPUTS_BODY],
  ['cashbook_entry_transfer_inputs', CASHBOOK_ENTRY_TRANSFER_INPUTS_BODY],
  ['cashbook_entry_exchange_inputs', CASHBOOK_ENTRY_EXCHANGE_INPUTS_BODY],
  ['cashbook_entry_fragment_uses', CASHBOOK_ENTRY_FRAGMENT_USES_BODY],
  ['remembered_levels', REMEMBERED_LEVELS_BODY],
] as const

const unconverted = (table: string): string => `${table}_unconverted`

async function rowsOf(db: SqliteDbConnection, sql: string): Promise<Row[]> {
  return ((await db.query(sql)).values ?? []) as Row[]
}

/** 그 캐릭터를 가장 늦게 본 메이플 ID. 헥사 강화가 가져올 기타 조각을 고를 때 쓰는 메이플 ID(`accountOfOcid`)와 같다. */
async function accountOfOcid(db: SqliteDbConnection, ocid: string): Promise<string | null> {
  const { values } = await db.query(
    'SELECT account_id FROM character_accounts WHERE ocid = ? ORDER BY last_seen_date DESC, rowid LIMIT 1',
    [ocid],
  )
  return text(values?.[0]?.account_id)
}

/**
 * 주인을 모르는 옛 손입력을 붙인다. 켜기 단계가 하던 차례 그대로다. 빈 글자 계정 칸(버전 16 전에 메인 계정으로 받은 줄)을 메인
 * 계정으로 채우고, 그 넥슨 계정의 메이플 ID 가 하나뿐이면 그 ID 로, 남은 기록은 대표 캐릭터에게 붙인다.
 */
async function attachOwnerlessEntries(db: SqliteDbConnection, context: DeviceConversionContext): Promise<void> {
  const main = context.mainNexonAccountId ?? null
  if (main !== null) {
    await db.run(`UPDATE cashbook_entries SET nexon_account_id = ? WHERE nexon_account_id = ''`, [main])
    // 메이플 ID 를 셀 때 그 계정의 캐릭터가 보이게 소속의 빈 글자 계정 칸도 채운다. 켜기 단계도 같은 값을 채운다.
    await db.run(`UPDATE character_accounts SET nexon_account_id = ? WHERE nexon_account_id = ''`, [main])
  }
  await assignLegacyEntryAccounts(db, 'income', ACCOUNT_INCOME_CATEGORY_KEYS)
  await assignLegacyEntryAccounts(db, 'spend', ACCOUNT_SPEND_CATEGORY_KEYS)
  const ocid = context.representativeOcid ?? null
  const accountId = ocid === null ? null : await accountOfOcid(db, ocid)
  if (ocid === null || accountId === null) return
  await assignOwnerlessEntries(db, 'income', { ocid, accountId }, ACCOUNT_INCOME_CATEGORY_KEYS)
  await assignOwnerlessEntries(db, 'spend', { ocid, accountId }, ACCOUNT_SPEND_CATEGORY_KEYS)
}

/** 아이템 줄 id. 레벨 줄이 표에 없는 반지는 레벨을 버리고 원래 반지 줄이다. 드롭 변환과 같은 규칙이다. */
function itemIdOf(key: string | null, level: number | null): string | null {
  const item = findItem(key)
  if (item === null) return null
  return (level === null ? null : ringLevelItemOf(item, level)?.id) ?? item.id
}

/** 인벤토리를 옮긴다. 아이템 · 월드 · 종류를 못 찾는 줄은 옮기지 않는다. @returns 옮긴 줄의 id */
async function convertInventory(db: SqliteDbConnection): Promise<Set<string>> {
  const kept = new Set<string>()
  for (const row of await rowsOf(db, `SELECT * FROM ${unconverted('inventory_items')} ORDER BY rowid`)) {
    const worldId = findWorld(text(row.world_key))?.id ?? null
    const itemId = itemIdOf(text(row.item_key), integer(row.ring_level))
    const typeId = cashbookItemTypeIdOf(String(row.item_kind_key))
    if (worldId === null || itemId === null || typeId === null) continue
    await db.run(
      `INSERT INTO inventory_items (id, account_id, world_id, item_id, cashbook_item_type_id, added_quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.account_id, worldId, itemId, typeId, row.quantity, row.created_at, row.updated_at],
    )
    kept.add(row.id as string)
  }
  return kept
}

interface ItemTarget {
  targetType: string | null
  targetId: string | null
  itemName: string | null
}

/**
 * 품목의 대상. 대상이 없는 분류는 key 를 버린다. 헥사 코어를 그 직업과 `전직업` 에서 못 찾으면 이름을 `item_name` 으로 옮긴다.
 * 손으로 적은 기록이라 지우지 않는다. 그 밖에 key 를 못 찾으면 `null` 이고 기록을 옮기지 않는다.
 */
function itemTargetOf(type: CashbookEntryType, categoryKey: string, item: Row, job: string | null): ItemTarget | null {
  const key = text(item.item_key)
  const itemName = text(item.item_name)
  const targetType = itemTargetTypeOf(type, categoryKey, item.hexa_activation == null ? null : Number(item.hexa_activation) === 1)
  if (targetType === null || key === null) return { targetType: null, targetId: null, itemName }
  const targetId =
    targetType === 'item' ? itemIdOf(key, integer(item.ring_level)) : itemTargetIdOf(targetType, key, { job })
  if (targetId !== null) return { targetType, targetId, itemName: null }
  return targetType === 'hexa_core' ? { targetType: null, targetId: null, itemName: key } : null
}

/** 사냥의 켠 효과 글자를 두 칸으로. 직접 입력 사냥과 효과 칸이 없는 줄은 둘 다 비운다. 차례는 보지 않는다. */
function boostsOf(hunt: Row): [number | null, number | null] {
  const boosts = text(hunt.boosts)
  if (hunt.typed_meso != null || boosts === null) return [null, null]
  const ids = boosts.split(',')
  return [ids.includes('potion') ? 1 : 0, ids.includes('union') ? 1 : 0]
}

/** 기록 id → 그 기록의 줄들. */
function groupByEntry(rows: readonly Row[]): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>()
  for (const row of rows) {
    const id = row.entry_id as string
    grouped.set(id, [...(grouped.get(id) ?? []), row])
  }
  return grouped
}

async function insertItem(db: SqliteDbConnection, entryId: string, item: Row, target: ItemTarget, inventory: ReadonlySet<string>): Promise<void> {
  const formKey = text(item.form_key)
  const kindKey = text(item.item_kind_key)
  const inventoryItemId = text(item.inventory_item_id)
  await db.run(
    `INSERT INTO cashbook_entry_items
       (id, entry_id, target_type, target_id, item_name, spend_reward_type_id, item_type_id, quantity, from_level, to_level,
        amount_meso, tariff_meso, sale_fee_percent, sale_fee_meso, sale_fee_follows_mvp_grade, amount_maple_point,
        maple_point_per_100m_meso, meso_market_fee_percent, amount_cash, fragment_quantity, untradable_fragment_quantity,
        fragment_price_meso, includes_hexa_activation, uses_stored_fragments, counts_stored_fragments_as_spend, inventory_item_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id, entryId, target.targetType, target.targetId, target.itemName,
      formKey === null ? null : spendRewardTypeIdOf(formKey), kindKey === null ? null : cashbookItemTypeIdOf(kindKey),
      item.quantity, item.from_level, item.to_level, item.amount_meso, item.tariff_meso, item.sale_fee_percent, item.sale_fee_meso,
      Number(item.sale_fee_auto) === 1 ? 1 : 0, item.amount_point, item.point_per_100m_meso, item.meso_market_fee_percent,
      item.amount_cash, item.fragment_count, item.untradable_fragment_count, item.fragment_price_meso, flag(item.hexa_activation),
      flag(item.hexa_use_storage), flag(item.hexa_storage_as_spend),
      inventoryItemId !== null && inventory.has(inventoryItemId) ? inventoryItemId : null,
    ],
  )
}

/** 딸린 입력 셋. 한 기록에 하나씩이다. */
async function insertInputs(db: SqliteDbConnection, entryId: string, inputs: { hunt?: Row; transfer?: Row; exchange?: Row }): Promise<void> {
  const { hunt, transfer, exchange } = inputs
  if (hunt !== undefined) {
    const [potion, union] = boostsOf(hunt)
    await db.run(
      `INSERT INTO cashbook_entry_hunt_inputs
         (id, entry_id, character_level, missed_mob_quantity, uses_wealth_potion, uses_union_wealth, union_wealth_tier,
          fragment_quantity, fragment_price_meso, meso_acquisition_percent, typed_meso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hunt.id, entryId, hunt.character_level, hunt.missed_mobs, potion, union, hunt.union_tier, hunt.fragments,
        hunt.fragment_price_meso, hunt.meso_rate, hunt.typed_meso,
      ],
    )
  }
  if (transfer !== undefined) {
    await db.run(
      `INSERT INTO cashbook_entry_transfer_inputs (id, entry_id, receiver_ocid, transfer_meso, fee_percent, fee_follows_mvp_grade)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [transfer.id, entryId, transfer.receiver_ocid, transfer.transfer_meso, transfer.fee_percent, Number(transfer.fee_auto) === 1 ? 1 : 0],
    )
  }
  if (exchange !== undefined) {
    await db.run(
      `INSERT INTO cashbook_entry_exchange_inputs
         (id, entry_id, sold_meso, sell_maple_point_per_100m_meso, bought_meso, buy_maple_point_per_100m_meso, meso_market_fee_percent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        exchange.id, entryId, exchange.sold_meso, exchange.sell_point_per_100m_meso, exchange.bought_meso,
        exchange.buy_point_per_100m_meso, exchange.meso_market_fee_percent,
      ],
    )
  }
}

/** 조각 사용 줄. 같은 보관 · 캐릭터의 줄이 둘이면 서버의 유일 기준과 같게 개수를 더해 한 줄로 합친다. 넣은 차례가 보관의 차례다. */
async function insertFragmentUses(db: SqliteDbConnection, entryId: string, uses: readonly Row[]): Promise<void> {
  const merged = new Map<string, { id: unknown; source: string; ocid: string | null; quantity: number }>()
  for (const use of uses) {
    const source = use.fragment_source === 'other' ? 'inventory' : 'hunt'
    const ocid = source === 'hunt' ? text(use.ocid) : null
    const key = `${source}|${ocid ?? ''}`
    const found = merged.get(key)
    if (found === undefined) merged.set(key, { id: use.id, source, ocid, quantity: Number(use.fragments) })
    else found.quantity += Number(use.fragments)
  }
  for (const use of merged.values()) {
    await db.run(
      'INSERT INTO cashbook_entry_fragment_uses (id, entry_id, fragment_source, ocid, fragment_quantity) VALUES (?, ?, ?, ?, ?)',
      [use.id, entryId, use.source, use.ocid, use.quantity],
    )
  }
}

/**
 * 가계부 기록과 딸린 줄을 옮긴다. 주인 · 분류를 모르거나 품목의 key 를 못 찾은 기록은 옮기지 않는다. 품목만 빼면 금액이 빈 기록이
 * 남기 때문이다.
 */
async function convertEntries(db: SqliteDbConnection, inventory: ReadonlySet<string>, jobOf: ReadonlyMap<string, string | null>): Promise<void> {
  const itemsOf = groupByEntry(await rowsOf(db, `SELECT * FROM ${unconverted('cashbook_entry_items')} ORDER BY entry_id, sort_order`))
  const usesOf = groupByEntry(await rowsOf(db, `SELECT * FROM ${unconverted('cashbook_entry_fragment_uses')} ORDER BY rowid`))
  const huntOf = groupByEntry(await rowsOf(db, `SELECT * FROM ${unconverted('cashbook_entry_hunt_inputs')}`))
  const transferOf = groupByEntry(await rowsOf(db, `SELECT * FROM ${unconverted('cashbook_entry_transfer_inputs')}`))
  const exchangeOf = groupByEntry(await rowsOf(db, `SELECT * FROM ${unconverted('cashbook_entry_exchange_inputs')}`))

  for (const entry of await rowsOf(db, `SELECT * FROM ${unconverted('cashbook_entries')} ORDER BY rowid`)) {
    const id = entry.id as string
    const type = entry.entry_type as CashbookEntryType
    const categoryKey = String(entry.category_key)
    const categoryId = cashbookCategoryIdOf(type, categoryKey)
    const ocid = text(entry.ocid)
    if (categoryId === null || (ocid === null && entry.account_id == null)) continue
    const job = ocid === null ? null : (jobOf.get(ocid) ?? null)
    const items = (itemsOf.get(id) ?? []).map((item) => ({ item, target: itemTargetOf(type, categoryKey, item, job) }))
    if (items.some(({ target }) => target === null)) continue

    const uses = usesOf.get(id) ?? []
    // 기타 조각은 기록의 메이플 ID · 월드에서 가져온다. 메이플 ID 기록과 월드가 빈 캐릭터 기록은 조각 사용 줄의 월드를 기록으로 옮긴다.
    const worldKey = text(entry.world_key) ?? text(uses.find((use) => use.fragment_source === 'other')?.world_key)
    await db.run(
      `INSERT INTO cashbook_entries (id, ocid, account_id, world_id, category_id, date, memo, recorded_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ocid, entry.account_id, findWorld(worldKey)?.id ?? null, categoryId, entry.entry_date, entry.memo, entry.created_at, entry.updated_at],
    )
    // 서버의 유일 기준(기록 · 추가 리워드 종류)과 같게, 같은 종류의 품목이 둘이면 먼저 적은 품목만 남긴다.
    const rewardTypes = new Set<string>()
    for (const { item, target } of items) {
      const rewardType = text(item.form_key) ?? ''
      if (rewardTypes.has(rewardType)) continue
      rewardTypes.add(rewardType)
      await insertItem(db, id, item, target!, inventory)
    }
    await insertInputs(db, id, { hunt: huntOf.get(id)?.[0], transfer: transferOf.get(id)?.[0], exchange: exchangeOf.get(id)?.[0] })
    await insertFragmentUses(db, id, uses)
  }
}

/** 기억한 레벨을 대상 줄 id 로 옮긴다. 못 찾은 대상은 버리고, 한 대상으로 모이는 줄이 둘이면 늦게 고친 줄을 남긴다. */
async function convertRememberedLevels(db: SqliteDbConnection, jobOf: ReadonlyMap<string, string | null>): Promise<void> {
  for (const row of await rowsOf(db, `SELECT * FROM ${unconverted('remembered_levels')} ORDER BY updated_at DESC, rowid`)) {
    const key = String(row.item_key)
    const ocid = row.ocid as string
    const targetId =
      row.kind === 'symbol'
        ? itemTargetIdOf('symbol', key)
        : row.kind === 'hexa'
          ? itemTargetIdOf('hexa_core', key, { job: jobOf.get(ocid) ?? null })
          : null
    if (targetId === null) continue
    await db.run(
      `INSERT OR IGNORE INTO remembered_levels (id, ocid, type, target_id, level, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, ocid, row.kind, targetId, row.level, row.updated_at],
    )
  }
}

/** 가계부 기록 표 여섯 · 인벤토리 · 기억한 레벨을 새 표로 옮기고 옛 표를 지운다. 기기 변환의 한 트랜잭션 안에서 돈다. */
export async function convertCashbookTables(db: SqliteDbConnection, context: DeviceConversionContext): Promise<void> {
  await attachOwnerlessEntries(db, context)
  for (const [table] of TABLES) await db.execute(`ALTER TABLE ${table} RENAME TO ${unconverted(table)}`)
  for (const [table, body] of TABLES) await db.execute(`CREATE TABLE ${table} ${body}`)

  const profiles = await rowsOf(db, 'SELECT ocid, job_class FROM character_profiles')
  const jobOf = new Map(profiles.map((row) => [row.ocid as string, text(row.job_class)]))
  await convertEntries(db, await convertInventory(db), jobOf)
  await convertRememberedLevels(db, jobOf)

  // 외래키를 켠 채라 자식부터 지운다.
  for (const [table] of [...TABLES].reverse()) await db.execute(`DROP TABLE ${unconverted(table)}`)
  await db.execute(CASHBOOK_ENTRIES_DATE_INDEX)
}
