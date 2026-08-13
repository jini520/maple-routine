import { describe, expect, it } from 'vitest'
import accessoryBoxes from '../accessory-boxes.json'
import itemDropTable from '../item-drop-table.json'

describe('장신구 상자 데이터 정합성', () => {
  it('박스 이름에 중복이 없다', () => {
    const names = accessoryBoxes.boxes.map((box) => box.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('박스별 아이템 후보 목록에 이름 중복이 없다', () => {
    for (const box of accessoryBoxes.boxes) {
      const names = box.itemProbabilities.map((entry) => entry.name)
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('카탈로그의 모든 박스는 item-drop-table.json의 소모품 보상에도 존재한다', () => {
    const referenced = new Set<string>()

    for (const entry of itemDropTable.rewards) {
      for (const item of entry.rewards.consumable ?? []) {
        referenced.add(item.name)
      }
    }

    const missing = accessoryBoxes.boxes.map((box) => box.name).filter((name) => !referenced.has(name))
    expect(missing).toEqual([])
  })
})
