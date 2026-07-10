/// <reference types="node" />
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import bossRingBoxes from '../boss-ring-boxes.json'
import itemDropTable from '../item-drop-table.json'

const ringsDir = join(dirname(fileURLToPath(import.meta.url)), '../../assets/items/rings')

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

describe('보스 반지 상자 확률 데이터 정합성', () => {
  it('박스 이름에 중복이 없다', () => {
    const names = bossRingBoxes.boxes.map((box) => box.name)
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
      const names = box.itemProbabilities.map((entry) => entry.name)
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('item-drop-table.json의 "보스 반지 상자" 소모품은 모두 카탈로그에 존재한다', () => {
    const catalogNames = new Set(bossRingBoxes.boxes.map((box) => box.name))
    const referenced = new Set<string>()

    for (const entry of itemDropTable.rewards) {
      for (const item of entry.rewards.consumable ?? []) {
        if (item.name.endsWith('보스 반지 상자')) {
          referenced.add(item.name)
        }
      }
    }

    const missing = [...referenced].filter((name) => !catalogNames.has(name))
    expect(missing).toEqual([])
  })

  it('iconFile이 지정된 항목은 실제로 src/assets/items/rings/에 파일이 존재한다', () => {
    const missingFiles: string[] = []

    for (const box of bossRingBoxes.boxes) {
      for (const item of box.itemProbabilities) {
        if (item.iconFile && !existsSync(join(ringsDir, item.iconFile))) {
          missingFiles.push(`${item.name} -> ${item.iconFile}`)
        }
      }
    }

    expect(missingFiles).toEqual([])
  })
})
