/**
 * 아이템 표(`items` 칸) 조회. 서버 아이템 전부이고 이름 차례다. 드롭 아이템(`drop/drop-items`) · 강화 장비
 * (`equipment/equipment-items`) · 인벤토리와 가계부의 고르기 목록이 모두 이 표에서 찾는다.
 *
 * 묶음의 종류는 서버 분류 트리의 글자 그대로 받는다. 서버가 종류를 더해도 표 전체를 버리지 않게 하려는 것이다. 가계부 아이템
 * 종류로 옮기는 일은 고르는 쪽이 한다.
 */
import type { ItemGroupRow, ItemRow, ItemsTable, RingLevelItemRow, SameItemLinkRow } from '../types/game-data'
import {
  compact,
  isBoolean,
  isInteger,
  isNonEmptyString,
  isPositiveInteger,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from './game-data/contract'
import { derive, gameTable } from './game-data/table'

function toItem(row: Row): ItemRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  if (!isBoolean(row.isDrop) || !isBoolean(row.isValuable) || !isBoolean(row.isEquipment)) return null
  const groupId = optional(row.groupId, isNonEmptyString)
  const iconAssetId = optional(row.iconAssetId, isNonEmptyString)
  // 레벨을 모르면 빠지고 0 이 아니다. 0 을 받으면 레벨 0 짜리 장비가 생겨 스타포스 비용이 조용히 틀린다.
  const requiredLevel = optional(row.requiredLevel, isPositiveInteger)
  if (groupId === false || iconAssetId === false || requiredLevel === false) return null
  return compact({
    id: row.id,
    key: row.key,
    name: row.name,
    groupId,
    iconAssetId,
    isDrop: row.isDrop,
    isValuable: row.isValuable,
    isEquipment: row.isEquipment,
    requiredLevel,
  })
}

function toGroup(row: Row): ItemGroupRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  if (!isNonEmptyString(row.type) || !isInteger(row.sortOrder)) return null
  return { id: row.id, key: row.key, name: row.name, type: row.type, sortOrder: row.sortOrder }
}

function toRingLevelItem(row: Row): RingLevelItemRow | null {
  if (!isNonEmptyString(row.itemId) || !isNonEmptyString(row.ringItemId) || !isPositiveInteger(row.ringLevel)) return null
  return { itemId: row.itemId, ringItemId: row.ringItemId, ringLevel: row.ringLevel }
}

function toSameItemLink(row: Row): SameItemLinkRow | null {
  if (!isNonEmptyString(row.itemId) || !isNonEmptyString(row.originalItemId)) return null
  return { itemId: row.itemId, originalItemId: row.originalItemId }
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다.
 *
 * 줄 id 로 가리키는 칸은 이 칸 안의 줄을 가리켜야 한다. 없는 줄을 가리키면 그 아이템의 묶음 · 반지 레벨을 찾지 못해 목록에서
 * 조용히 빠진다.
 */
export function parseItems(value: unknown): ItemsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const items = rowsOf(value.items, toItem)
  const itemGroups = rowsOf(value.itemGroups, toGroup)
  const ringLevelItems = rowsOf(value.ringLevelItems, toRingLevelItem, { allowEmpty: true })
  const sameItemLinks = rowsOf(value.sameItemLinks, toSameItemLink, { allowEmpty: true })
  if (items === null || itemGroups === null || ringLevelItems === null || sameItemLinks === null) return null
  if (!uniqueBy(items, (item) => item.id) || !uniqueBy(items, (item) => item.key)) return null
  if (!uniqueBy(itemGroups, (group) => group.id)) return null
  const itemIds = new Set(items.map((item) => item.id))
  const groupIds = new Set(itemGroups.map((group) => group.id))
  if (items.some((item) => item.groupId !== undefined && !groupIds.has(item.groupId))) return null
  if (ringLevelItems.some((ring) => !itemIds.has(ring.itemId) || !itemIds.has(ring.ringItemId))) return null
  if (sameItemLinks.some((link) => !itemIds.has(link.itemId) || !itemIds.has(link.originalItemId))) return null
  return { updatedAt, items, itemGroups, ringLevelItems, sameItemLinks }
}

export const itemsTable = gameTable<ItemsTable>(
  'items',
  { updatedAt: null, items: [], itemGroups: [], ringLevelItems: [], sameItemLinks: [] },
  parseItems,
)

