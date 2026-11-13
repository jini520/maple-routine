/**
 * 아이템 넣기가 고르는 아이템 목록. 서버 아이템 표(`items` 칸)에서 상자를 뺀 전부이고, 표의 이름 차례를 지킨다. 상자는 열어
 * 나온 것을 넣으면 되어 넣을 일이 없다. 가계부 `아이템 구매` · `아이템 판매` 도 같은 표에서 고른다.
 */
import { ITEM_KIND_KEYS, type ItemKindKey } from '../../lib/cashbook/categories'
import { compact, isOneOf } from '../../lib/game-data/contract'
import { derive } from '../../lib/game-data/table'
import { getAssetImage } from '../../lib/assets/asset-lookup'
import { itemsTable } from '../../lib/item-catalog'
import { searchItems } from '../../lib/item-search'
import type { ImageAssetRef } from '../../types/image-asset'

export interface CatalogItem {
  key: string
  name: string
  kind: ItemKindKey
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

const catalog = derive(itemsTable, (table): readonly CatalogItem[] =>
  table.items.flatMap((item) => {
    const kind = itemKindOf(item.kind)
    if (kind === null || item.category === 'box') return []
    return [compact({ key: item.key, name: item.name, kind, iconAssetId: item.iconAssetId })]
  }),
)

export function inventoryCatalog(): readonly CatalogItem[] {
  return catalog()
}

/** 고른 종류 가운데 친 글자로 찾은 아이템. 찾는 규칙은 가계부의 아이템 고르기와 같은 `searchItems` 다. */
export function catalogMatches(catalog: readonly CatalogItem[], kind: ItemKindKey, query: string): CatalogMatch[] {
  return searchItems(
    catalog.filter((item) => item.kind === kind),
    query,
  ).map((item) => ({ ...item, icon: getAssetImage(item.iconAssetId) }))
}
