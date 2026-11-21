/**
 * 사냥 전리품 표(`huntLoot` 칸) 조회. 가계부 사냥 전리품 판매 폼이 분류마다 이 줄을 세운다.
 *
 * 줄은 아이템을 줄 id 로 가리키고, 이름 · 그림은 아이템 표에서 찾는다. 기록은 아이템 key 만 저장한다. 이벤트가 끝난 줄도 표에
 * 남으므로 옛 기록이 이름을 잃지 않는다.
 */
import { HUNT_LOOT_TYPES, type HuntLootItemRow, type HuntLootTable, type HuntLootType } from '../../types/game-data'
import {
  compact,
  isNonEmptyString,
  isOneOf,
  isPeriodText,
  isPositiveInteger,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { deriveAll, gameTable, type GameTable } from '../game-data/table'
import { findItemById, itemsTable } from '../item-catalog'

export type { HuntLootType }

/** 사냥 전리품 한 줄에 아이템 표의 key · 이름 · 그림을 붙인 모양. */
export interface HuntLoot {
  readonly key: string
  readonly type: HuntLootType
  readonly name: string
  readonly iconAssetId?: string
  readonly npcPriceMeso: number | null
  readonly from?: string
  readonly until?: string
}

function toItem(row: Row): HuntLootItemRow | null {
  if (!isNonEmptyString(row.itemId) || !isOneOf(row.type, HUNT_LOOT_TYPES)) return null
  // 소비 아이템은 앱이 이 값으로 단가를 채운다. 다른 분류에 값이 있으면 어느 쪽이 맞는지 모른다.
  const consumable = row.type === 'consumable'
  if (consumable ? !isPositiveInteger(row.npcPriceMeso) : row.npcPriceMeso !== null) return null
  const validFrom = optional(row.validFrom, isPeriodText)
  const validUntil = optional(row.validUntil, isPeriodText)
  if (validFrom === false || validUntil === false) return null
  return compact({
    itemId: row.itemId,
    type: row.type,
    npcPriceMeso: consumable ? (row.npcPriceMeso as number) : null,
    validFrom,
    validUntil,
  })
}

export function parseHuntLoot(value: unknown): HuntLootTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const huntLootItems = rowsOf(value.huntLootItems, toItem)
  if (huntLootItems === null || !uniqueBy(huntLootItems, (item) => item.itemId)) return null
  return { updatedAt, huntLootItems }
}

export const huntLootTable = gameTable<HuntLootTable>('huntLoot', { updatedAt: null, huntLootItems: [] }, parseHuntLoot)

/** 아이템 표에 없는 아이템을 가리키는 줄은 뺀다. 보일 이름이 없다. */
const loots = deriveAll([huntLootTable, itemsTable] as GameTable<unknown>[], (): readonly HuntLoot[] =>
  huntLootTable.get().huntLootItems.flatMap((row) => {
    const item = findItemById(row.itemId)
    if (item === null) return []
    return [
      compact({
        key: item.key,
        type: row.type,
        name: item.name,
        iconAssetId: item.iconAssetId,
        npcPriceMeso: row.npcPriceMeso,
        from: row.validFrom,
        until: row.validUntil,
      }),
    ]
  }),
)

const byKey = deriveAll([huntLootTable, itemsTable] as GameTable<unknown>[], () => new Map(loots().map((loot) => [loot.key, loot])))

/** 표의 한 줄. 모르는 key 는 `null`. */
export function findHuntLoot(key: string | null | undefined): HuntLoot | null {
  return key == null ? null : (byKey().get(key) ?? null)
}

/** 그 날 팔 수 있는 아이템. 시작 날부터 끝 날 전날까지다. 표의 차례 그대로다. */
export function huntLootOn(dateKey: string): readonly HuntLoot[] {
  return loots().filter(
    (item) =>
      (item.from === undefined || item.from.slice(0, 10) <= dateKey) &&
      (item.until === undefined || dateKey < item.until.slice(0, 10)),
  )
}
