/**
 * 보스 드롭 아이템의 key 마스터 표(`src/data/drop-items.json`) 조회.
 *
 * 기록과 다른 데이터 파일은 key 를 들고, 보이는 이름과 그림은 이 표에서 찾는다. 이름을 바꿔도 옛 기록이
 * 따라온다.
 */
import dropItemsData from '../../data/drop-items.json'

export interface DropItem {
  key: string
  name: string
  iconFile?: string
}

const items = dropItemsData.items as DropItem[]
const itemByKey = new Map(items.map((item) => [item.key, item]))
const keyByName = new Map(items.map((item) => [item.name.normalize('NFC'), item.key]))

/** 표의 한 줄. 모르는 key 와 key 가 없는 기록은 `null` 이다. */
export function findDropItem(key: string | null | undefined): DropItem | null {
  return key == null ? null : (itemByKey.get(key) ?? null)
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
  return keyByName.get(name.normalize('NFC')) ?? null
}
