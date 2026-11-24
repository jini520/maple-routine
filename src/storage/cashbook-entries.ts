/**
 * 가계부 기록 표 여섯(`cashbook_entries` · `cashbook_entry_items` · `cashbook_entry_hunt_inputs` ·
 * `cashbook_entry_transfer_inputs` · `cashbook_entry_exchange_inputs` · `cashbook_entry_fragment_uses`)을 읽고 쓰는 자리.
 *
 * 수입(`income.ts`)과 지출(`spend.ts`)이 이것을 함께 쓴다. 두 어댑터는 화면이 쓰는 기록 모양(`IncomeRecord` ·
 * `SpendRecord`)을 그대로 두고 이 모양과 서로 옮긴다. 그래서 표가 바뀌어도 화면 코드는 그대로다.
 *
 * 표는 분류 · 품목의 대상 · 아이템 종류 · 월드를 게임 데이터의 줄 id 로 적고, 이 모양은 key 를 든다. 쓸 때 key 를 줄 id 로
 * 바꾸고 읽을 때 되돌린다. 표에 없는 key 는 적지 못해 던진다.
 */
import { findCashbookCategoryById, SPEND_FORM_KEYS } from '../lib/cashbook/categories'
import {
  cashbookCategoryIdOf,
  cashbookCategoryIdsOf,
  cashbookItemTypeIdOf,
  cashbookItemTypeKeyOf,
  itemTargetIdOf,
  itemTargetKeyOf,
  itemTargetTypeOf,
  spendRewardTypeIdOf,
  spendRewardTypeKeyOf,
  type CashbookEntryType,
  type CashbookItemTargetType,
} from '../lib/cashbook/entry-ids'
import { findWorld, findWorldById } from '../lib/world/worlds'
import type { SqliteDbConnection } from './ports'
import { NEW_UUID_SQL } from './sqlite/uuid'

export type EntryType = CashbookEntryType

export interface EntryHead {
  id: string
  ocid: string | null
  /** 메이플 ID 기록의 ID. 새 기록은 이것과 `ocid` 중 하나만 든다. */
  accountId: string | null
  entryType: EntryType
  categoryKey: string
  entryDate: string
  /** 아이템 구매 · 판매의 메모. 앞뒤 공백을 걷은 값이고 없으면 `null` 이다. */
  memo: string | null
  /**
   * 메이플 ID 기록의 월드. 인벤토리에서 판 기타 조각 기록만 판 조각의 월드를 든다. 캐릭터 기록은 비어 있고, 월드는 저장할 때
   * 캐릭터의 프로필에서 정한다.
   */
  worldKey: string | null
  createdAt: string
}

export interface EntryItem {
  itemKey: string | null
  itemName: string | null
  formKey: string | null
  itemKindKey: string | null
  quantity: number | null
  fromLevel: number | null
  toLevel: number | null
  amountMeso: number | null
  tariffMeso: number | null
  saleFeePercent: number | null
  saleFeeMeso: number | null
  saleFeeAuto: boolean
  amountPoint: number | null
  pointPer100mMeso: number | null
  mesoMarketFeePercent: number | null
  amountCash: number | null
  fragmentCount: number | null
  untradableFragmentCount: number | null
  fragmentPriceMeso: number | null
  /** 헥사 스탯만 참 · 거짓이고 나머지는 `null` 이다. */
  hexaActivation: boolean | null
  /** 헥사 기록만 참 · 거짓이고 나머지는 `null` 이다. */
  hexaUseStorage: boolean | null
  hexaStorageAsSpend: boolean | null
  /** 이 품목이 가리키는 인벤토리 줄. 인벤토리에서 판 판매와 인벤토리에 보관한 구매가 채운다. 나머지는 `null` 이다. */
  inventoryItemId: string | null
  /** 아이템 구매 · 판매에서 고른 특수스킬 반지의 레벨. 다른 품목은 `null` 이다. */
  ringLevel: number | null
  /**
   * 헥사 스킬 품목이 가리키는 코어 줄 id. 읽을 때만 채운다. 저장은 key 와 캐릭터의 직업으로 줄을 다시 고르므로 이 값을 보지 않는다.
   */
  hexaCoreId: string | null
}

