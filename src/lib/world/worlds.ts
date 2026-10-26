/**
 * 월드 마스터 표(`worlds` 칸) 조회. 월드를 key 로 찾는 자리는 전부 이 모듈을 거친다.
 *
 * 기록 · 원장 · 판정은 월드 key 를 들고, 보이는 이름 · 엠블럼 · 챌린저스 여부 · 이벤트 월드 여부는 이 표에서 찾는다.
 * API 이름에서 key 를 얻는 규칙도 여기 하나다(`worldKeyOfApiName`).
 */
import type { WorldRow, WorldsTable } from '../../types/game-data'
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

function toWorld(row: Row): WorldRow | null {
  if (!isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  if (!isBoolean(row.challengers) || !isBoolean(row.event)) return null
  const emblem = optional(row.emblem, isNonEmptyString)
  if (emblem === false) return null
  return compact({ key: row.key, name: row.name, emblem, challengers: row.challengers, event: row.event })
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. */
export function parseWorlds(value: unknown): WorldsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const worlds = rowsOf(value.worlds, toWorld)
  if (worlds === null || !uniqueBy(worlds, (world) => world.key)) return null
  return { updatedAt, worlds }
}

export const worldsTable = gameTable('worlds', { updatedAt: null, worlds: [] }, parseWorlds)

/** API 이름을 맞추는 규칙. NFC 로 맞추고 공백을 모두 지운다. 보스 · 컨텐츠 · 강화와 같다. */
function comparableName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '')
}

const index = derive(worldsTable, (table) => ({
  byKey: new Map(table.worlds.map((world) => [world.key, world])),
  keyByComparableName: new Map(table.worlds.map((world) => [comparableName(world.name), world.key])),
}))

/** 표의 줄 전부. 배열 차례가 화면 차례다. */
export function worlds(): readonly WorldEntry[] {
  return worldsTable.get().worlds
}

/** 표의 한 줄. 모르는 key 와 key 없음은 `null` 이다. */
export function findWorld(key: string | null | undefined): WorldEntry | null {
  return key == null ? null : (index().byKey.get(key) ?? null)
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
  return findWorld(key)?.challengers === true
}

export function isEventWorld(key: string | null | undefined): boolean {
  return findWorld(key)?.event === true
}
