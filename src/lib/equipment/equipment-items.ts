/**
 * 강화 장비 조회. 아이템 표(`items` 칸)에서 강화 기록이 가리키는 장비(`isEquipment`)만 본다. 장비를 key 로 찾는 자리는 전부
 * 이 모듈을 거친다.
 *
 * 강화 기록은 장비 key 를 들고 착용 레벨은 이 표에서 찾는다. 스타포스 비용이 레벨에 좌우되는데 스타포스 응답에는
 * `item_level` 이 없어서다. API 이름에서 key 를 얻는 규칙도 여기 하나다(`equipmentItemKeyOfApiName`).
 */
import type { ItemRow } from '../../types/game-data'
import { derive } from '../game-data/table'
import { comparableEquipmentName, itemsTable } from '../item-catalog'

export { comparableEquipmentName }

export type EquipmentItem = ItemRow

const index = derive(itemsTable, (table) => {
  const equipment = table.items.filter((item) => item.isEquipment)
  return {
    byKey: new Map(equipment.map((item) => [item.key, item])),
    keyByComparableName: new Map(equipment.map((item) => [comparableEquipmentName(item.name), item.key])),
  }
})

/** 장비 한 줄. 모르는 key 와 key 없음은 `null` 이다. */
export function findEquipmentItem(key: string | null | undefined): EquipmentItem | null {
  return key == null ? null : (index().byKey.get(key) ?? null)
}

/** API 이름(`target_item`)에서 key. 표에 없으면 `null` 이다. */
export function equipmentItemKeyOfApiName(name: string): string | null {
  return index().keyByComparableName.get(comparableEquipmentName(name)) ?? null
}

/** 착용 레벨. 표에 없는 key 거나 값이 없으면 `null` 이다. */
export function equipmentItemLevelOf(key: string | null | undefined): number | null {
  return findEquipmentItem(key)?.requiredLevel ?? null
}
