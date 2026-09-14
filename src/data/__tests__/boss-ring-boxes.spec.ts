import bossRingBoxes from '../boss-ring-boxes.json'
import dropItems from '../drop-items.json'
import itemDropTable from '../item-drop-table.json'

const nameByKey = new Map(dropItems.items.map((item) => [item.key, item.name]))

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

describe('보스 반지 상자 확률 데이터 정합성', () => {
  it('박스 이름에 중복이 없다', () => {
    const names = bossRingBoxes.boxes.map((box) => box.item)
    expect(new Set(names).size).toBe(names.length)
  })

  it('박스별 레벨 확률 합이 100%에 가깝다(반올림 오차 허용)', () => {
    for (const box of bossRingBoxes.boxes) {
      const total = sum(box.levelProbabilities.map((entry) => entry.probabilityPercent))
      expect(total).toBeGreaterThanOrEqual(99.5)
      expect(total).toBeLessThanOrEqual(100.5)
    }
  })

  it('박스별 아이템 확률 합이 100%에 가깝다(반올림 오차 허용)', () => {
    for (const box of bossRingBoxes.boxes) {
      const total = sum(box.itemProbabilities.map((entry) => entry.probabilityPercent))
      expect(total).toBeGreaterThanOrEqual(99.5)
      expect(total).toBeLessThanOrEqual(100.5)
    }
  })

  it('박스별 아이템 확률표 안에 이름 중복이 없다', () => {
    for (const box of bossRingBoxes.boxes) {
      const names = box.itemProbabilities.map((entry) => entry.item)
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('item-drop-table.json의 "보스 반지 상자" 소모품은 모두 카탈로그에 존재한다', () => {
    const catalogKeys = new Set(bossRingBoxes.boxes.map((box) => box.item))
    const referenced = new Set<string>()

    for (const entry of itemDropTable.rewards) {
      for (const item of entry.rewards.consumable ?? []) {
        if (nameByKey.get(item.item)?.endsWith('보스 반지 상자')) {
          referenced.add(item.item)
        }
      }
    }

    const missing = [...referenced].filter((key) => !catalogKeys.has(key))
    expect(missing).toEqual([])
  })
})