/**
 * API 이름을 맞추는 규칙. NFC 로 맞추고 공백을 모두 지운다. API 는 띄어 주고 표는 붙여 쓴다.
 *
 * 표에 없는 장비의 관측 레벨도 이 글자로 찾는다. 그 장비는 key 가 없어서다.
 */
export function comparableEquipmentName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '')
}

const index = derive(itemsTable, (table) => ({
  byKey: new Map(table.items.map((item) => [item.key, item])),
  byId: new Map(table.items.map((item) => [item.id, item])),
  groupById: new Map(table.itemGroups.map((group) => [group.id, group])),
  byComparableName: new Map(table.items.map((item) => [comparableEquipmentName(item.name), item])),
  ringLevelById: new Map(table.ringLevelItems.map((ring) => [ring.itemId, ring])),
  originalIdById: new Map(table.sameItemLinks.map((link) => [link.itemId, link.originalItemId])),
  levelItemIdByRing: new Map(table.ringLevelItems.map((ring) => [`${ring.ringItemId}|${ring.ringLevel}`, ring.itemId])),
}))

/** 표의 한 줄. 모르는 key 는 `null` 이다. */
export function findItem(key: string | null | undefined): ItemRow | null {
  return key == null ? null : (index().byKey.get(key) ?? null)
}

/** 줄 id 로 찾은 한 줄. 다른 칸이 아이템을 줄 id 로 가리킨다. 모르는 id 는 `null` 이다. */
export function findItemById(id: string | null | undefined): ItemRow | null {
  return id == null ? null : (index().byId.get(id) ?? null)
}

/** 그 아이템의 묶음. 묶음이 없거나 모르는 아이템은 `null` 이다. */
export function itemGroupOf(item: ItemRow | null): ItemGroupRow | null {
  return item?.groupId === undefined ? null : (index().groupById.get(item.groupId) ?? null)
}

/**
 * 특수스킬 반지의 레벨 줄이면 원래 반지와 레벨. 다른 아이템은 `null` 이다.
 *
 * 기록 표는 레벨 줄의 id 를 적고, 화면과 계산은 원래 반지의 key 와 레벨을 따로 든다.
 */
export function ringLevelOf(item: ItemRow): { ring: ItemRow; ringLevel: number } | null {
  const row = index().ringLevelById.get(item.id)
  const ring = row === undefined ? null : findItemById(row.ringItemId)
  return row === undefined || ring === null ? null : { ring, ringLevel: row.ringLevel }
}

/** 원래 반지의 그 레벨 줄. 레벨 줄이 없는 반지와 레벨은 `null` 이다. */
export function ringLevelItemOf(ring: ItemRow, ringLevel: number): ItemRow | null {
  return findItemById(index().levelItemIdByRing.get(`${ring.id}|${ringLevel}`))
}

/** 같은 물건의 원래 아이템. 상자에서 나온 연마석이면 연마석이고, 링크가 없으면 그 아이템 자신이다. */
export function originalItemOf(item: ItemRow): ItemRow {
  return findItemById(index().originalIdById.get(item.id)) ?? item
}

/** 넥슨 API 이름으로 찾은 표의 한 줄. 공백을 지워 비교하고, 모르는 이름은 `null` 이다. */
export function findItemByApiName(name: string): ItemRow | null {
  return index().byComparableName.get(comparableEquipmentName(name)) ?? null
}

/**
 * 기록의 아이템 이름. 친 이름이 있으면 그것이고, 없으면 아이템 표에서 key 로 찾는다. 인벤토리에서 판 기록은 이름을
 * 적지 않아 서버에서 이름을 고치면 따라온다.
 *
 * @example recordedItemNameOf(record.item, record.itemKey)
 */
export function recordedItemNameOf(item: string | null, itemKey: string | null): string | null {
  return item ?? findItem(itemKey)?.name ?? null
}

/**
 * 특수스킬 반지의 레벨을 붙인 이름(`리스트레인트 링 Lv.4`). 레벨이 없으면 이름 그대로다. 같은 반지도 레벨마다 다른 물건이라
 * 목록 줄 · 기록 줄이 같은 모양으로 레벨을 보인다.
 */
export function withRingLevel(name: string, ringLevel: number | null | undefined): string {
  return ringLevel == null ? name : `${name} Lv.${ringLevel}`
}
