/**
 * 심볼 강화 비용 표(`symbolCosts` 칸)를 읽는 자리. 값은 사용자가 준 표 그대로다.
 *
 * 레벨마다 값이 달라 `unitPrice` × 수량으로 못 내므로 선택 목록(`spend-catalog`)과 따로 산다. 비용은 결정석
 * 가격처럼 레벨마다 기간 줄이고, 적는 날짜가 든 주간 기간이 줄을 고른다.
 */
import type { SymbolCostsTable, SymbolGroupRow, SymbolLevelCostRow, SymbolRow } from '../../types/game-data'
import { isEffectiveIn, periodOf } from '../boss/boss-profit-period'
import { resetWeekStartOf } from '../calendar'
import {
  compact,
  isNonEmptyString,
  isNonNegativeInteger,
  isPeriodText,
  isPositiveInteger,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { gameTable, derive } from '../game-data/table'

export interface SymbolCost {
  /** 기록의 `item_key`. 사냥터 표의 지역 key 와 같은 글자다. */
  readonly key: string
  readonly name: string
  /** 그 심볼을 쓸 수 있는 캐릭터 레벨. */
  readonly requiredLevel: number
  /** 심볼 그림의 id. */
  readonly iconAssetId: string
}

export interface SymbolCostGroup {
  readonly key: string
  readonly name: string
  readonly maxLevel: number
  /** 심볼을 고르는 순간 서는 강화 전 · 강화 후 레벨. */
  readonly defaultRange: readonly [number, number]
  readonly symbols: readonly SymbolCost[]
}

/** 드롭다운의 한 묶음. 만렙 묶음은 `key` 가 `max` 다. */
export interface SymbolMenuSection {
  readonly key: string
  readonly name: string
  readonly symbols: readonly SymbolCost[]
}

function toGroup(row: Row): SymbolGroupRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  const { maxLevel, defaultFromLevel, defaultToLevel } = row
  if (!isPositiveInteger(maxLevel) || !isPositiveInteger(defaultFromLevel) || !isPositiveInteger(defaultToLevel)) return null
  if (defaultFromLevel >= defaultToLevel || defaultToLevel > maxLevel) return null
  return { id: row.id, key: row.key, name: row.name, maxLevel, defaultFromLevel, defaultToLevel }
}

function toSymbol(row: Row): SymbolRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.groupId)) return null
  if (!isNonEmptyString(row.name) || !isPositiveInteger(row.requiredLevel) || !isNonEmptyString(row.iconAssetId)) return null
  return {
    id: row.id,
    key: row.key,
    groupId: row.groupId,
    name: row.name,
    requiredLevel: row.requiredLevel,
    iconAssetId: row.iconAssetId,
  }
}

function toLevelCost(row: Row): SymbolLevelCostRow | null {
  if (!isNonEmptyString(row.symbolId) || !isPositiveInteger(row.fromLevel) || !isNonNegativeInteger(row.costMeso)) return null
  const validFrom = optional(row.validFrom, isPeriodText)
  const validUntil = optional(row.validUntil, isPeriodText)
  if (validFrom === false || validUntil === false) return null
  return compact({ symbolId: row.symbolId, fromLevel: row.fromLevel, costMeso: row.costMeso, validFrom, validUntil })
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다.
 *
 * 심볼은 이 칸의 묶음을, 비용 줄은 이 칸의 심볼을 가리켜야 한다. 없는 줄을 가리키면 그 심볼이 목록에서 조용히 빠진다.
 */
export function parseSymbolCosts(value: unknown): SymbolCostsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const symbolGroups = rowsOf(value.symbolGroups, toGroup)
  const symbols = rowsOf(value.symbols, toSymbol)
  const symbolLevelCosts = rowsOf(value.symbolLevelCosts, toLevelCost)
  if (symbolGroups === null || symbols === null || symbolLevelCosts === null) return null
  if (!uniqueBy(symbolGroups, (group) => group.key) || !uniqueBy(symbolGroups, (group) => group.id)) return null
  if (!uniqueBy(symbols, (symbol) => symbol.key) || !uniqueBy(symbols, (symbol) => symbol.id)) return null
  const groupIds = new Set(symbolGroups.map((group) => group.id))
  const symbolIds = new Set(symbols.map((symbol) => symbol.id))
  if (symbols.some((symbol) => !groupIds.has(symbol.groupId))) return null
  if (symbolLevelCosts.some((row) => !symbolIds.has(row.symbolId))) return null
  return { updatedAt, symbolGroups, symbols, symbolLevelCosts }
}

export const symbolCostsTable = gameTable<SymbolCostsTable>(
  'symbolCosts',
  { updatedAt: null, symbolGroups: [], symbols: [], symbolLevelCosts: [] },
  parseSymbolCosts,
)

