import accessoryBoxes from '../accessory-boxes.json'
import bossRingBoxes from '../boss-ring-boxes.json'
import itemDropTable from '../item-drop-table.json'
import valuableDrops from '../valuable-drops.json'

// valuable-drops.json이 실제 존재하는 세트/아이템만 가리키게 강제한다(오타·유령 참조 방지).

const CATEGORIES = ['fixed', 'equipment', 'consumable'] as const

const allDropSets = new Set<string>()
const allDropItemKeys = new Set<string>()
for (const entry of itemDropTable.rewards as {
  rewards: Partial<Record<(typeof CATEGORIES)[number], { item: string; set?: string }[]>>
}[]) {
  for (const category of CATEGORIES) {
    for (const item of entry.rewards[category] ?? []) {
      allDropItemKeys.add(item.item)
      if (item.set !== undefined) allDropSets.add(item.set)
    }
  }
}

const allBoxKeys = new Set<string>([
  ...bossRingBoxes.boxes.map((box) => box.item),
  ...accessoryBoxes.boxes.map((box) => box.item),
])

describe('valuable-drops.json 정합성', () => {
  it('sets의 모든 세트 key가 item-drop-table의 set 필드에 실제로 존재한다', () => {
    for (const set of valuableDrops.sets) {
      expect(allDropSets, `세트 "${set}"가 item-drop-table에 없음`).toContain(set)
    }
  })

  it('items의 모든 아이템 key가 드롭 테이블 또는 상자 데이터에 실제로 존재한다', () => {
    for (const key of valuableDrops.items) {
      const exists = allDropItemKeys.has(key) || allBoxKeys.has(key)
      expect(exists, `아이템 "${key}"가 드롭/상자 데이터에 없음`).toBe(true)
    }
  })
})
