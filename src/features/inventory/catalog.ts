/**
 * 아이템 넣기가 고르는 아이템 목록. 가계부 `아이템 구매` · `아이템 판매` 가 고르는 목록과 같은 서버 아이템 표다. 그 표를
 * 앱이 받는 일은 아직 남아 있어, 받기 전에는 목록이 비어 있고 넣을 수 있는 아이템이 없다. 표를 받게 되면 여기서 읽는다.
 */
import type { ItemKindKey } from '../../lib/cashbook/categories'
import { searchItems } from '../../lib/item-search'
import type { ImageAssetRef } from '../../types/image-asset'

export interface CatalogItem {
  key: string
  name: string
  kind: ItemKindKey
  icon: ImageAssetRef | null
}

/** 서버 아이템 표의 아이템. 아직 앱이 받지 않아 빈 목록이다. */
export function inventoryCatalog(): readonly CatalogItem[] {
  return []
}

/** 고른 종류 가운데 친 글자로 찾은 아이템. 찾는 규칙은 가계부의 아이템 고르기와 같은 `searchItems` 다. */
export function catalogMatches(catalog: readonly CatalogItem[], kind: ItemKindKey, query: string): CatalogItem[] {
  return searchItems(
    catalog.filter((item) => item.kind === kind),
    query,
  )
}
