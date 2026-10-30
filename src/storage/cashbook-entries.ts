/**
 * 가계부 기록 표 셋(`cashbook_entries` · `cashbook_entry_items` · `cashbook_entry_hunt_inputs`)을 읽고 쓰는 자리.
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
  amountCash: number | null
  fragmentCount: number | null
  untradableFragmentCount: number | null
  fragmentPriceMeso: number | null
  /** 헥사 스탯만 참 · 거짓이고 나머지는 `null` 이다. */
  hexaActivation: boolean | null
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
  amountCash: null,
  fragmentCount: null,
  untradableFragmentCount: null,
  fragmentPriceMeso: null,
  hexaActivation: null,
}

const INSERT_ITEM_SQL = `
  INSERT INTO cashbook_entry_items
    (id, entry_id, sort_order, item_key, item_name, form_key, item_kind_key, quantity, from_level, to_level,
     amount_meso, tariff_meso, sale_fee_percent, sale_fee_meso, sale_fee_auto, amount_point, point_per_100m_meso, amount_cash,
     fragment_count, untradable_fragment_count, fragment_price_meso, hexa_activation)
  VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      item.amountCash,
      item.fragmentCount,
      item.untradableFragmentCount,
      item.fragmentPriceMeso,
      item.hexaActivation === null ? null : item.hexaActivation ? 1 : 0,
    ])
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

/**
 * 부르는 쪽이 트랜잭션으로 감싼다. 품목이 기록 행과 함께 서야 한다.
 *
 * @param nexonAccountId 캐릭터가 없는 기록이 속할 넥슨 계정 id. 캐릭터가 있는 기록은 ocid 로 계정을 찾으므로 적지 않는다
 */
export async function insertEntry(db: SqliteDbConnection, entry: StoredEntry, nexonAccountId: string | null): Promise<void> {
  const { head } = entry
  await db.run(
    `INSERT INTO cashbook_entries (id, ocid, nexon_account_id, entry_type, category_key, entry_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      head.id,
      head.ocid,
      head.ocid === null ? nexonAccountId : null,
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
 * 캐릭터 없는 기록은 처음 속한 넥슨 계정을 지킨다. 계정이 없던 기록만 넘긴 계정을 받는다.
 *
 * @param now 마지막으로 고친 시각
 * @param nexonAccountId 계정이 없는 캐릭터 없는 기록이 받을 넥슨 계정 id
 */
export async function replaceEntry(
  db: SqliteDbConnection,
  entry: StoredEntry,
  now: Date,
  nexonAccountId: string | null,
): Promise<void> {
  const { head } = entry
  await db.run(
    `UPDATE cashbook_entries
        SET ocid = ?, nexon_account_id = CASE WHEN ? IS NULL THEN COALESCE(nexon_account_id, ?) END,
            category_key = ?, entry_date = ?, updated_at = ?
      WHERE id = ?`,
    [head.ocid, head.ocid, nexonAccountId, head.categoryKey, head.entryDate, now.toISOString(), head.id],
  )
  await db.run(`DELETE FROM cashbook_entry_items WHERE entry_id = ?`, [head.id])
  await db.run(`DELETE FROM cashbook_entry_hunt_inputs WHERE entry_id = ?`, [head.id])
  await writeChildren(db, entry)
}

/** 품목 · 사냥 입력은 외래키를 따라 함께 지워진다. */
export async function deleteEntry(db: SqliteDbConnection, id: string): Promise<void> {
  await db.run(`DELETE FROM cashbook_entries WHERE id = ?`, [id])
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
    amountCash: numberOrNull(row.amount_cash),
    fragmentCount: numberOrNull(row.fragment_count),
    untradableFragmentCount: numberOrNull(row.untradable_fragment_count),
    fragmentPriceMeso: numberOrNull(row.fragment_price_meso),
    hexaActivation: row.hexa_activation == null ? null : Number(row.hexa_activation) === 1,
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
  const [heads, items, hunts] = await Promise.all([
    db.query(`SELECT e.* FROM cashbook_entries e WHERE ${where} ORDER BY e.entry_date, e.created_at, e.id`, params),
    db.query(`SELECT * FROM cashbook_entry_items WHERE entry_id IN (${ids}) ORDER BY entry_id, sort_order`, params),
    db.query(`SELECT * FROM cashbook_entry_hunt_inputs WHERE entry_id IN (${ids})`, params),
  ])
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
      entryType: row.entry_type as EntryType,
      categoryKey: row.category_key as string,
      entryDate: row.entry_date as string,
      createdAt: row.created_at as string,
    },
    items: itemsOf.get(row.id as string) ?? [{ ...EMPTY_ITEM }],
    hunt: huntOfEntry.get(row.id as string) ?? null,
  }))
}
