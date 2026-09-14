/// <reference types="node" />
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import accessoryBoxes from '../accessory-boxes.json'
import bossRingBoxes from '../boss-ring-boxes.json'
import dropItems from '../drop-items.json'
import itemDropTable from '../item-drop-table.json'
import valuableDrops from '../valuable-drops.json'

type MasterItem = { key: string; name: string; iconFile?: string; note?: string }
type TableItem = { item: string; set?: string }

const items = dropItems.items as MasterItem[]
const itemKeys = new Set(items.map((item) => item.key))
const setKeys = new Set(dropItems.sets.map((set) => set.key))
const SNAKE_CASE = /^[a-z0-9]+(_[a-z0-9]+)*$/

const tableItems: TableItem[] = itemDropTable.rewards.flatMap((reward) =>
  Object.values(reward.rewards).flatMap((list) => list as TableItem[]),
)
const boxRefs: string[] = [
  ...bossRingBoxes.boxes.flatMap((box) => [box.item, ...box.itemProbabilities.map((entry) => entry.item)]),
  ...accessoryBoxes.boxes.flatMap((box) => [box.item, ...box.itemProbabilities.map((entry) => entry.item)]),
]

// 드롭 아이템의 key 마스터 표. 이름과 그림은 여기에만 있고 다른 파일은 key 로 가리킨다.
describe('drop-items.json', () => {
  it('key 는 snake_case 이고 겹치지 않는다', () => {
    expect(items.filter((item) => !SNAKE_CASE.test(item.key))).toEqual([])
    expect(itemKeys.size).toBe(items.length)
    expect(dropItems.sets.filter((set) => !SNAKE_CASE.test(set.key))).toEqual([])
    expect(setKeys.size).toBe(dropItems.sets.length)
  })

  // 이관이 이름으로 key 를 찾는다. 이름이 겹치면 어느 key 로 옮길지 정할 수 없다.
  it('이름도 겹치지 않는다', () => {
    const names = items.map((item) => item.name.normalize('NFC'))
    expect(new Set(names).size).toBe(names.length)
  })

  it('그림 파일이 assets/items/ 또는 assets/items/rings/ 에 있다', () => {
    const itemsDir = join(__dirname, '../../assets/items')
    const missing = items
      .filter((item) => item.iconFile !== undefined)
      .filter(
        (item) =>
          !existsSync(join(itemsDir, item.iconFile!)) && !existsSync(join(itemsDir, 'rings', item.iconFile!)),
      )
      .map((item) => `${item.key} -> ${item.iconFile}`)
    expect(missing).toEqual([])
  })

  it('드롭 표 · 상자 파일 둘 · 고가 목록이 가리키는 아이템 key 가 모두 표에 있다', () => {
    const referenced = [...tableItems.map((entry) => entry.item), ...boxRefs, ...valuableDrops.items]
    expect([...new Set(referenced)].filter((key) => !itemKeys.has(key))).toEqual([])
  })

  it('드롭 표 · 고가 목록이 가리키는 세트 key 가 모두 표에 있다', () => {
    const referenced = [
      ...tableItems.flatMap((entry) => (entry.set === undefined ? [] : [entry.set])),
      ...valuableDrops.sets,
    ]
    expect([...new Set(referenced)].filter((key) => !setKeys.has(key))).toEqual([])
  })

  // 어느 파일도 안 가리키는 줄은 기록될 길이 없는 이름이다. 기타만 코드가 상자 결과로 적는다.
  it('기타 말고는 모든 줄을 드롭 표나 상자 파일이 가리킨다', () => {
    const referenced = new Set([...tableItems.map((entry) => entry.item), ...boxRefs])
    expect(items.filter((item) => !referenced.has(item.key)).map((item) => item.key)).toEqual(['other_ring'])
  })

  it('반지 상자의 내용물은 모두 그림이 있다', () => {
    const byKey = new Map(items.map((item) => [item.key, item]))
    const missing = bossRingBoxes.boxes
      .flatMap((box) => box.itemProbabilities.map((entry) => entry.item))
      .filter((key) => byKey.get(key)?.iconFile === undefined)
    expect([...new Set(missing)]).toEqual([])
  })

  // 백옥 상자 밖의 반지를 묶어 적는 칸. key 가 없으면 그 기록의 그림이 사라진다.
  it('기타는 리밋 링 그림을 든다', () => {
    expect(items.find((item) => item.key === 'other_ring')).toMatchObject({ name: '기타', iconFile: 'Limit_Ring.webp' })
  })
})
