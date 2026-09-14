import itemDropTableData from '../../data/item-drop-table.json'
import valuableDropsData from '../../data/valuable-drops.json'
import { DROP_CATEGORIES } from '../../types/drops'

// 고가 아이템 드롭 연출 발동 판별. valuable-drops.json의 sets(item-drop-table의 set
// 필드로 매칭) + items(아이템 key)로만 결정한다. 게임 데이터는 읽기만 하고 추정하지 않는다.

interface RawRewardItem {
  item: string
  set?: string
}
interface RawRewardEntry {
  rewards: Partial<Record<(typeof DROP_CATEGORIES)[number], RawRewardItem[]>>
}

// 아이템 key → 세트 key.
const setByItemKey = new Map<string, string>()
for (const entry of itemDropTableData.rewards as RawRewardEntry[]) {
  for (const category of DROP_CATEGORIES) {
    for (const item of entry.rewards[category] ?? []) {
      if (item.set !== undefined) {
        setByItemKey.set(item.item, item.set)
      }
    }
  }
}

const valuableSets = new Set(valuableDropsData.sets)
const valuableItems = new Set(valuableDropsData.items)

/** 아이템 key 로 묻는다. key 가 없는 옛 기록은 고가가 아니다. */
export function isValuableDropItem(itemKey: string | null | undefined): boolean {
  if (itemKey == null) return false
  if (valuableItems.has(itemKey)) return true

  const set = setByItemKey.get(itemKey)
  return set !== undefined && valuableSets.has(set)
}
