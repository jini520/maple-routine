/**
 * 가계부 기록 표 넷(`cashbook_entries` · `cashbook_entry_items` · `cashbook_entry_hunt_inputs` ·
 * `cashbook_entry_fragment_uses`)을 읽고 쓰는 자리.
 *
 * 수입(`income.ts`)과 지출(`spend.ts`)이 이것을 함께 쓴다. 두 어댑터는 화면이 쓰는 기록 모양(`IncomeRecord` ·
 * `SpendRecord`)을 그대로 두고 이 모양과 서로 옮긴다. 그래서 표가 바뀌어도 화면 코드는 그대로다.
 */
import type { SqliteDbConnection } from './ports'
import { NEW_UUID_SQL } from './sqlite/uuid'

export type EntryType = 'income' | 'spend'

export interface EntryHead {
  id: string
  ocid: string | null
  /** 메이플 ID 기록의 ID. 새 기록은 이것과 `ocid` 중 하나만 든다. */
  accountId: string | null
  entryType: EntryType
  categoryKey: string
  entryDate: string
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
}

/** 헥사 기록이 한 캐릭터의 보관에서 가져온 조각. */
export interface FragmentUse {
  ocid: string
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

export interface StoredEntry {
  head: EntryHead
  /** 차례대로다. 하나 이상이다. */
  items: EntryItem[]
  hunt: EntryHunt | null
  /** 헥사 기록이 보관에서 가져온 조각. 다른 기록은 빈 배열이다. */
  fragmentUses: readonly FragmentUse[]
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
}

function flagOf(value: boolean | null): number | null {
  return value === null ? null : value ? 1 : 0
}

const INSERT_ITEM_SQL = `
  INSERT INTO cashbook_entry_items
    (id, entry_id, sort_order, item_key, item_name, form_key, item_kind_key, quantity, from_level, to_level,
     amount_meso, tariff_meso, sale_fee_percent, sale_fee_meso, sale_fee_auto, amount_point, point_per_100m_meso,
     meso_market_fee_percent, amount_cash,
     fragment_count, untradable_fragment_count, fragment_price_meso, hexa_activation, hexa_use_storage, hexa_storage_as_spend)
  VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

const INSERT_FRAGMENT_USE_SQL = `
  INSERT INTO cashbook_entry_fragment_uses (id, entry_id, ocid, fragments) VALUES (${NEW_UUID_SQL}, ?, ?, ?)
`

const INSERT_HUNT_SQL = `
  INSERT INTO cashbook_entry_hunt_inputs
    (id, entry_id, character_level, missed_mobs, boosts, fragments, fragment_price_meso, meso_rate, typed_meso, union_tier)
  VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

async function writeChildren(db: SqliteDbConnection, entry: StoredEntry): Promise<void> {
  for (const [index, item] of entry.items.entries()) {
    await db.run(INSERT_ITEM_SQL, [
      entry.head.id,
      index,
      item.itemKey,
      item.itemName,
      item.formKey,
      item.itemKindKey,
      item.quantity,
      item.fromLevel,
      item.toLevel,
      item.amountMeso,
      item.tariffMeso,
      item.saleFeePercent,
      item.saleFeeMeso,
      item.saleFeeAuto ? 1 : null,
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
    ])
  }
  for (const use of entry.fragmentUses) {
    await db.run(INSERT_FRAGMENT_USE_SQL, [entry.head.id, use.ocid, use.fragments])
  }
  const hunt = entry.hunt
  if (hunt === null) return
  await db.run(INSERT_HUNT_SQL, [
    entry.head.id,
    hunt.characterLevel,
    hunt.missedMobs,
    hunt.boosts,
    hunt.fragments,
    hunt.fragmentPrice,
    hunt.mesoRate,
    hunt.typedMeso,
    hunt.unionTier,
  ])
}

/** 그 ocid 의 프로필 월드. 같은 ocid 의 월드는 바뀌지 않아 기록을 적을 때 한 번 정한다. ocid 가 `NULL` 이면 `NULL` 이다. */
const PROFILE_WORLD_SQL = '(SELECT p.world_key FROM character_profiles p WHERE p.ocid = ?)'

/**
 * 부르는 쪽이 트랜잭션으로 감싼다. 품목이 기록 행과 함께 서야 한다.
 *
 * 넥슨 계정 칸은 적지 않는다. 계정은 `ocid` 나 메이플 ID 에서 `character_accounts` 를 거쳐 찾는다.
 */
export async function insertEntry(db: SqliteDbConnection, entry: StoredEntry): Promise<void> {
  const { head } = entry
  await db.run(
    `INSERT INTO cashbook_entries (id, ocid, account_id, world_key, entry_type, category_key, entry_date, created_at, updated_at)
     VALUES (?, ?, ?, ${PROFILE_WORLD_SQL}, ?, ?, ?, ?, ?)`,
    [
      head.id,
      head.ocid,
      head.accountId,
      head.ocid,
      head.entryType,
      head.categoryKey,
      head.entryDate,
      head.createdAt,
      head.createdAt,
    ],
  )
  await writeChildren(db, entry)
}

/**
 * 갈아 끼우기. 기록 행은 고치고 품목 · 사냥 입력은 지우고 다시 쓴다. `created_at` 은 그대로라 같은 날 안의 차례가
 * 안 바뀐다. 부르는 쪽이 트랜잭션으로 감싼다.
 *
 * 넥슨 계정 칸은 주인을 고르면 비우고, 아직 주인이 없으면 지킨다. 그래서 그 칸이 찬 행은 늘 주인을 모르는 옛 기록이다.
 *
 * 월드 칸은 캐릭터를 바꿨을 때만 다시 채운다. 리프로 옮긴 기록을 새 ocid 의 월드로 덮으면 리프 전 기록이 새 월드로 옮겨 간다.
 *
 * @param now 마지막으로 고친 시각
 */
export async function replaceEntry(db: SqliteDbConnection, entry: StoredEntry, now: Date): Promise<void> {
  const { head } = entry
  await db.run(
    `UPDATE cashbook_entries
        SET ocid = ?, account_id = ?, nexon_account_id = CASE WHEN ? IS NULL AND ? IS NULL THEN nexon_account_id END,
            world_key = CASE WHEN ocid IS ? THEN world_key ELSE ${PROFILE_WORLD_SQL} END,
            category_key = ?, entry_date = ?, updated_at = ?
      WHERE id = ?`,
    [
      head.ocid,
      head.accountId,
      head.ocid,
      head.accountId,
      head.ocid,
      head.ocid,
      head.categoryKey,
      head.entryDate,
      now.toISOString(),
      head.id,
    ],
  )
  await db.run(`DELETE FROM cashbook_entry_items WHERE entry_id = ?`, [head.id])
  await db.run(`DELETE FROM cashbook_entry_hunt_inputs WHERE entry_id = ?`, [head.id])
  await db.run(`DELETE FROM cashbook_entry_fragment_uses WHERE entry_id = ?`, [head.id])
  await writeChildren(db, entry)
}

/** 품목 · 사냥 입력 · 보관에서 가져온 조각은 외래키를 따라 함께 지워진다. */
export async function deleteEntry(db: SqliteDbConnection, id: string): Promise<void> {
  await db.run(`DELETE FROM cashbook_entries WHERE id = ?`, [id])
}

/** 주인을 모르는 옛 기록 가운데 그 넥슨 계정의 메이플 ID 가 하나뿐인 것. */
const LEGACY_OWNERLESS_SQL = `
  ocid IS NULL AND account_id IS NULL AND nexon_account_id IS NOT NULL AND nexon_account_id <> ''
  AND (SELECT COUNT(DISTINCT ca.account_id) FROM character_accounts ca
        WHERE ca.nexon_account_id = cashbook_entries.nexon_account_id) = 1`

/**
 * 주인을 모르는 옛 기록을 그 넥슨 계정의 하나뿐인 메이플 ID 로 옮기고 계정 칸을 비운다. 몇 번을 불러도 결과가 같다.
 *
 * 메이플 ID 가 여럿이면 어느 ID 의 기록인지 몰라 그대로 둔다.
 *
 * @param categoryKeys 메이플 ID 를 고를 수 있는 분류. 캐릭터만 고르는 분류의 옛 기록은 옮기지 않는다
 * @returns 옮긴 것이 있었는지
 */
export async function assignLegacyEntryAccounts(
  db: SqliteDbConnection,
  entryType: EntryType,
  categoryKeys: readonly string[],
): Promise<boolean> {
  if (categoryKeys.length === 0) return false
  const scope = `entry_type = ? AND category_key IN (${categoryKeys.map(() => '?').join(', ')}) AND ${LEGACY_OWNERLESS_SQL}`
  const params = [entryType, ...categoryKeys]
  const { values } = await db.query(`SELECT COUNT(*) AS n FROM cashbook_entries WHERE ${scope}`, params)
  if (Number(values?.[0]?.n ?? 0) === 0) return false
  await db.run(
    `UPDATE cashbook_entries
        SET account_id = (SELECT MIN(ca.account_id) FROM character_accounts ca
                           WHERE ca.nexon_account_id = cashbook_entries.nexon_account_id),
            nexon_account_id = NULL
      WHERE ${scope}`,
    params,
  )
  return true
}

/**
 * 주인을 모르는 옛 기록(캐릭터도 메이플 ID 도 없는 기록)을 대표 캐릭터에게 붙이고 계정 칸을 비운다. 몇 번을 불러도 결과가 같다.
 *
 * 메이플 ID 를 고를 수 있는 분류는 그 메이플 ID 에, 나머지는 캐릭터에만 붙을 수 있어 그 캐릭터(ocid)에 붙인다. 캐릭터 기록은
 * ocid 로 메이플 ID 를 찾으므로 메이플 ID 칸을 채우지 않는다.
 *
 * @param accountCategoryKeys 메이플 ID 를 고를 수 있는 분류
 * @returns 붙인 것이 있었는지
 */
export async function assignOwnerlessEntries(
  db: SqliteDbConnection,
  entryType: EntryType,
  owner: { ocid: string; accountId: string },
  accountCategoryKeys: readonly string[],
): Promise<boolean> {
  const ownerless = 'entry_type = ? AND ocid IS NULL AND account_id IS NULL'
  const { values } = await db.query(`SELECT COUNT(*) AS n FROM cashbook_entries WHERE ${ownerless}`, [entryType])
  if (Number(values?.[0]?.n ?? 0) === 0) return false
  if (accountCategoryKeys.length > 0) {
    await db.run(
      `UPDATE cashbook_entries SET account_id = ?, nexon_account_id = NULL
        WHERE ${ownerless} AND category_key IN (${accountCategoryKeys.map(() => '?').join(', ')})`,
      [owner.accountId, entryType, ...accountCategoryKeys],
    )
  }
  await db.run(
    `UPDATE cashbook_entries SET ocid = ?, nexon_account_id = NULL, world_key = ${PROFILE_WORLD_SQL} WHERE ${ownerless}`,
    [owner.ocid, owner.ocid, entryType],
  )
  return true
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
  const scope = 'entry_type = ? AND ocid = ?'
  const { values } = await db.query(`SELECT COUNT(*) AS n FROM cashbook_entries WHERE ${scope}`, [entryType, fromOcid])
  if (Number(values?.[0]?.n ?? 0) === 0) return false
  await db.run(`UPDATE cashbook_entries SET ocid = ? WHERE ${scope}`, [toOcid, entryType, fromOcid])
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

function itemOf(row: Record<string, unknown>): EntryItem {
  return {
    itemKey: textOrNull(row.item_key),
    itemName: textOrNull(row.item_name),
    formKey: textOrNull(row.form_key),
    itemKindKey: textOrNull(row.item_kind_key),
    quantity: numberOrNull(row.quantity),
    fromLevel: numberOrNull(row.from_level),
    toLevel: numberOrNull(row.to_level),
    amountMeso: numberOrNull(row.amount_meso),
    tariffMeso: numberOrNull(row.tariff_meso),
    saleFeePercent: numberOrNull(row.sale_fee_percent),
    saleFeeMeso: numberOrNull(row.sale_fee_meso),
    saleFeeAuto: Number(row.sale_fee_auto) === 1,
    amountPoint: numberOrNull(row.amount_point),
    pointPer100mMeso: numberOrNull(row.point_per_100m_meso),
    mesoMarketFeePercent: numberOrNull(row.meso_market_fee_percent),
    amountCash: numberOrNull(row.amount_cash),
    fragmentCount: numberOrNull(row.fragment_count),
    untradableFragmentCount: numberOrNull(row.untradable_fragment_count),
    fragmentPriceMeso: numberOrNull(row.fragment_price_meso),
    hexaActivation: row.hexa_activation == null ? null : Number(row.hexa_activation) === 1,
    hexaUseStorage: row.hexa_use_storage == null ? null : Number(row.hexa_use_storage) === 1,
    hexaStorageAsSpend: row.hexa_storage_as_spend == null ? null : Number(row.hexa_storage_as_spend) === 1,
  }
}

function huntOf(row: Record<string, unknown>): EntryHunt {
  return {
    characterLevel: numberOrNull(row.character_level),
    missedMobs: numberOrNull(row.missed_mobs),
    boosts: textOrNull(row.boosts),
    fragments: numberOrNull(row.fragments),
    fragmentPrice: numberOrNull(row.fragment_price_meso),
    mesoRate: numberOrNull(row.meso_rate),
    typedMeso: numberOrNull(row.typed_meso),
    unionTier: numberOrNull(row.union_tier),
  }
}

/**
 * 조건에 맞는 기록과 그 품목 · 사냥 입력. 기록은 날짜 · 저장 시각 차례다.
 *
 * @param where `e` 로 기록 행을 가리키는 조건. 품목 칸으로 거르려면 `EXISTS` 로 쓴다
 * @example await readEntries(db, `e.entry_type = 'spend' AND e.entry_date BETWEEN ? AND ?`, [from, to])
 */
export async function readEntries(db: SqliteDbConnection, where: string, params: unknown[]): Promise<StoredEntry[]> {
  const ids = `SELECT e.id FROM cashbook_entries e WHERE ${where}`
  const [heads, items, hunts, uses] = await Promise.all([
    db.query(`SELECT e.* FROM cashbook_entries e WHERE ${where} ORDER BY e.entry_date, e.created_at, e.id`, params),
    db.query(`SELECT * FROM cashbook_entry_items WHERE entry_id IN (${ids}) ORDER BY entry_id, sort_order`, params),
    db.query(`SELECT * FROM cashbook_entry_hunt_inputs WHERE entry_id IN (${ids})`, params),
    // 차례 칸이 없어 rowid 로 넣은 차례(강화한 캐릭터 먼저, 그다음 캐릭터 관리 순서)를 지킨다.
    db.query(`SELECT * FROM cashbook_entry_fragment_uses WHERE entry_id IN (${ids}) ORDER BY rowid`, params),
  ])
  const usesOf = new Map<string, FragmentUse[]>()
  for (const row of uses.values ?? []) {
    const id = row.entry_id as string
    const list = usesOf.get(id) ?? []
    list.push({ ocid: row.ocid as string, fragments: Number(row.fragments) })
    usesOf.set(id, list)
  }
  const itemsOf = new Map<string, EntryItem[]>()
  for (const row of items.values ?? []) {
    const id = row.entry_id as string
    const list = itemsOf.get(id) ?? []
    list.push(itemOf(row))
    itemsOf.set(id, list)
  }
  const huntOfEntry = new Map((hunts.values ?? []).map((row) => [row.entry_id as string, huntOf(row)]))
  return (heads.values ?? []).map((row) => ({
    head: {
      id: row.id as string,
      ocid: textOrNull(row.ocid),
      accountId: textOrNull(row.account_id),
      entryType: row.entry_type as EntryType,
      categoryKey: row.category_key as string,
      entryDate: row.entry_date as string,
      createdAt: row.created_at as string,
    },
    items: itemsOf.get(row.id as string) ?? [{ ...EMPTY_ITEM }],
    hunt: huntOfEntry.get(row.id as string) ?? null,
    fragmentUses: usesOf.get(row.id as string) ?? [],
  }))
}