/** 헥사 기록이 한 캐릭터의 사냥 조각 보관에서 가져온 조각. */
export interface FragmentUse {
  ocid: string
  fragments: number
}

/**
 * 기록이 한 메이플 ID · 월드의 기타 조각(인벤토리에 넣은 조각)에서 가져온 조각. 표는 개수만 적고, 메이플 ID · 월드는 기록의 것이다.
 * 캐릭터 기록의 메이플 ID 는 그 캐릭터를 가장 늦게 본 메이플 ID 다.
 */
export interface OtherFragmentUse {
  accountId: string
  worldKey: string
  fragments: number
}

export interface EntryHunt {
  characterLevel: number | null
  missedMobs: number | null
  boosts: string | null
  fragments: number | null
  fragmentPrice: number | null
  mesoRate: number | null
  typedMeso: number | null
  unionTier: number | null
}

/** `주간 보스 수입 이전` 시트의 입력. */
export interface EntryTransfer {
  receiverOcid: string
  transferMeso: number
  feePercent: number
  feeAuto: boolean
}

/** `메소마켓 환전 수수료` 시트의 입력. 판매만 적었으면 구매 두 칸이 `null` 이다. */
export interface EntryExchange {
  soldMeso: number
  sellPointPer100mMeso: number
  boughtMeso: number | null
  buyPointPer100mMeso: number | null
  mesoMarketFeePercent: number
}

export interface StoredEntry {
  head: EntryHead
  /** 차례대로다. 하나 이상이다. */
  items: EntryItem[]
  hunt: EntryHunt | null
  /** 이 줄이 있으면 `주간 보스 수입 이전` 시트로 연다 */
  transfer?: EntryTransfer | null
  /** 이 줄이 있으면 `메소마켓 환전 수수료` 시트로 연다 */
  exchange?: EntryExchange | null
  /** 헥사 기록이 사냥 조각 보관에서 가져온 조각. 다른 기록은 빈 배열이다. */
  fragmentUses: readonly FragmentUse[]
  /** 헥사 강화와 인벤토리의 기타 조각 판매가 기타 조각에서 가져온 조각. 다른 기록은 빈 배열이다. */
  otherFragmentUses: readonly OtherFragmentUse[]
}

/** 빈 품목. 쓰는 칸만 덮어 만든다. */
export const EMPTY_ITEM: EntryItem = {
  itemKey: null,
  itemName: null,
  formKey: null,
  itemKindKey: null,
  quantity: null,
  fromLevel: null,
  toLevel: null,
  amountMeso: null,
  tariffMeso: null,
  saleFeePercent: null,
  saleFeeMeso: null,
  saleFeeAuto: false,
  amountPoint: null,
  pointPer100mMeso: null,
  mesoMarketFeePercent: null,
  amountCash: null,
  fragmentCount: null,
  untradableFragmentCount: null,
  fragmentPriceMeso: null,
  hexaActivation: null,
  hexaUseStorage: null,
  hexaStorageAsSpend: null,
  inventoryItemId: null,
  ringLevel: null,
  hexaCoreId: null,
}

function flagOf(value: boolean | null): number | null {
  return value === null ? null : value ? 1 : 0
}

/** SQL 에 넣는 게임 데이터 줄 id 의 글자. 서버가 준 값이라 사용자 입력이 아니고, 따옴표만 겹쳐 적는다. */
export function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * 수입이나 지출 기록을 고르는 조건. 기록 표에 수입 · 지출 칸이 없어 분류 줄 id 로 가른다.
 *
 * @param alias 기록 행의 별칭
 * @example readEntries(db, `${entryTypeSql('spend')} AND e.date BETWEEN ? AND ?`, [from, to])
 */
export function entryTypeSql(entryType: EntryType, alias = 'e'): string {
  return `${alias}.category_id IN (${cashbookCategoryIdsOf(entryType).map(sqlText).join(', ')})`
}

/**
 * 한 분류의 기록을 고르는 조건. 표에 없는 분류는 아무 기록도 고르지 않는다.
 *
 * @param alias 기록 행의 별칭
 */
