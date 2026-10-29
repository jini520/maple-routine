/**
 * 사냥 전리품 표(`huntLoot` 칸) 조회. 가계부 사냥 전리품 판매 폼이 분류마다 이 줄을 세운다.
 *
 * 기록은 아이템 key 만 저장하고 이름 · 그림은 여기서 찾는다. 이벤트가 끝난 줄도 표에 남으므로 옛 기록이 이름을 잃지 않는다.
 */
import { HUNT_LOOT_KINDS, type HuntLootKind, type HuntLootRow, type HuntLootTable } from '../../types/game-data'
import {
  compact,
  isNonEmptyString,
  isOneOf,
  isPeriodText,
  isPositiveInteger,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { derive, gameTable } from '../game-data/table'

export type { HuntLootKind }
export type HuntLoot = HuntLootRow

function toItem(row: Row): HuntLootRow | null {
  if (!isNonEmptyString(row.key) || !isOneOf(row.kind, HUNT_LOOT_KINDS)) return null
  if (!isNonEmptyString(row.name) || !isNonEmptyString(row.iconFile)) return null
  // 소비 아이템은 앱이 이 값으로 단가를 채운다. 다른 분류에 값이 있으면 어느 쪽이 맞는지 모른다.
  const consumable = row.kind === 'consumable'
  if (consumable ? !isPositiveInteger(row.npcPriceMeso) : row.npcPriceMeso !== null) return null
  const from = optional(row.from, isPeriodText)
  const until = optional(row.until, isPeriodText)
  if (from === false || until === false) return null
  return compact({
    key: row.key,
    kind: row.kind,
    name: row.name,
    iconFile: row.iconFile,
    npcPriceMeso: consumable ? (row.npcPriceMeso as number) : null,
    from,
    until,
  })
}

export function parseHuntLoot(value: unknown): HuntLootTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const items = rowsOf(value.items, toItem)
  if (items === null || !uniqueBy(items, (item) => item.key)) return null
  return { updatedAt, items }
}

export const huntLootTable = gameTable('huntLoot', { updatedAt: null, items: [] }, parseHuntLoot)

const index = derive(huntLootTable, (table) => new Map(table.items.map((item) => [item.key, item])))

/** 표의 한 줄. 모르는 key 는 `null`. */
export function findHuntLoot(key: string | null | undefined): HuntLoot | null {
  return key == null ? null : (index().get(key) ?? null)
}

/** 그 날 팔 수 있는 아이템. 시작 날부터 끝 날 전날까지다. 표의 차례 그대로다. */
export function huntLootOn(dateKey: string): readonly HuntLoot[] {
  return huntLootTable
    .get()
    .items.filter(
      (item) =>
        (item.from === undefined || item.from.slice(0, 10) <= dateKey) &&
        (item.until === undefined || dateKey < item.until.slice(0, 10)),
    )
}
