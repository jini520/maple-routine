import itemDropTableData from '@core/data/item-drop-table.json'
import valuableDropsData from '@core/data/valuable-drops.json'
import { DROP_CATEGORIES } from '@core/types/drops'

// 고가 아이템 드롭 연출 발동 판별(ADR-038). valuable-drops.json의 sets(item-drop-table의 set
// 필드로 매칭) + items(개별 아이템명)로만 결정한다. 게임 데이터는 읽기만 하고 추정하지 않는다.

interface RawRewardItem {
  name: string
  set?: string
}
interface RawRewardEntry {
  rewards: Partial<Record<(typeof DROP_CATEGORIES)[number], RawRewardItem[]>>
}

function nfc(value: string): string {
  return value.normalize('NFC')
}

// 아이템명(NFC) → set 이름.
const setByItemName = new Map<string, string>()
for (const entry of itemDropTableData.rewards as RawRewardEntry[]) {
  for (const category of DROP_CATEGORIES) {
    for (const item of entry.rewards[category] ?? []) {
      if (item.set !== undefined) {
        setByItemName.set(nfc(item.name), item.set)
      }
    }
  }
}

const valuableSets = new Set(valuableDropsData.sets.map(nfc))
const valuableItems = new Set(valuableDropsData.items.map(nfc))

export function isValuableDrop(itemName: string): boolean {
  const key = nfc(itemName)
  if (valuableItems.has(key)) return true

  const set = setByItemName.get(key)
  return set !== undefined && valuableSets.has(nfc(set))
}