export function categorySql(entryType: EntryType, categoryKey: string, alias = 'e'): string {
  const id = cashbookCategoryIdOf(entryType, categoryKey)
  return id === null ? '0' : `${alias}.category_id = ${sqlText(id)}`
}

/**
 * 기록의 메이플 ID 를 고르는 식. 메이플 ID 기록은 그 칸이고, 캐릭터 기록은 그 캐릭터를 가장 늦게 본 메이플 ID 다. 헥사 강화가 가져올
 * 기타 조각을 고를 때 쓰는 메이플 ID(`accountOfOcid`)와 같아야 그 조각이 같은 자리에서 빠진다.
 *
 * @param alias 기록 행의 별칭
 */
export function entryAccountSql(alias = 'e'): string {
  return `COALESCE(${alias}.account_id, (SELECT ca.account_id FROM character_accounts ca WHERE ca.ocid = ${alias}.ocid
           ORDER BY ca.last_seen_date DESC, ca.rowid LIMIT 1))`
}

/** 표에 없는 key 를 적으려 할 때 던지는 실패. 줄 id 칸을 비우면 다른 물건의 기록이 되거나 기록이 사라진다. */
function unknownKey(what: string, key: string): Error {
  return new Error(`가계부 기록에 적을 수 없는 ${what}입니다: ${key}`)
}

/** 기록을 적을 때 그 캐릭터의 프로필에서 읽는 값. 월드는 기록의 월드가 되고, 직업은 헥사 코어 줄을 고른다. */
async function profileOf(db: SqliteDbConnection, ocid: string | null): Promise<{ worldKey: string | null; job: string | null }> {
  if (ocid === null) return { worldKey: null, job: null }
  const { values } = await db.query('SELECT world_key, job_class FROM character_profiles WHERE ocid = ?', [ocid])
  const row = values?.[0]
  return { worldKey: textOrNull(row?.world_key), job: textOrNull(row?.job_class) }
}

/** 메이플 ID 기록의 월드 줄 id. 기타 조각을 가져간 기록은 그 월드가 있어야 남은 조각을 셀 수 있어, 모르면 던진다. */
function accountWorldIdOf(entry: StoredEntry): string | null {
  const worldKey = entry.head.worldKey ?? entry.otherFragmentUses[0]?.worldKey ?? null
  const worldId = worldKey === null ? null : (findWorld(worldKey)?.id ?? null)
  if (worldId === null && entry.otherFragmentUses.length > 0) throw unknownKey('월드', worldKey ?? '(없음)')
  return worldId
}

/** 캐릭터 기록의 월드 줄 id. 월드는 기록의 속성이라 표에 없으면 비운다. */
function profileWorldIdOf(worldKey: string | null): string | null {
  return worldKey === null ? null : (findWorld(worldKey)?.id ?? null)
}

interface StoredTarget {
  targetType: CashbookItemTargetType | null
  targetId: string | null
  itemName: string | null
}

/**
 * 품목의 대상 칸. 대상이 없는 분류에 key 가 오면 던진다. 헥사 코어를 그 직업과 `전직업` 에서 못 찾으면 변환과 같게 이름을
 * `item_name` 에 적는다. 읽을 때 코어 이름으로 되돌린다.
 */
function storedTargetOf(head: EntryHead, item: EntryItem, job: string | null): StoredTarget {
  const type = itemTargetTypeOf(head.entryType, head.categoryKey, item.hexaActivation)
  if (item.itemKey === null) return { targetType: null, targetId: null, itemName: item.itemName }
  if (type === null) throw unknownKey(`${head.categoryKey} 분류의 품목`, item.itemKey)
  const targetId = itemTargetIdOf(type, item.itemKey, { ringLevel: item.ringLevel, job })
  if (targetId !== null) return { targetType: type, targetId, itemName: null }
  if (type === 'hexa_core') return { targetType: null, targetId: null, itemName: item.itemKey }
  throw unknownKey('품목', item.itemKey)
}

