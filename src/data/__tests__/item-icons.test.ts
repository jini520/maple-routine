/// <reference types="node" />
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import itemIcons from '../item-icons.json'
import itemDropTable from '../item-drop-table.json'

const itemsDir = join(dirname(fileURLToPath(import.meta.url)), '../../assets/items')

describe('아이템 아이콘 매핑 정합성', () => {
  it('아이템명에 중복이 없다', () => {
    const names = itemIcons.items.map((item) => item.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('모든 iconFile / iconFileBySlot 파일이 src/assets/items/에 실제로 존재한다', () => {
    const missingFiles: string[] = []

    for (const item of itemIcons.items) {
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

    const unknown = itemIcons.items.map((item) => item.name).filter((name) => !dropTableNames.has(name))
    expect(unknown).toEqual([])
  })
})
