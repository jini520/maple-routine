/**
 * 아이템 넣기가 고르는 아이템 목록. 서버 아이템 표(`items` 칸)에서 상자 · 데스티니 무기 · 제네시스 무기 · 아스트라 보조무기를 뺀
 * 전부이고, 표의 이름 차례를 지킨다. 가계부 `아이템 구매` · `아이템 판매` 도 같은 목록에서 고른다.
 */
import { ITEM_KIND_KEYS, type ItemKindKey } from '../../lib/cashbook/categories'
import { compact, isOneOf } from '../../lib/game-data/contract'
import { derive } from '../../lib/game-data/table'
import { getAssetImage } from '../../lib/assets/asset-lookup'
import { findItem, itemsTable } from '../../lib/item-catalog'
import { searchItems } from '../../lib/item-search'
import type { ItemRow } from '../../types/game-data'
import type { ImageAssetRef } from '../../types/image-asset'

/** 특수스킬 반지의 묶음. 이 묶음의 아이템은 넣을 때 레벨을 고른다. */
const SPECIAL_SKILL_RING = 'special_skill_ring'

/** 넣을 때 고르는 특수스킬 반지의 레벨. 서버 반지 상자 표의 레벨 범위를 합친 것과 같다. */
export const RING_LEVELS = [1, 2, 3, 4] as const

/** 특수스킬 반지를 고르면 처음 골라져 있는 레벨 */
export const DEFAULT_RING_LEVEL = 4

export interface CatalogItem {
  key: string
  name: string
  kind: ItemKindKey
  /** 특수스킬 반지면 넣을 때 레벨을 고른다 */
  ringLevels: boolean
  iconAssetId?: string
}

/** 찾은 아이템. 그림은 찾을 때 연다. 그림 목록만 바뀌어도 맞는 그림을 열게 하려는 것이다. */
export interface CatalogMatch extends CatalogItem {
  icon: ImageAssetRef | null
}

/** 서버 종류를 가계부 아이템 종류로. 장신구는 게임에서도 장비 탭에 들어 장비다. 옮길 수 없는 종류는 `null` 이다. */
function itemKindOf(kind: string): ItemKindKey | null {
  if (kind === 'accessory') return 'equipment'
  return isOneOf(kind, ITEM_KIND_KEYS) ? kind : null
}

/** 고르기 목록에서 빼는 아이템. 아스트라 보조무기는 묶음이 따로 없어 보조무기 가운데 key 로 가른다. */
function excluded(item: ItemRow): boolean {
  if (item.category === 'box' || item.category === 'destiny_weapon' || item.category === 'genesis_weapon') return true
  return item.category === 'secondary_weapon' && item.key.startsWith('astra_')
}

const catalog = derive(itemsTable, (table): readonly CatalogItem[] =>
  table.items.flatMap((item) => {
    const kind = itemKindOf(item.kind)
    if (kind === null || excluded(item)) return []
    return [
      compact({
        key: item.key,
        name: item.name,
        kind,
        ringLevels: item.category === SPECIAL_SKILL_RING,
        iconAssetId: item.iconAssetId,
      }),
    ]
  }),
)

export function inventoryCatalog(): readonly CatalogItem[] {
  return catalog()
}

/** 아이템 표에서 그 아이템의 가계부 아이템 종류. 표에 없거나 옮길 수 없는 종류면 `null` 이다. */
export function catalogKindOf(itemKey: string): ItemKindKey | null {
  const item = findItem(itemKey)
  return item === null ? null : itemKindOf(item.kind)
}

/** 친 글자로 찾은 아이템. 종류를 가리지 않는다. 찾는 규칙은 가계부의 아이템 고르기와 같은 `searchItems` 다. */
export function catalogMatches(catalog: readonly CatalogItem[], query: string): CatalogMatch[] {
  return searchItems(catalog, query).map((item) => ({ ...item, icon: getAssetImage(item.iconAssetId) }))
}