const index = derive(symbolCostsTable, (table) => {
  const groups: SymbolCostGroup[] = table.symbolGroups.map((group) => ({
    key: group.key,
    name: group.name,
    maxLevel: group.maxLevel,
    defaultRange: [group.defaultFromLevel, group.defaultToLevel] as const,
    symbols: table.symbols
      .filter((symbol) => symbol.groupId === group.id)
      .map((symbol) => ({ key: symbol.key, name: symbol.name, requiredLevel: symbol.requiredLevel, iconAssetId: symbol.iconAssetId })),
  }))
  const keyById = new Map(table.symbols.map((symbol) => [symbol.id, symbol.key]))
  const costsBySymbolLevel = new Map<string, SymbolLevelCostRow[]>()
  for (const row of table.symbolLevelCosts) {
    const key = `${keyById.get(row.symbolId)}|${row.fromLevel}`
    const rows = costsBySymbolLevel.get(key)
    if (rows === undefined) costsBySymbolLevel.set(key, [row])
    else rows.push(row)
  }
  let earliestFrom: string | null = null
  for (const row of table.symbolLevelCosts) {
    if (row.validFrom !== undefined && (earliestFrom === null || row.validFrom < earliestFrom)) earliestFrom = row.validFrom
  }
  return { groups, costsBySymbolLevel, earliestFrom }
})

/** 묶음 셋과 그 안의 심볼. 표의 차례 그대로다. */
export function symbolGroups(): readonly SymbolCostGroup[] {
  return index().groups
}

/** 표가 서는 첫날(KST). 비용 줄 중 가장 이른 `validFrom` 이고 이 분류의 날짜 고르개는 그 전 날짜를 못 고른다. 줄이 전부 처음부터면 `null`. */
export function symbolCostsFrom(): string | null {
  return index().earliestFrom
}

/** 기록의 key 로 심볼을 되짚는 조회. */
export function findSymbol(key: string | null): { group: SymbolCostGroup; symbol: SymbolCost } | null {
  if (key === null) return null
  for (const group of symbolGroups()) {
    const symbol = group.symbols.find((each) => each.key === key)
    if (symbol !== undefined) return { group, symbol }
  }
  return null
}

/**
 * 드롭다운 목록. 캐릭터가 없으면 열넷 전부다.
 *
 * 캐릭터가 있으면 착용 레벨이 캐릭터 레벨 이하인 것만 서고, 넥슨이 준 레벨이 만렙인 심볼은 맨 끝
 * `만렙` 묶음으로 간다. 캐릭터 레벨을 모르면(`null`) 거르지 않는다.
 */
export function symbolMenu(
  character: { level: number | null; symbolLevels: Readonly<Record<string, number>> | null } | null,
): SymbolMenuSection[] {
  const sections: SymbolMenuSection[] = []
  const maxed: SymbolCost[] = []
  for (const group of symbolGroups()) {
    const symbols: SymbolCost[] = []
    for (const symbol of group.symbols) {
      if (character?.level != null && symbol.requiredLevel > character.level) continue
      if ((character?.symbolLevels?.[symbol.key] ?? 0) >= group.maxLevel) maxed.push(symbol)
      else symbols.push(symbol)
    }
    if (symbols.length > 0) sections.push({ key: group.key, name: group.name, symbols })
  }
  if (maxed.length > 0) sections.push({ key: 'max', name: '만렙', symbols: maxed })
  return sections
}

const comparable = (name: string): string => name.normalize('NFC').replace(/\s/g, '')

/**
 * 넥슨 `character/symbol-equipment` 의 심볼 줄을 심볼 key 별 레벨로 옮긴다.
 *
 * 응답의 이름은 공백을 지운 뒤 표의 이름으로 **끝나는지**로 맞춘다. 앞에 붙는 말(`아케인심볼 :`)을
 * 몰라도 맞는다. 못 맞춘 줄은 버린다.
 */
export function symbolLevelsOf(
  rows: ReadonlyArray<{ symbol_name?: string | null; symbol_level?: number | null }>,
): Record<string, number> {
  const levels: Record<string, number> = {}
  for (const row of rows) {
    if (row.symbol_name == null || row.symbol_level == null) continue
    const name = comparable(row.symbol_name)
    for (const group of symbolGroups()) {
      const symbol = group.symbols.find((each) => name.endsWith(comparable(each.name)))
      if (symbol !== undefined) levels[symbol.key] = row.symbol_level
    }
  }
  return levels
}

/**
 * Lv.`from` 에서 Lv.`to` 까지 올린 비용. 그 사이 단계 비용의 합이다.
 *
 * 단계마다 적는 날짜가 든 주간 기간에 유효한 줄을 고른다. 한 단계라도 줄이 없으면 `null` 이다. 표가 서기 전
 * 날짜나 아직 비용이 안 들어온 레벨이 그렇다.
 *
 * @param dateKey 적는 날짜(KST `YYYY-MM-DD`)
 */
export function symbolUpgradeCost(symbol: SymbolCost, from: number, to: number, dateKey: string): number | null {
  const periodKey = resetWeekStartOf(dateKey)
  const costs = index().costsBySymbolLevel
  let sum = 0
  for (let level = from; level < to; level += 1) {
    const row = costs.get(`${symbol.key}|${level}`)?.find((each) => isEffectiveIn(periodOf(each), periodKey))
    if (row === undefined) return null
    sum += row.costMeso
  }
  return sum
}

/** 기록 이름. `소멸의 여로 Lv.3 → 7`. */
export function symbolRecordName(name: string, from: number, to: number): string {
  return `${name} Lv.${from} → ${to}`
}
