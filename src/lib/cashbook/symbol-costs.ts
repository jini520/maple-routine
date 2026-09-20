/**
 * 심볼 강화 비용 표(`src/data/symbol-costs.json`)를 읽는 자리. 값은 사용자가 준 표 그대로다.
 *
 * 레벨마다 값이 달라 `unitPrice` × 수량으로 못 내므로 선택 목록(`spend-catalog`)과 따로 산다.
 */
import symbolCosts from '../../data/symbol-costs.json'

export interface SymbolCost {
  /** 기록의 `item_key`. 사냥터 표의 지역 key 와 같다. */
  readonly key: string
  readonly name: string
  /** 그 심볼을 쓸 수 있는 캐릭터 레벨. */
  readonly requiredLevel: number
  /** `src/assets/items/` 의 그림 파일. */
  readonly icon: string
  /** `costs[i]` 는 Lv.(i+1) 에서 Lv.(i+2) 로 올리는 메소. */
  readonly costs: readonly number[]
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

const GROUPS = symbolCosts.groups as unknown as readonly SymbolCostGroup[]

/** 표가 서는 첫날(KST). 이 갈래의 날짜 고르개는 그 전 날짜를 못 고른다. */
export const SYMBOL_COSTS_FROM = symbolCosts.from

/** 기록의 key 로 심볼을 되짚는 조회. */
export function findSymbol(key: string | null): { group: SymbolCostGroup; symbol: SymbolCost } | null {
  if (key === null) return null
  for (const group of GROUPS) {
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
  for (const group of GROUPS) {
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
    for (const group of GROUPS) {
      const symbol = group.symbols.find((each) => name.endsWith(comparable(each.name)))
      if (symbol !== undefined) levels[symbol.key] = row.symbol_level
    }
  }
  return levels
}

/** Lv.`from` 에서 Lv.`to` 까지 올린 비용. 그 사이 단계 비용의 합이다. */
export function symbolUpgradeCost(symbol: SymbolCost, from: number, to: number): number {
  return symbol.costs.slice(from - 1, to - 1).reduce((sum, cost) => sum + cost, 0)
}

/** 기록 이름. `소멸의 여로 Lv.3 → 7`. */
export function symbolRecordName(name: string, from: number, to: number): string {
  return `${name} Lv.${from} → ${to}`
}
