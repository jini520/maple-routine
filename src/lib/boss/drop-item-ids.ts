/**
 * 드롭 기록의 아이템 줄 id 와 화면 · 계산이 드는 칸 셋(아이템 key · 반지 레벨 · 나온 상자)을 오가는 함수와, 처치한 난이도로
 * 드롭을 가리는 계산.
 *
 * 기록 표는 아이템 줄 id 한 칸만 적는다. 반지는 레벨 줄이고, 상자에서 나온 연마석은 상자용 줄이다. 나온 상자는 적지 않고
 * 그 수익 건의 난이도 · 기간이 주는 상자에서 찾는다. 같은 난이도는 같은 아이템을 든 상자를 둘 주지 않는다.
 */
import type { DropCategory, RecordedDrop } from '../../types/drops'
import type { BossDifficultyRewardRow, DropBoxContentRow, DropBoxRow } from '../../types/game-data'
import { BOSS_DIFFICULTIES } from '../../types/scheduler'
import { deriveAll, type GameTable } from '../game-data/table'
import { findItem, findItemById, itemsTable, originalItemOf, ringLevelItemOf, ringLevelOf } from '../item-catalog'
import { isEffectiveAnytimeIn, periodOf } from './boss-profit-period'
import { bossDropsTable, dropBoxesTable } from './boss-drops'
import { bossDifficultyIdOf, bossDifficultyOfId } from './bosses'

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

/** 그 난이도가 그 기간 어느 때라도 준 드롭 표 줄. 지우는 판정이 쓰는 기간이라 시계를 보지 않음 */
function rewardsOf(bossDifficultyId: string, periodKey: string): BossDifficultyRewardRow[] {
  return bossDropsTable
    .get()
    .bossDifficultyRewards.filter((row) => row.bossDifficultyId === bossDifficultyId && isEffectiveAnytimeIn(periodOf(row), periodKey))
}

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
  const boxes = rewardsOf(bossDifficultyId, periodKey).flatMap((row) => boxIndex().get(row.itemId) ?? [])
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
  const rewards = rewardsOf(bossDifficultyId, periodKey)
  if (rewards.some((row) => row.itemId === item.id)) return null
  const box = rewards
    .flatMap((row) => boxIndex().get(row.itemId) ?? [])
    .find(({ contentIds }) => [...contentIds].some((id) => {
      const content = findItemById(id)
      return content !== null && originalItemOf(content).id === item.id
    }))
  return box === undefined ? null : (findItemById(box.box.itemId)?.key ?? null)
}

/**
 * 처치한 난이도에서 아이템 줄을 얻는 자리를 내는 함수. 직접이면 `item:<아이템 줄 id>`, 상자에서면 `box:<상자 아이템 줄 id>`, 못
 * 얻으면 `null`. 자리가 같은 드롭은 같은 드롭
 */
function placeFinder(rewards: readonly BossDifficultyRewardRow[]): (itemId: string) => string | null {
  const direct = new Set(rewards.map((row) => row.itemId))
  const boxes = rewards.flatMap((row) => boxIndex().get(row.itemId) ?? [])
  const levels = new Map(itemsTable.get().ringLevelItems.map((row) => [row.itemId, row]))
  return (itemId) => {
    if (direct.has(itemId)) return `item:${itemId}`
    const level = levels.get(itemId)
    const found = boxes.find(({ box, contentIds }) =>
      level === undefined
        ? contentIds.has(itemId)
        : contentIds.has(level.ringItemId) &&
          box.ringLevelMin !== undefined &&
          box.ringLevelMax !== undefined &&
          level.ringLevel >= box.ringLevelMin &&
          level.ringLevel <= box.ringLevelMax,
    )
    return found === undefined ? null : `box:${found.box.itemId}`
  }
}

