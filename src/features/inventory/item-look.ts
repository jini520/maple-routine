/**
 * 칸의 아이템 그림과 이름. 아이템 표(`items` 칸)에서 찾고, 거기 없으면 보스 드롭 아이템 표에서 찾는다. 분류가 없는 드롭
 * 아이템은 아이템 표에 실리지 않기 때문이다.
 */
import { dropItemIconOf, getAssetImage, solErdaFragmentIcon } from '../../lib/assets/asset-lookup'
import { dropItemNameOf } from '../../lib/drop/drop-items'
import { findItem } from '../../lib/item-catalog'
import { SOL_ERDA_FRAGMENT_ITEM_KEY } from '../../storage/inventory'
import type { ImageAssetRef } from '../../types/image-asset'

export function inventoryItemIconOf(itemKey: string): ImageAssetRef | null {
  if (itemKey === SOL_ERDA_FRAGMENT_ITEM_KEY) return solErdaFragmentIcon()
  return getAssetImage(findItem(itemKey)?.iconAssetId) ?? dropItemIconOf(itemKey)
}

/** 표에서 못 찾으면 key 다. */
export function inventoryItemNameOf(itemKey: string): string {
  if (itemKey === SOL_ERDA_FRAGMENT_ITEM_KEY) return '솔 에르다 조각'
  return findItem(itemKey)?.name ?? dropItemNameOf(itemKey, itemKey)
}
