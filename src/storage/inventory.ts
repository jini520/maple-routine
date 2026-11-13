/**
 * 보스 · 사냥이 아닌 다른 경로로 얻어 인벤토리에 넣은 아이템과 가계부에서 사서 보관한 아이템.
 *
 * 남은 개수는 저장하지 않고 센다. 넣은 개수에 그 줄을 가리키는 구매 수량을 더하고 판매 수량을 빼며, 기타 조각이면 그 메이플
 * ID · 월드의 조각 사용을 뺀다. 따로 저장하면 구매 · 판매 기록을 고치거나 지울 때마다 그 값도 맞춰야 한다.
 */
import type { SqliteDbConnection } from './ports'
import { notifyAfterBatch } from './record-revision-batch'
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'
import { NEW_UUID_SQL } from './sqlite/uuid'

/** 솔 에르다 조각의 아이템 key. 인벤토리에 넣은 솔 에르다 조각이 그 메이플 ID · 월드의 기타 조각이다. */
export const SOL_ERDA_FRAGMENT_ITEM_KEY = 'sol_erda_fragment'

export interface InventoryItem {
  id: string
  accountId: string
  worldKey: string
  itemKey: string
  itemKindKey: string
  /** 넣은 개수. 판 · 쓴 수를 포함한다. */
  quantity: number
  /** 판 · 쓴 수. 판매 품목의 수량(장비는 하나)이고, 기타 조각은 그 메이플 ID · 월드의 조각 사용이다. */
  used: number
  /** 이 줄에 보관한 가계부 구매의 수량(장비는 하나). 인벤토리의 수정으로는 이만큼 아래로 못 내린다. */
  purchased: number
  remaining: number
  /** 특수스킬 반지의 레벨. 다른 아이템은 `null` 이다. */
  ringLevel: number | null
}

export interface NewInventoryItem {
  accountId: string
  worldKey: string
  itemKey: string
  itemKindKey: string
  quantity: number
  /** 특수스킬 반지만 */
  ringLevel?: number | null
}

/** 저장으로 넣은 아이템이나 기타 조각의 남은 개수가 0 아래로 내려가 쓴 것을 되돌렸다는 뜻. */
export class InventoryShortageError extends Error {
  /** 모자라게 된 자리. `item:<줄 id>` 와 `other:<메이플 ID>:<월드>` 다 */
  readonly keys: readonly string[]

  constructor(keys: readonly string[]) {
    super(`인벤토리의 남은 개수가 모자랍니다: ${keys.join(', ')}`)
    this.name = 'InventoryShortageError'
    this.keys = keys
  }
}

/** 줄 `i` 를 가리키는 품목의 수량. 장비는 수량 칸이 비어 있어 하나로 센다. 구매와 판매는 품목이 든 기록의 분류로 가른다. */
function linkedQuantitySql(purchase: boolean): string {
  return `COALESCE((SELECT SUM(COALESCE(ci.quantity, 1)) FROM cashbook_entry_items ci
     JOIN cashbook_entries e ON e.id = ci.entry_id
    WHERE ci.inventory_item_id = i.id AND e.category_key ${purchase ? '=' : '<>'} 'item_purchase'), 0)`
}

const SOLD_SQL = linkedQuantitySql(false)
const PURCHASED_SQL = linkedQuantitySql(true)

const OTHER_USED_SQL = `COALESCE((SELECT SUM(u.fragments) FROM cashbook_entry_fragment_uses u
   WHERE u.fragment_source = 'other' AND u.account_id = i.account_id AND u.world_key = i.world_key), 0)`

const ITEMS_SQL = `
  SELECT i.*, CASE WHEN i.item_key = '${SOL_ERDA_FRAGMENT_ITEM_KEY}' THEN ${OTHER_USED_SQL} ELSE ${SOLD_SQL} END AS used,
         ${PURCHASED_SQL} AS purchased
    FROM inventory_items i
   ORDER BY i.created_at, i.id`

function itemOf(row: Record<string, unknown>): InventoryItem {
  const quantity = Number(row.quantity)
  const used = Number(row.used)
  const purchased = Number(row.purchased)
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    worldKey: row.world_key as string,
    itemKey: row.item_key as string,
    itemKindKey: row.item_kind_key as string,
    quantity,
    used,
    purchased,
    remaining: quantity + purchased - used,
    ringLevel: row.ring_level == null ? null : Number(row.ring_level),
  }
}

async function readItems(db: SqliteDbConnection): Promise<InventoryItem[]> {
  const { values } = await db.query(ITEMS_SQL)
  return (values ?? []).map(itemOf)
}

/**
 * 자리마다 남은 개수. 기타 조각은 넣은 줄이 없어도 가져간 사용이 있으면 0 에서 뺀 값으로 선다.
 *
 * @returns `item:<줄 id>` · `other:<메이플 ID>:<월드>` → 남은 개수
 */
