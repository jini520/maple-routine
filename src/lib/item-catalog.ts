/**
 * 아이템 표(`items` 칸) 조회. 분류가 있는 서버 아이템 전부이고 이름 차례다. 인벤토리 넣기와 가계부 아이템 고르기가 여기서
 * 고르고, 넣은 아이템 칸의 이름 · 그림도 여기서 찾는다.
 *
 * 종류는 서버 분류 트리의 글자 그대로 받는다. 서버가 종류를 더해도 표 전체를 버리지 않게 하려는 것이다. 가계부 아이템
 * 종류로 옮기는 일은 고르는 쪽이 한다.
 */
import type { ItemRow, ItemsTable } from '../types/game-data'
import { compact, isNonEmptyString, isRow, optional, rowsOf, uniqueBy, updatedAtOf, type Row } from './game-data/contract'
import { derive, gameTable } from './game-data/table'

function toItem(row: Row): ItemRow | null {
  if (
    !isNonEmptyString(row.key) ||
    !isNonEmptyString(row.name) ||
    !isNonEmptyString(row.kind) ||
    !isNonEmptyString(row.category)
  )
    return null
  const iconAssetId = optional(row.iconAssetId, isNonEmptyString)
  if (iconAssetId === false) return null
  return compact({ key: row.key, name: row.name, kind: row.kind, category: row.category, iconAssetId })
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. */
export function parseItems(value: unknown): ItemsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const items = rowsOf(value.items, toItem)
  if (items === null || !uniqueBy(items, (item) => item.key)) return null
  return { updatedAt, items }
}

export const itemsTable = gameTable<ItemsTable>('items', { updatedAt: null, items: [] }, parseItems)

const byKey = derive(itemsTable, (table) => new Map(table.items.map((item) => [item.key, item])))

/** 표의 한 줄. 모르는 key 는 `null` 이다. */
export function findItem(key: string | null | undefined): ItemRow | null {
  return key == null ? null : (byKey().get(key) ?? null)
}

/**
 * 기록의 아이템 이름. 친 이름이 있으면 그것이고, 없으면 아이템 표에서 key 로 찾는다. 인벤토리에서 판 기록은 이름을
 * 적지 않아 서버에서 이름을 고치면 따라온다.
 *
 * @example recordedItemNameOf(record.item, record.itemKey)
 */
export function recordedItemNameOf(item: string | null, itemKey: string | null): string | null {
  return item ?? findItem(itemKey)?.name ?? null
}
