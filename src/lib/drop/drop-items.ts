/**
 * 보스 드롭 아이템 조회. 아이템 표(`items` 칸)에서 드롭으로 적을 수 있는 줄(`isDrop`)만 본다.
 *
 * 기록과 다른 표는 key 를 들고, 보이는 이름 · 그림 · 고가 여부는 이 표에서 찾는다. 이름을 바꿔도 옛 기록이
 * 따라온다. 고가 판정도 여기다. 세트 소속이 아니라 줄의 `isValuable` 한 칸이다.
 */
import type { ItemRow } from '../../types/game-data'
import { derive } from '../game-data/table'
import { itemsTable } from '../item-catalog'

export type DropItem = ItemRow

const index = derive(itemsTable, (table) => {
  const drops = table.items.filter((item) => item.isDrop)
  return {
    byKey: new Map(drops.map((item) => [item.key, item])),
    keyByName: new Map(drops.map((item) => [item.name.normalize('NFC'), item.key])),
  }
})

/** 드롭 아이템 한 줄. 모르는 key 와 key 가 없는 기록은 `null` 이다. */
export function findDropItem(key: string | null | undefined): DropItem | null {
  return key == null ? null : (index().byKey.get(key) ?? null)
}

/**
 * 보이는 이름. key 로 찾은 표의 지금 이름이고, 못 찾으면 기록에 적어 둔 이름이다.
 *
 * @example dropItemNameOf(drop.itemKey, drop.itemName)
 */
export function dropItemNameOf(key: string | null | undefined, storedName: string): string {
  return findDropItem(key)?.name ?? storedName
}

/** 이름에서 key. 이름만 저장된 옛 기록을 옮기는 이관이 쓴다. NFC 로 맞춘다. */
export function dropItemKeyOfName(name: string): string | null {
  return index().keyByName.get(name.normalize('NFC')) ?? null
}

/** 고가 드롭인가. 아이템 key 로 묻는다. key 가 없는 옛 기록과 모르는 key 는 고가가 아니다. */
export function isValuableDropItem(itemKey: string | null | undefined): boolean {
  return findDropItem(itemKey)?.isValuable === true
}