export async function readInventoryRemaining(db: SqliteDbConnection): Promise<Map<string, number>> {
  const remaining = new Map<string, number>()
  for (const item of await readItems(db)) {
    if (item.itemKey !== SOL_ERDA_FRAGMENT_ITEM_KEY) remaining.set(`item:${item.id}`, item.remaining)
  }
  const { values } = await db.query(`
    SELECT o.account_id, o.world_key,
           COALESCE((SELECT SUM(i.quantity + ${PURCHASED_SQL}) FROM inventory_items i
                      WHERE i.account_id = o.account_id AND i.world_key = o.world_key AND i.item_key = ?), 0)
         - COALESCE((SELECT SUM(u.fragments) FROM cashbook_entry_fragment_uses u
                      WHERE u.fragment_source = 'other' AND u.account_id = o.account_id AND u.world_key = o.world_key), 0)
           AS remaining
      FROM (SELECT account_id, world_key FROM inventory_items WHERE item_key = ?
            UNION SELECT account_id, world_key FROM cashbook_entry_fragment_uses WHERE fragment_source = 'other') o`,
    [SOL_ERDA_FRAGMENT_ITEM_KEY, SOL_ERDA_FRAGMENT_ITEM_KEY],
  )
  for (const row of values ?? []) {
    remaining.set(`other:${row.account_id as string}:${row.world_key as string}`, Number(row.remaining))
  }
  return remaining
}

/** 저장 앞뒤 남은 개수를 견줘, 이 저장이 줄여 0 아래로 내려간 자리. 이미 0 아래였던 자리는 더 깎았을 때만 든다. */
export function inventoryShortagesOf(before: ReadonlyMap<string, number>, after: ReadonlyMap<string, number>): string[] {
  return [...after].filter(([key, value]) => value < 0 && value < (before.get(key) ?? 0)).map(([key]) => key)
}

let inventoryItemsRevision = 0
const revisionListeners = new Set<() => void>()

export function getInventoryItemsRevision(): number {
  return inventoryItemsRevision
}

/** 판이 오를 때 부를 함수를 건다. 풀 함수를 돌려준다. */
export function subscribeInventoryItemsRevision(listener: () => void): () => void {
  revisionListeners.add(listener)
  return () => {
    revisionListeners.delete(listener)
  }
}

function bumpInventoryItemsRevision(): void {
  inventoryItemsRevision += 1
  notifyAfterBatch(() => {
    for (const listener of revisionListeners) listener()
  })
}

/** 넣은 아이템 전부와 남은 개수. 남은 개수가 0 인 줄도 든다. 판 기록이 그 줄을 가리킨다. */
export async function getInventoryItems(): Promise<InventoryItem[]> {
  return readItems(await getBossProfitDb())
}

/** 장비가 아니면 같은 메이플 ID · 월드의 같은 아이템 줄에 개수를 더한다. 장비는 하나가 한 줄이다. */
export async function addInventoryItem(item: NewInventoryItem, now: Date): Promise<void> {
  const db = await getBossProfitDb()
  const at = now.toISOString()
  const equipment = item.itemKindKey === 'equipment'
  await db.run(
    `INSERT INTO inventory_items (id, account_id, world_key, item_key, item_kind_key, quantity, ring_level, created_at, updated_at)
     VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (account_id, world_key, item_key) WHERE item_kind_key <> 'equipment'
     DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = excluded.updated_at`,
    [item.accountId, item.worldKey, item.itemKey, item.itemKindKey, equipment ? 1 : item.quantity, item.ringLevel ?? null, at, at],
  )
  bumpInventoryItemsRevision()
}

async function itemById(db: SqliteDbConnection, id: string): Promise<InventoryItem> {
  const item = (await readItems(db)).find((each) => each.id === id)
  if (item === undefined) throw new Error(`인벤토리 줄이 없습니다: ${id}`)
  return item
}

/**
 * 남은 개수를 고친다. 넣은 개수를 판 · 쓴 수 + 남길 개수 − 보관한 구매로 바꾸므로 판 · 구매 기록은 그대로다. 구매로 들어온
 * 몫은 구매 기록이 정하므로, 넣은 개수가 0 아래로 가는 개수는 `InventoryShortageError` 로 막는다.
 */
export async function setInventoryRemaining(id: string, remaining: number, now: Date): Promise<void> {
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    const item = await itemById(db, id)
    const quantity = item.used + remaining - item.purchased
    if (quantity < 0) throw new InventoryShortageError([`item:${id}`])
    await db.run(`UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?`, [quantity, now.toISOString(), id])
  })
  bumpInventoryItemsRevision()
}

/**
 * 남은 것을 지운다. 이 줄에 보관한 구매는 보관을 풀고(구매 기록은 남는다), 판 · 쓴 것이 없으면 줄을 지우고 있으면 그 수만 남긴다.
 * 판 수만큼 넣은 것으로 남겨야 판 기록이 가진 적 없는 아이템을 판 것이 되지 않는다.
 */