/** 같은 물건의 다른 줄을 원래 줄, 따로 둔 줄(줄 id 차례) 순으로 내는 함수. 자기 줄은 빠짐 */
function sameItemFinder(): (itemId: string) => string[] {
  const links = itemsTable.get().sameItemLinks
  return (itemId) => {
    const original = links.find((link) => link.itemId === itemId)?.originalItemId ?? itemId
    const separate = links
      .filter((link) => link.originalItemId === original)
      .map((link) => link.itemId)
      .sort()
    return [original, ...separate].filter((id) => id !== itemId)
  }
}

/** 처치한 수익 건으로 모을 드롭 한 개 */
export interface ClearedGroupDrop {
  id: string
  itemId: string
  category: DropCategory
  /** 드롭이 있는 수익 건의 난이도 줄 id */
  bossDifficultyId: string
}

/** 처치한 수익 건에 남길 드롭과 그 아이템 줄, 지울 드롭. 둘 다에 없는 드롭은 건드리지 않음 */
export interface ClearedDropPlan {
  keep: { id: string; itemId: string }[]
  remove: string[]
}

/**
 * 같은 캐릭터 · 보스 · 기간의 드롭을 처치한 수익 건으로 모을 때 남길 아이템 줄과 지울 드롭을 정하는 계산. 서버
 * `modules/sync/tables/cleared-drops.ts` 와 차례 · 규칙이 같아야 받기가 기기가 먼저 고친 값을 되돌리지 않음
 *
 * @param bossDifficultyId 처치한 수익 건의 난이도 줄 id
 * @param periodKey 묶음의 기간 key
 * @returns 기기의 드롭 표에 그 난이도 줄이 없으면 `null`. 게임 데이터를 받기 전에 가리면 모든 드롭이 지워짐
 */
export function planClearedDrops(
  bossDifficultyId: string,
  periodKey: string,
  drops: readonly ClearedGroupDrop[],
): ClearedDropPlan | null {
  const rewards = rewardsOf(bossDifficultyId, periodKey)
  if (rewards.length === 0) return null
  const placeOf = placeFinder(rewards)
  const sameItemsOf = sameItemFinder()
  const order = (drop: ClearedGroupDrop): number => {
    if (drop.bossDifficultyId === bossDifficultyId) return -1
    const difficulty = bossDifficultyOfId(drop.bossDifficultyId)?.difficulty
    return difficulty === undefined ? BOSS_DIFFICULTIES.length : BOSS_DIFFICULTIES.indexOf(difficulty)
  }
  const sorted = [...drops].sort((a, b) => order(a) - order(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const seen = new Set<string>()
  const plan: ClearedDropPlan = { keep: [], remove: [] }
  for (const drop of sorted) {
    if (findItemById(drop.itemId) === null) continue
    let itemId = drop.itemId
    let place = drop.category === 'fixed' ? `item:${itemId}` : placeOf(itemId)
    for (const other of place === null ? sameItemsOf(drop.itemId) : []) {
      place = placeOf(other)
      if (place !== null) {
        itemId = other
        break
      }
    }
    if (place === null || seen.has(place)) {
      plan.remove.push(drop.id)
      continue
    }
    seen.add(place)
    plan.keep.push({ id: drop.id, itemId })
  }
  return plan
}

/**
 * 그 난이도가 그 기간에 그 기록의 아이템을 주는지(같은 물건의 다른 줄 포함). 고정 기록과 아이템 줄을 찾지 못한 옛 기록은 참.
 * 드롭 히스토리가 보스 수익 화면과 같은 기록만 보이게 같은 계산(`planClearedDrops`)을 씀
 */
export function isObtainableDrop(boss: string, difficulty: string, periodKey: string, drop: RecordedDrop): boolean {
  if (drop.category === 'fixed') return true
  const itemId = dropItemIdOf({ itemKey: drop.itemKey, ringLevel: drop.ringLevel ?? null, boxOriginKey: drop.boxOriginKey ?? null })
  const bossDifficultyId = bossDifficultyIdOf(boss, difficulty)
  if (itemId === null || bossDifficultyId === null) return true
  const plan = planClearedDrops(bossDifficultyId, periodKey, [{ id: itemId, itemId, category: drop.category, bossDifficultyId }])
  return plan === null || plan.keep.length > 0
}
