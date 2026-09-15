/**
 * 장비 마스터 표(`src/data/equipment-items.json`) 조회. 장비를 key 로 찾는 자리는 전부 이 모듈을 거친다.
 *
 * 강화 기록은 장비 key 를 들고 착용 레벨은 이 표에서 찾는다. 스타포스 비용이 레벨에 좌우되는데 스타포스 응답에는
 * `item_level` 이 없어서다. API 이름에서 key 를 얻는 규칙도 여기 하나다(`equipmentItemKeyOfApiName`).
 */
import equipmentItemsData from '../../data/equipment-items.json'

export interface EquipmentItem {
  key: string
  /** 붙여 쓴 이름. API 표기(`앱솔랩스 에인션트보우`)와 띄어쓰기가 달라 화면에는 기록의 API 이름을 보인다. */
  name: string
  group: string
  /** 착용 레벨. 모르면 `null` 이고 0 이 아니다. 0 을 주면 레벨 0 짜리 장비가 생겨 비용이 조용히 틀린다. */
  level: number | null
}

const items = equipmentItemsData.items as EquipmentItem[]

/**
 * API 이름을 맞추는 규칙. NFC 로 맞추고 공백을 모두 지운다. API 는 띄어 주고 표는 붙여 쓴다.
 *
 * 표에 없는 장비의 관측 레벨도 이 글자로 찾는다. 그 장비는 key 가 없어서다.
 */
export function comparableEquipmentName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '')
}

const itemByKey = new Map(items.map((item) => [item.key, item]))
const keyByComparableName = new Map(items.map((item) => [comparableEquipmentName(item.name), item.key]))

/** 표의 한 줄. 모르는 key 와 key 없음은 `null` 이다. */
export function findEquipmentItem(key: string | null | undefined): EquipmentItem | null {
  return key == null ? null : (itemByKey.get(key) ?? null)
}

/** API 이름(`target_item`)에서 key. 표에 없으면 `null` 이다. */
export function equipmentItemKeyOfApiName(name: string): string | null {
  return keyByComparableName.get(comparableEquipmentName(name)) ?? null
}

/** 착용 레벨. 표에 없는 key 거나 값이 없으면 `null` 이다. */
export function equipmentItemLevelOf(key: string | null | undefined): number | null {
  return findEquipmentItem(key)?.level ?? null
}