export async function deleteInventoryRemaining(id: string, now: Date): Promise<void> {
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    await db.run(
      `UPDATE cashbook_entry_items SET inventory_item_id = NULL
        WHERE inventory_item_id = ? AND entry_id IN (SELECT id FROM cashbook_entries WHERE category_key = 'item_purchase')`,
      [id],
    )
    const used = (await itemById(db, id)).used
    if (used === 0) await db.run(`DELETE FROM inventory_items WHERE id = ?`, [id])
    else await db.run(`UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?`, [used, now.toISOString(), id])
  })
  bumpInventoryItemsRevision()
}

/**
 * 한 메이플 ID · 월드의 기타 조각 가운데 남은 개수. 날짜가 없어 어느 날짜에서 읽어도 같다.
 *
 * @param excludeRecordId 수정 중인 기록. 그 기록이 가져간 몫을 되돌려야 다시 배분할 수 있다
 */
export async function getOtherFragmentStorage(accountId: string, worldKey: string, excludeRecordId?: string): Promise<number> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT COALESCE((SELECT SUM(i.quantity + ${PURCHASED_SQL}) FROM inventory_items i
                       WHERE i.account_id = ? AND i.world_key = ? AND i.item_key = ?), 0)
          - COALESCE((SELECT SUM(fragments) FROM cashbook_entry_fragment_uses
                        WHERE fragment_source = 'other' AND account_id = ? AND world_key = ? AND entry_id IS NOT ?), 0) AS stored`,
    [accountId, worldKey, SOL_ERDA_FRAGMENT_ITEM_KEY, accountId, worldKey, excludeRecordId ?? null],
  )
  return Number(values?.[0]?.stored ?? 0)
}

/** 그 기록의 품목이 지금 가리키는 인벤토리 줄. 고치기 전에 읽어, 같은 주인 · 아이템이면 그 줄을 다시 쓴다. */
export async function linkedInventoryItemOf(db: SqliteDbConnection, entryId: string): Promise<string | null> {
  const { values } = await db.query(
    `SELECT inventory_item_id FROM cashbook_entry_items WHERE entry_id = ? AND inventory_item_id IS NOT NULL LIMIT 1`,
    [entryId],
  )
  const id = values?.[0]?.inventory_item_id
  return typeof id === 'string' ? id : null
}

/**
 * 보관할 구매가 가리킬 인벤토리 줄. 장비는 구매 하나가 줄 하나라, 고치는 구매가 이미 같은 주인 · 아이템 · 레벨의 줄을 가리키면
 * 그 줄이고 아니면 개수 0 인 줄을 새로 만든다. 장비가 아니면 그 주인의 같은 아이템 줄이고, 없으면 개수 0 으로 만든다. 부르는
 * 쪽이 트랜잭션으로 감싼다.
 */
export async function inventoryRowForPurchase(
  db: SqliteDbConnection,
  input: {
    accountId: string
    worldKey: string
    itemKey: string
    itemKindKey: string
    ringLevel: number | null
    previousId: string | null
    now: Date
  },
): Promise<string> {
  if (input.itemKindKey === 'equipment') {
    if (input.previousId !== null) {
      const { values } = await db.query(
        `SELECT id FROM inventory_items
          WHERE id = ? AND account_id = ? AND world_key = ? AND item_key = ? AND ring_level IS ? AND item_kind_key = 'equipment'`,
        [input.previousId, input.accountId, input.worldKey, input.itemKey, input.ringLevel],
      )
      if (values?.[0] !== undefined) return input.previousId
    }
  } else {
    const { values } = await db.query(
      `SELECT id FROM inventory_items WHERE account_id = ? AND world_key = ? AND item_key = ? AND item_kind_key <> 'equipment'`,
      [input.accountId, input.worldKey, input.itemKey],
    )
    const found = values?.[0]?.id
    if (typeof found === 'string') return found
  }
  const { values } = await db.query(`SELECT ${NEW_UUID_SQL} AS id`)
  const id = values?.[0]?.id as string
  const at = input.now.toISOString()
  await db.run(
    `INSERT INTO inventory_items (id, account_id, world_key, item_key, item_kind_key, quantity, ring_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [id, input.accountId, input.worldKey, input.itemKey, input.itemKindKey, input.ringLevel, at, at],
  )
  return id
}

/**
 * 넣은 개수도 가리키는 품목도 없는 줄을 지운다. 보관한 구매를 지우거나 보관을 풀면 그 구매가 만든 줄이 이렇게 남는다. 기타 조각
 * 줄은 그 주인의 조각 사용이 있으면 남긴다. 부르는 쪽이 트랜잭션으로 감싼다.
 */
export async function deleteEmptyInventoryRows(db: SqliteDbConnection): Promise<void> {
  await db.run(
    `DELETE FROM inventory_items
      WHERE quantity = 0
        AND NOT EXISTS (SELECT 1 FROM cashbook_entry_items ci WHERE ci.inventory_item_id = inventory_items.id)
        AND NOT (item_key = ? AND EXISTS (SELECT 1 FROM cashbook_entry_fragment_uses u
                  WHERE u.fragment_source = 'other' AND u.account_id = inventory_items.account_id
                    AND u.world_key = inventory_items.world_key))`,
    [SOL_ERDA_FRAGMENT_ITEM_KEY],
  )
}
