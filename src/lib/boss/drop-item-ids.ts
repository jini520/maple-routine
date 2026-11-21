/**
 * 드롭 기록의 아이템 줄 id 와 화면 · 계산이 드는 칸 셋(아이템 key · 반지 레벨 · 나온 상자)을 오가는 함수.
 *
 * 기록 표는 아이템 줄 id 한 칸만 적는다. 반지는 레벨 줄이고, 상자에서 나온 연마석은 상자용 줄이다. 나온 상자는 적지 않고
 * 그 수익 건의 난이도 · 기간이 주는 상자에서 찾는다. 같은 난이도는 같은 아이템을 든 상자를 둘 주지 않는다.
 */
import type { DropBoxContentRow, DropBoxRow } from '../../types/game-data'
import { deriveAll, type GameTable } from '../game-data/table'
import { findItem, findItemById, itemsTable, originalItemOf, ringLevelItemOf, ringLevelOf } from '../item-catalog'
import { isEffectiveAnytimeIn, periodOf } from './boss-profit-period'
import { bossDropsTable, dropBoxesTable } from './boss-drops'

/** 화면과 계산이 드는 드롭의 아이템 칸 셋. */
export interface DropItemParts {
  itemKey: string
  ringLevel: number | null
  /** 상자에서 나왔으면 그 상자의 아이템 key */
  boxOriginKey: string | null
}

const boxIndex = deriveAll([dropBoxesTable, itemsTable] as GameTable<unknown>[], () => {
  const table = dropBoxesTable.get()
  const contentsByBox = new Map<string, DropBoxContentRow[]>()
  for (const content of table.dropBoxContents) {
    const contents = contentsByBox.get(content.boxId) ?? []
    contents.push(content)
    contentsByBox.set(content.boxId, contents)
  }
  const byItemId = new Map<string, { box: DropBoxRow; contentIds: Set<string> }>()
  for (const box of table.dropBoxes) {
    byItemId.set(box.itemId, { box, contentIds: new Set((contentsByBox.get(box.id) ?? []).map((content) => content.itemId)) })
  }
  return byItemId
})

/**
 * 칸 셋의 아이템 줄 id. 모르는 아이템 · 레벨이면 `null` 이다.
 *
 * 상자에서 나왔으면 상자 내용물의 줄을 쓴다. 상자용 줄이 따로 있는 물건(상자 연마석)은 그 줄이다.
 */
export function dropItemIdOf(parts: { itemKey: string | null; ringLevel: number | null; boxOriginKey: string | null }): string | null {
  const original = findItem(parts.itemKey)
  if (original === null) return null
  const box = parts.boxOriginKey === null ? undefined : boxIndex().get(findItem(parts.boxOriginKey)?.id ?? '')
  const content = box === undefined ? undefined : [...box.contentIds].find((id) => {
    const item = findItemById(id)
    return item !== null && originalItemOf(item).id === original.id
  })
  const item = content === undefined ? original : (findItemById(content) ?? original)
  if (parts.ringLevel === null) return item.id
  return ringLevelItemOf(item, parts.ringLevel)?.id ?? null
}

/**
 * 아이템 줄 id 를 칸 셋으로. 나온 상자는 그 난이도가 그 기간에 주는 상자 가운데 그 아이템을 든 것이다. 모르는 줄은 `null` 이다.
 *
 * @param bossDifficultyId 수익 건의 난이도 줄 id
 * @param periodKey 수익 건의 기간 key
 */
export function dropItemPartsOf(itemId: string, bossDifficultyId: string, periodKey: string): DropItemParts | null {
  const item = findItemById(itemId)
  if (item === null) return null
  const level = ringLevelOf(item)
  const content = level?.ring ?? item
  const boxes = bossDropsTable
    .get()
    .bossDifficultyRewards.filter(
      (row) => row.bossDifficultyId === bossDifficultyId && isEffectiveAnytimeIn(periodOf(row), periodKey),
    )
    .flatMap((row) => boxIndex().get(row.itemId) ?? [])
  const box = boxes.find(
    ({ box: entry, contentIds }) =>
      contentIds.has(content.id) &&
      (level === null || (level.ringLevel >= (entry.ringLevelMin ?? 0) && level.ringLevel <= (entry.ringLevelMax ?? 0))),
  )
  return {
    itemKey: originalItemOf(content).key,
    ringLevel: level?.ringLevel ?? null,
    boxOriginKey: box === undefined ? null : (findItemById(box.box.itemId)?.key ?? null),
  }
}

/**
 * 그 난이도가 그 기간에 직접 주지 않고 상자로만 주는 아이템이면 그 상자의 key. 직접도 주거나 주지 않으면 `null` 이다.
 *
 * 상자 칸 없이 올라온 옛 기록이 어느 줄인지 정할 때 쓴다. 1.0.13 앱은 상자에서 나온 연마석도 상자 칸 없이 적었다.
 */
export function onlyBoxOriginOf(itemKey: string, bossDifficultyId: string, periodKey: string): string | null {
  const item = findItem(itemKey)
  if (item === null) return null
  const rewards = bossDropsTable
    .get()
    .bossDifficultyRewards.filter(
      (row) => row.bossDifficultyId === bossDifficultyId && isEffectiveAnytimeIn(periodOf(row), periodKey),
    )
  if (rewards.some((row) => row.itemId === item.id)) return null
  const box = rewards
    .flatMap((row) => boxIndex().get(row.itemId) ?? [])
    .find(({ contentIds }) => [...contentIds].some((id) => {
      const content = findItemById(id)
      return content !== null && originalItemOf(content).id === item.id
    }))
  return box === undefined ? null : (findItemById(box.box.itemId)?.key ?? null)
}
