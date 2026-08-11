/// <reference types="node" />
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import itemIcons from '../item-icons.json'
import itemDropTable from '../item-drop-table.json'

const itemsDir = join(dirname(fileURLToPath(import.meta.url)), '../../assets/items')

// lib/item-icons.ts와 동일: 현재 데이터엔 iconFileBySlot이 없지만 로더가 하위호환으로
// 지원하므로 옵셔널 필드를 포함한 타입으로 캐스트해 검증 분기를 유지한다.
type ItemIconEntry = { name: string; iconFile?: string; iconFileBySlot?: Record<string, string> }
const iconItems = itemIcons.items as ItemIconEntry[]

describe('아이템 아이콘 매핑 정합성', () => {
  it('아이템명에 중복이 없다', () => {
    const names = iconItems.map((item) => item.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('모든 iconFile / iconFileBySlot 파일이 assets/items/에 실제로 존재한다', () => {
    const missingFiles: string[] = []

    for (const item of iconItems) {
      if (item.iconFile) {
        if (!existsSync(join(itemsDir, item.iconFile))) {
          missingFiles.push(`${item.name} -> ${item.iconFile}`)
        }
      }
      if (item.iconFileBySlot) {
        for (const [slot, fileName] of Object.entries(item.iconFileBySlot)) {
          if (!existsSync(join(itemsDir, fileName as string))) {
            missingFiles.push(`${item.name} (${slot}) -> ${fileName}`)
          }
        }
      }
    }

    expect(missingFiles).toEqual([])
  })

  it('매핑된 아이템명은 모두 item-drop-table.json에 실제로 존재한다', () => {
    const dropTableNames = new Set<string>()
    for (const entry of itemDropTable.rewards) {
      for (const items of Object.values(entry.rewards)) {
        for (const item of items as Array<{ name: string }>) {
          dropTableNames.add(item.name)
        }
      }
    }

    const unknown = iconItems.map((item) => item.name).filter((name) => !dropTableNames.has(name))
    expect(unknown).toEqual([])
  })
})