/** key 칸의 줄 id. 비었으면 비우고, 표에 없으면 던진다. */
function idOrThrow(key: string | null, idOf: (key: string) => string | null, what: string): string | null {
  if (key === null) return null
  const id = idOf(key)
  if (id === null) throw unknownKey(what, key)
  return id
}

const INSERT_ITEM_SQL = `
  INSERT INTO cashbook_entry_items
    (id, entry_id, target_type, target_id, item_name, spend_reward_type_id, item_type_id, quantity, from_level, to_level,
     amount_meso, tariff_meso, sale_fee_percent, sale_fee_meso, sale_fee_follows_mvp_grade, amount_maple_point,
     maple_point_per_100m_meso, meso_market_fee_percent, amount_cash, fragment_quantity, untradable_fragment_quantity,
     fragment_price_meso, includes_hexa_activation, uses_stored_fragments, counts_stored_fragments_as_spend, inventory_item_id)
  VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

const INSERT_FRAGMENT_USE_SQL = `
  INSERT INTO cashbook_entry_fragment_uses (id, entry_id, fragment_source, ocid, fragment_quantity)
  VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?)
`

const INSERT_HUNT_SQL = `
  INSERT INTO cashbook_entry_hunt_inputs
    (id, entry_id, character_level, missed_mob_quantity, uses_wealth_potion, uses_union_wealth, union_wealth_tier,
     fragment_quantity, fragment_price_meso, meso_acquisition_percent, typed_meso)
  VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

/** 켠 효과 글자(`potion,union`)를 두 칸으로. 직접 입력 사냥은 글자가 비어 둘 다 비운다. */
function boostColumnsOf(boosts: string | null): [number | null, number | null] {
  if (boosts === null) return [null, null]
  const ids = boosts.split(',')
  return [ids.includes('potion') ? 1 : 0, ids.includes('union') ? 1 : 0]
}

/** 두 칸을 켠 효과 글자로. 차례는 효과 목록(`MESO_BOOSTS`)의 차례다. */
function boostsOf(potion: unknown, union: unknown): string | null {
  if (potion == null && union == null) return null
  return [Number(potion) === 1 ? 'potion' : null, Number(union) === 1 ? 'union' : null].filter((id) => id !== null).join(',')
}

async function writeChildren(db: SqliteDbConnection, entry: StoredEntry, job: string | null): Promise<void> {
  for (const item of entry.items) {
    const target = storedTargetOf(entry.head, item, job)
    await db.run(INSERT_ITEM_SQL, [
      entry.head.id,
      target.targetType,
      target.targetId,
      target.itemName,
      idOrThrow(item.formKey, spendRewardTypeIdOf, '추가 리워드 종류'),
      idOrThrow(item.itemKindKey, cashbookItemTypeIdOf, '아이템 종류'),
      item.quantity,
      item.fromLevel,
      item.toLevel,
      item.amountMeso,
      item.tariffMeso,
      item.saleFeePercent,
      item.saleFeeMeso,
      item.saleFeeAuto ? 1 : 0,
      item.amountPoint,
      item.pointPer100mMeso,
      item.mesoMarketFeePercent,
      item.amountCash,
      item.fragmentCount,
      item.untradableFragmentCount,
      item.fragmentPriceMeso,
      flagOf(item.hexaActivation),
      flagOf(item.hexaUseStorage),
      flagOf(item.hexaStorageAsSpend),
      item.inventoryItemId,
    ])
  }
  for (const use of entry.fragmentUses) {
    await db.run(INSERT_FRAGMENT_USE_SQL, [entry.head.id, 'hunt', use.ocid, use.fragments])
  }
  for (const use of entry.otherFragmentUses) {
    await db.run(INSERT_FRAGMENT_USE_SQL, [entry.head.id, 'inventory', null, use.fragments])
  }
  const { transfer, exchange } = entry
  if (transfer != null) {
    await db.run(
      `INSERT INTO cashbook_entry_transfer_inputs (id, entry_id, receiver_ocid, transfer_meso, fee_percent, fee_follows_mvp_grade)
       VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?)`,
      [entry.head.id, transfer.receiverOcid, transfer.transferMeso, transfer.feePercent, transfer.feeAuto ? 1 : 0],
    )
  }
  if (exchange != null) {
    await db.run(
      `INSERT INTO cashbook_entry_exchange_inputs
         (id, entry_id, sold_meso, sell_maple_point_per_100m_meso, bought_meso, buy_maple_point_per_100m_meso, meso_market_fee_percent)
       VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?, ?)`,
      [
        entry.head.id,
        exchange.soldMeso,
        exchange.sellPointPer100mMeso,
        exchange.boughtMeso,
        exchange.buyPointPer100mMeso,
        exchange.mesoMarketFeePercent,
      ],
    )
  }
  const hunt = entry.hunt
  if (hunt === null) return
  const [potion, union] = boostColumnsOf(hunt.boosts)
  await db.run(INSERT_HUNT_SQL, [
    entry.head.id,
    hunt.characterLevel,
    hunt.missedMobs,
    potion,
    union,
    hunt.unionTier,
    hunt.fragments,
    hunt.fragmentPrice,
    hunt.mesoRate,
    hunt.typedMeso,
  ])
}

