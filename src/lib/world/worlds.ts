/**
 * 월드 마스터 표(`worlds` 칸) 조회. 월드를 key 로 찾는 자리는 전부 이 모듈을 거친다.
 *
 * 기록 · 원장 · 판정은 월드 key 를 들고, 보이는 이름 · 엠블럼 · 챌린저스 여부 · 이벤트 월드 여부는 이 표에서 찾는다.
 * API 이름에서 key 를 얻는 규칙도 여기 하나다(`worldKeyOfApiName`).
 */
import type { WorldOpenPeriodRow, WorldRow, WorldsTable } from '../../types/game-data'
import {
  compact,
  isBoolean,
  isNonEmptyString,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { gameTable, derive } from '../game-data/table'

export type WorldEntry = WorldRow

const DATE_TEXT = /^\d{4}-\d{2}-\d{2}$/

function isDateText(value: unknown): value is string {
  return typeof value === 'string' && DATE_TEXT.test(value)
}

function toWorld(row: Row): WorldRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  if (!isBoolean(row.isChallengers) || !isBoolean(row.isEvent)) return null
  const emblemAssetId = optional(row.emblemAssetId, isNonEmptyString)
  if (emblemAssetId === false) return null
  return compact({
    id: row.id,
    key: row.key,
    name: row.name,
    emblemAssetId,
    isChallengers: row.isChallengers,
    isEvent: row.isEvent,
  })
}

function toPeriod(row: Row): WorldOpenPeriodRow | null {
  const { worldId, validFrom, validUntil } = row
  if (!isNonEmptyString(worldId) || !isDateText(validFrom) || !isDateText(validUntil)) return null
  return validUntil > validFrom ? { worldId, validFrom, validUntil } : null
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. 기간은 이 칸의 월드를 가리켜야 한다. */
export function parseWorlds(value: unknown): WorldsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const worlds = rowsOf(value.worlds, toWorld)
  const worldOpenPeriods = rowsOf(value.worldOpenPeriods, toPeriod, { allowEmpty: true })
  if (worlds === null || worldOpenPeriods === null) return null
  if (!uniqueBy(worlds, (world) => world.key) || !uniqueBy(worlds, (world) => world.id)) return null
  const ids = new Set(worlds.map((world) => world.id))
  if (worldOpenPeriods.some((period) => !ids.has(period.worldId))) return null
  return { updatedAt, worlds, worldOpenPeriods }
}

export const worldsTable = gameTable('worlds', { updatedAt: null, worlds: [], worldOpenPeriods: [] }, parseWorlds)

/** API 이름을 맞추는 규칙. NFC 로 맞추고 공백을 모두 지운다. 보스 · 컨텐츠 · 강화와 같다. */
function comparableName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '')
}

const index = derive(worldsTable, (table) => {
  const periodsById = new Map<string, WorldOpenPeriodRow[]>()
  for (const period of table.worldOpenPeriods) {
    periodsById.set(period.worldId, [...(periodsById.get(period.worldId) ?? []), period])
  }
  return {
    byKey: new Map(table.worlds.map((world) => [world.key, world])),
    byId: new Map(table.worlds.map((world) => [world.id, world])),
    keyByComparableName: new Map(table.worlds.map((world) => [comparableName(world.name), world.key])),
    periodsById,
  }
})

/** 표의 줄 전부. 배열 차례가 화면 차례다. */
export function worlds(): readonly WorldEntry[] {
  return worldsTable.get().worlds
}

/** 표의 한 줄. 모르는 key 와 key 없음은 `null` 이다. */
export function findWorld(key: string | null | undefined): WorldEntry | null {
  return key == null ? null : (index().byKey.get(key) ?? null)
}

/** 줄 id 로 찾은 한 줄. 모르는 id 는 `null` 이다. */
export function findWorldById(id: string | null | undefined): WorldEntry | null {
  return id == null ? null : (index().byId.get(id) ?? null)
}

/** API 이름(`world_name`)에서 key. 표에 없으면 `null` 이다. */
export function worldKeyOfApiName(name: string): string | null {
  return index().keyByComparableName.get(comparableName(name)) ?? null
}

/**
 * 보이는 월드 이름. 표 이름이고, 모르는 key 면 넘긴 이름이다.
 *
 * @example worldNameOf(record.worldKey, record.world ?? '')
 */
export function worldNameOf(key: string | null | undefined, fallbackName: string): string {
  return findWorld(key)?.name ?? fallbackName
}

export function isChallengersWorld(key: string | null | undefined): boolean {
  return findWorld(key)?.isChallengers === true
}

export function isEventWorld(key: string | null | undefined): boolean {
  return findWorld(key)?.isEvent === true
}

/** 그 월드의 열린 기간. 기간이 없는 월드와 모르는 key 는 빈 목록이다. */
export function openPeriodsOf(key: string): readonly WorldOpenPeriodRow[] {
  const world = findWorld(key)
  return world === null ? [] : (index().periodsById.get(world.id) ?? [])
}

/** 그 월드가 그 날 열려 있었나. 기간이 없는 월드와 모르는 key 는 거짓이다. @param dateKey KST `YYYY-MM-DD` */
export function isInWorldPeriod(key: string, dateKey: string): boolean {
  return openPeriodsOf(key).some((period) => period.validFrom <= dateKey && dateKey < period.validUntil)
}
