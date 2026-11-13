/**
 * 칸의 아이템 그림과 이름. 지금 앱이 받는 아이템 표는 보스 드롭 아이템과 사냥 전리품뿐이라, 넣은 아이템 가운데 그 표에 없는
 * 아이템은 그림 · 이름을 못 찾는다. 서버 아이템 표를 앱이 받게 되면 그 표에서 찾는다.
 */
import { dropItemIconOf, solErdaFragmentIcon } from '../../lib/assets/asset-lookup'
import { dropItemNameOf } from '../../lib/drop/drop-items'
import { SOL_ERDA_FRAGMENT_ITEM_KEY } from '../../storage/inventory'
import type { ImageAssetRef } from '../../types/image-asset'

export function inventoryItemIconOf(itemKey: string): ImageAssetRef | null {
  return itemKey === SOL_ERDA_FRAGMENT_ITEM_KEY ? solErdaFragmentIcon() : dropItemIconOf(itemKey)
}

/** 표에서 못 찾으면 key 다. */
export function inventoryItemNameOf(itemKey: string): string {
  return itemKey === SOL_ERDA_FRAGMENT_ITEM_KEY ? '솔 에르다 조각' : dropItemNameOf(itemKey, itemKey)
}