/** 기록의 분류 줄 id. 표에 없는 분류는 던진다. */
function categoryIdOf(head: EntryHead): string {
  const id = cashbookCategoryIdOf(head.entryType, head.categoryKey)
  if (id === null) throw unknownKey('분류', head.categoryKey)
  return id
}

/**
 * 부르는 쪽이 트랜잭션으로 감싼다. 품목이 기록 행과 함께 서야 한다.
 *
 * 캐릭터 기록의 월드는 그 캐릭터의 프로필 월드다. 같은 ocid 의 월드는 바뀌지 않아 기록을 적을 때 한 번 정한다.
 */
export async function insertEntry(db: SqliteDbConnection, entry: StoredEntry): Promise<void> {
  const { head } = entry
  const profile = await profileOf(db, head.ocid)
  const worldId = head.ocid === null ? accountWorldIdOf(entry) : profileWorldIdOf(profile.worldKey)
  await db.run(
    `INSERT INTO cashbook_entries (id, ocid, account_id, world_id, category_id, date, memo, recorded_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [head.id, head.ocid, head.accountId, worldId, categoryIdOf(head), head.entryDate, head.memo, head.createdAt, head.createdAt],
  )
  await writeChildren(db, entry, profile.job)
}

/**
 * 갈아 끼우기. 기록 행은 고치고 품목 · 사냥 입력은 지우고 다시 쓴다. `recorded_at` 은 그대로라 같은 날 안의 차례가
 * 안 바뀐다. 부르는 쪽이 트랜잭션으로 감싼다.
 *
 * 캐릭터 기록의 월드는 캐릭터를 바꿨을 때만 다시 채운다. 리프로 옮긴 기록을 새 ocid 의 월드로 덮으면 리프 전 기록이 새 월드로
 * 옮겨 간다.
 *
 * @param now 마지막으로 고친 시각
 */
export async function replaceEntry(db: SqliteDbConnection, entry: StoredEntry, now: Date): Promise<void> {
  const { head } = entry
  const { values } = await db.query('SELECT ocid, world_id FROM cashbook_entries WHERE id = ?', [head.id])
  const before = values?.[0]
  const profile = await profileOf(db, head.ocid)
  const worldId =
    head.ocid === null
      ? accountWorldIdOf(entry)
      : before !== undefined && before.ocid === head.ocid
        ? textOrNull(before.world_id)
        : profileWorldIdOf(profile.worldKey)
  await db.run(
    `UPDATE cashbook_entries
        SET ocid = ?, account_id = ?, world_id = ?, category_id = ?, date = ?, memo = ?, updated_at = ?
      WHERE id = ?`,
    [head.ocid, head.accountId, worldId, categoryIdOf(head), head.entryDate, head.memo, now.toISOString(), head.id],
  )
  await db.run(`DELETE FROM cashbook_entry_items WHERE entry_id = ?`, [head.id])
  await db.run(`DELETE FROM cashbook_entry_hunt_inputs WHERE entry_id = ?`, [head.id])
  await db.run(`DELETE FROM cashbook_entry_transfer_inputs WHERE entry_id = ?`, [head.id])
  await db.run(`DELETE FROM cashbook_entry_exchange_inputs WHERE entry_id = ?`, [head.id])
  await db.run(`DELETE FROM cashbook_entry_fragment_uses WHERE entry_id = ?`, [head.id])
  await writeChildren(db, entry, profile.job)
}

/** 품목 · 사냥 입력 · 보관에서 가져온 조각은 외래키를 따라 함께 지워진다. */
export async function deleteEntry(db: SqliteDbConnection, id: string): Promise<void> {
  await db.run(`DELETE FROM cashbook_entries WHERE id = ?`, [id])
}

/**
 * 월드 리프한 캐릭터의 기록을 새 ocid 로 옮긴다. 월드 칸은 그대로라 리프 전 월드의 기록으로 남는다. 부르는 쪽이 트랜잭션으로 감싼다.
 *
 * @returns 옮긴 것이 있었는지
 */
export async function moveEntriesToOcid(
  db: SqliteDbConnection,
  entryType: EntryType,
  fromOcid: string,
  toOcid: string,
): Promise<boolean> {
  const scope = `${entryTypeSql(entryType, 'cashbook_entries')} AND ocid = ?`
  const { values } = await db.query(`SELECT COUNT(*) AS n FROM cashbook_entries WHERE ${scope}`, [fromOcid])
  if (Number(values?.[0]?.n ?? 0) === 0) return false
  await db.run(`UPDATE cashbook_entries SET ocid = ? WHERE ${scope}`, [toOcid, fromOcid])
  return true
}

/**
 * 헥사 강화가 월드 리프한 캐릭터의 보관에서 가져간 조각을 새 ocid 의 몫으로 옮긴다. 조각 보관은 사냥 기록과 이 줄에서 세므로, 기록만
 * 옮기면 새 캐릭터의 보관이 가져간 만큼 많아진다. 부르는 쪽이 트랜잭션으로 감싼다.
 *
 * @returns 옮긴 것이 있었는지
 */
export async function moveFragmentUsesToOcid(db: SqliteDbConnection, fromOcid: string, toOcid: string): Promise<boolean> {
  const { values } = await db.query(`SELECT COUNT(*) AS n FROM cashbook_entry_fragment_uses WHERE ocid = ?`, [fromOcid])
  if (Number(values?.[0]?.n ?? 0) === 0) return false
  await db.run(`UPDATE cashbook_entry_fragment_uses SET ocid = ? WHERE ocid = ?`, [toOcid, fromOcid])
  return true
}

function numberOrNull(value: unknown): number | null {
  return (value as number | null | undefined) ?? null
}

function textOrNull(value: unknown): string | null {
  return (value as string | null | undefined) ?? null
}

function booleanOrNull(value: unknown): boolean | null {
  return value == null ? null : Number(value) === 1
}

/**
 * 품목 줄을 key 모양으로. 헥사 매트릭스 기록의 대상이 비었으면 `item_name` 이 표에서 못 찾은 코어 이름이라 key 로 되돌린다. 화면은
 * 코어 이름을 key 로 든다.
 */
function itemOf(row: Record<string, unknown>, head: EntryHead): EntryItem {
  const type = textOrNull(row.target_type) as CashbookItemTargetType | null
  const targetId = textOrNull(row.target_id)
  const target = type === null || targetId === null ? null : itemTargetKeyOf(type, targetId)
  const itemName = textOrNull(row.item_name)
  const coreName = head.entryType === 'spend' && head.categoryKey === 'hexa_matrix' && type === null ? itemName : null
  const rewardTypeId = textOrNull(row.spend_reward_type_id)
  const itemTypeId = textOrNull(row.item_type_id)
  return {
    itemKey: target?.key ?? coreName,
    itemName: coreName === null ? itemName : null,
    formKey: rewardTypeId === null ? null : spendRewardTypeKeyOf(rewardTypeId),
    itemKindKey: itemTypeId === null ? null : cashbookItemTypeKeyOf(itemTypeId),
    quantity: numberOrNull(row.quantity),
    fromLevel: numberOrNull(row.from_level),
    toLevel: numberOrNull(row.to_level),
    amountMeso: numberOrNull(row.amount_meso),
    tariffMeso: numberOrNull(row.tariff_meso),
    saleFeePercent: numberOrNull(row.sale_fee_percent),
    saleFeeMeso: numberOrNull(row.sale_fee_meso),
    saleFeeAuto: Number(row.sale_fee_follows_mvp_grade) === 1,
    amountPoint: numberOrNull(row.amount_maple_point),
    pointPer100mMeso: numberOrNull(row.maple_point_per_100m_meso),
    mesoMarketFeePercent: numberOrNull(row.meso_market_fee_percent),
    amountCash: numberOrNull(row.amount_cash),
    fragmentCount: numberOrNull(row.fragment_quantity),
    untradableFragmentCount: numberOrNull(row.untradable_fragment_quantity),
    fragmentPriceMeso: numberOrNull(row.fragment_price_meso),
    hexaActivation: booleanOrNull(row.includes_hexa_activation),
    hexaUseStorage: booleanOrNull(row.uses_stored_fragments),
    hexaStorageAsSpend: booleanOrNull(row.counts_stored_fragments_as_spend),
    inventoryItemId: textOrNull(row.inventory_item_id),
    ringLevel: target?.ringLevel ?? null,
    hexaCoreId: type === 'hexa_core' ? targetId : null,
  }
}

/** 품목의 차례. 추가 리워드 종류의 차례(`SPEND_FORM_KEYS`)이고 종류가 없는 품목이 앞이다. */
function itemOrderOf(item: EntryItem): number {
  return item.formKey === null ? -1 : (SPEND_FORM_KEYS as readonly string[]).indexOf(item.formKey)
}

function huntOf(row: Record<string, unknown>): EntryHunt {
  return {
    characterLevel: numberOrNull(row.character_level),
    missedMobs: numberOrNull(row.missed_mob_quantity),
    boosts: boostsOf(row.uses_wealth_potion, row.uses_union_wealth),
    fragments: numberOrNull(row.fragment_quantity),
    fragmentPrice: numberOrNull(row.fragment_price_meso),
    mesoRate: numberOrNull(row.meso_acquisition_percent),
    typedMeso: numberOrNull(row.typed_meso),
    unionTier: numberOrNull(row.union_wealth_tier),
  }
}

function transferOf(row: Record<string, unknown>): EntryTransfer {
  return {
    receiverOcid: row.receiver_ocid as string,
    transferMeso: Number(row.transfer_meso),
    feePercent: Number(row.fee_percent),
    feeAuto: Number(row.fee_follows_mvp_grade) === 1,
  }
}

function exchangeOf(row: Record<string, unknown>): EntryExchange {
  return {
    soldMeso: Number(row.sold_meso),
    sellPointPer100mMeso: Number(row.sell_maple_point_per_100m_meso),
    boughtMeso: numberOrNull(row.bought_meso),
    buyPointPer100mMeso: numberOrNull(row.buy_maple_point_per_100m_meso),
    mesoMarketFeePercent: Number(row.meso_market_fee_percent),
  }
}

/** 기록 행의 머리. 분류 줄을 모르면 수입인지 지출인지 몰라 `null` 이고 그 기록은 읽지 않는다. */
function headOf(row: Record<string, unknown>): EntryHead | null {
  const category = findCashbookCategoryById(row.category_id as string)
  if (category === null) return null
  const worldId = textOrNull(row.world_id)
  return {
    id: row.id as string,
    ocid: textOrNull(row.ocid),
    accountId: textOrNull(row.account_id),
    entryType: category.entryType,
    categoryKey: category.key,
    entryDate: row.date as string,
    memo: textOrNull(row.memo),
    worldKey: row.ocid == null && worldId !== null ? (findWorldById(worldId)?.key ?? null) : null,
    createdAt: row.recorded_at as string,
  }
}

/**
 * 조건에 맞는 기록과 그 품목 · 사냥 입력. 기록은 날짜 · 저장 시각 차례다.
 *
 * @param where `e` 로 기록 행을 가리키는 조건. 품목 칸으로 거르려면 `EXISTS` 로 쓴다
 * @example await readEntries(db, `${entryTypeSql('spend')} AND e.date BETWEEN ? AND ?`, [from, to])
 */
export async function readEntries(db: SqliteDbConnection, where: string, params: unknown[]): Promise<StoredEntry[]> {
  const ids = `SELECT e.id FROM cashbook_entries e WHERE ${where}`
  const [heads, items, hunts, uses, transfers, exchanges] = await Promise.all([
    db.query(`SELECT e.* FROM cashbook_entries e WHERE ${where} ORDER BY e.date, e.recorded_at, e.id`, params),
    db.query(`SELECT * FROM cashbook_entry_items WHERE entry_id IN (${ids}) ORDER BY entry_id, rowid`, params),
    db.query(`SELECT * FROM cashbook_entry_hunt_inputs WHERE entry_id IN (${ids})`, params),
    // 차례 칸이 없어 rowid 로 넣은 차례(강화한 캐릭터 먼저, 그다음 캐릭터 관리 순서)를 지킨다.
    db.query(
      `SELECT u.*, ${entryAccountSql('e')} AS owner_account_id, e.world_id AS owner_world_id
         FROM cashbook_entry_fragment_uses u JOIN cashbook_entries e ON e.id = u.entry_id
        WHERE u.entry_id IN (${ids}) ORDER BY u.rowid`,
      params,
    ),
    db.query(`SELECT * FROM cashbook_entry_transfer_inputs WHERE entry_id IN (${ids})`, params),
    db.query(`SELECT * FROM cashbook_entry_exchange_inputs WHERE entry_id IN (${ids})`, params),
  ])
  const headOfEntry = new Map<string, EntryHead>()
  for (const row of heads.values ?? []) {
    const head = headOf(row)
    if (head !== null) headOfEntry.set(head.id, head)
  }
  const usesOf = new Map<string, FragmentUse[]>()
  const otherUsesOf = new Map<string, OtherFragmentUse[]>()
  for (const row of uses.values ?? []) {
    const id = row.entry_id as string
    if (row.fragment_source === 'inventory') {
      const list = otherUsesOf.get(id) ?? []
      const worldId = textOrNull(row.owner_world_id)
      list.push({
        accountId: textOrNull(row.owner_account_id) ?? '',
        worldKey: (worldId === null ? null : findWorldById(worldId)?.key) ?? '',
        fragments: Number(row.fragment_quantity),
      })
      otherUsesOf.set(id, list)
      continue
    }
    const list = usesOf.get(id) ?? []
    list.push({ ocid: row.ocid as string, fragments: Number(row.fragment_quantity) })
    usesOf.set(id, list)
  }
  const itemsOf = new Map<string, EntryItem[]>()
  for (const row of items.values ?? []) {
    const id = row.entry_id as string
    const head = headOfEntry.get(id)
    if (head === undefined) continue
    const list = itemsOf.get(id) ?? []
    list.push(itemOf(row, head))
    itemsOf.set(id, list)
  }
  const huntOfEntry = new Map((hunts.values ?? []).map((row) => [row.entry_id as string, huntOf(row)]))
  const transferOfEntry = new Map((transfers.values ?? []).map((row) => [row.entry_id as string, transferOf(row)]))
  const exchangeOfEntry = new Map((exchanges.values ?? []).map((row) => [row.entry_id as string, exchangeOf(row)]))
  return [...headOfEntry.values()].map((head) => ({
    head,
    items: [...(itemsOf.get(head.id) ?? [{ ...EMPTY_ITEM }])].sort((a, b) => itemOrderOf(a) - itemOrderOf(b)),
    hunt: huntOfEntry.get(head.id) ?? null,
    transfer: transferOfEntry.get(head.id) ?? null,
    exchange: exchangeOfEntry.get(head.id) ?? null,
    fragmentUses: usesOf.get(head.id) ?? [],
    otherFragmentUses: otherUsesOf.get(head.id) ?? [],
  }))
}
