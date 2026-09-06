/**
 * 저장된 강화 기록 한 줄을 **메소**로.
 *
 * 비용은 저장하지 않고 읽을 때 센다. 값이 그 사건의 속성이 아니라 파생값이기 때문이다. 장비
 * 레벨 표가 자라면 예전에 넣은 스타포스 줄도 함께 값을 얻는다.
 *
 * **모르면 `null` 이다. 0 이 아니다.** 못 매긴 것을 0 으로 세우면 합계가 조용히 거짓이 된다.
 */
import {
  cubeAppraisalCost,
  potentialResetCost,
  starforceCost,
  type PotentialResetType,
} from '../../lib/enhancement/cost'
import { isSpendingRecord } from '../../lib/enhancement/world'
import { equipmentItemLevel } from '../../lib/equipment/item-level'
import type { EnhancementHistoryEntry } from '../../storage/enhancement-history'

export interface EnhancementSpendingRow extends EnhancementHistoryEntry {
  /** 모르면 `null`. 화면은 그 줄을 금액 없이 건수만 센다 */
  costMeso: number | null
}

function field(payload: unknown, key: string): unknown {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)[key]
    : undefined
}

function text(payload: unknown, key: string): string {
  const value = field(payload, key)
  return typeof value === 'string' ? value : ''
}

/** 스타포스 응답의 `world_name`. 큐브·잠재는 안 줘서 `null` 이다. */
function worldOf(entry: EnhancementHistoryEntry): string | null {
  const world = text(entry.payload, 'world_name')
  return world === '' ? null : world
}

/** `starforce_event_list` 가 주는 비용 할인율. 여럿이면 가장 큰 것. */
function discountRate(payload: unknown): number {
  const list = field(payload, 'starforce_event_list')
  if (!Array.isArray(list)) return 0
  let rate = 0
  for (const event of list) {
    const raw = Number(field(event, 'cost_discount_rate'))
    if (Number.isFinite(raw) && raw > rate) rate = raw
  }
  return rate
}

function starforceMeso(
  entry: EnhancementHistoryEntry,
  observedLevels: ReadonlyMap<string, number>,
): number | null {
  // 강화권은 메소가 안 든다. 0 이지 모르는 것이 아니다.
  if (text(entry.payload, 'upgrade_item') !== '') return 0

  const name = entry.targetItem.replace(/\s/g, '')
  const level = equipmentItemLevel(entry.targetItem) ?? observedLevels.get(name) ?? null
  const fromStar = field(entry.payload, 'before_starforce_count')
  if (level === null || typeof fromStar !== 'number') return null

  return starforceCost(level, fromStar, discountRate(entry.payload))
}

function potentialMeso(entry: EnhancementHistoryEntry): number | null {
  const type = text(entry.payload, 'potential_type')
  if (type !== '잠재능력 재설정' && type !== '에디셔널 잠재능력 재설정') return null
  if (entry.itemLevel === null) return null

  // 종류가 어느 등급 칸을 볼지 정한다. 재설정은 등급을 안 바꾸므로 응답의 그 값이 곧 그때의 등급이다.
  const grade =
    type === '잠재능력 재설정'
      ? text(entry.payload, 'potential_option_grade')
      : text(entry.payload, 'additional_potential_option_grade')

  return potentialResetCost(type as PotentialResetType, entry.itemLevel, grade)
}

function costOf(
  entry: EnhancementHistoryEntry,
  observedLevels: ReadonlyMap<string, number>,
): number | null {
  if (entry.kind === 'cube') {
    return entry.itemLevel === null ? null : cubeAppraisalCost(entry.itemLevel)
  }
  if (entry.kind === 'potential') return potentialMeso(entry)
  return starforceMeso(entry, observedLevels)
}

/**
 * 이벤트 월드 줄을 걷어내고 나머지에 값을 매긴다.
 *
 * @param eventNames 스페셜 캐릭터 이름. **목록을 못 받았으면 `null`** 이고, 그때는 월드를
 *   모르는 줄을 전부 뺀다. 가릴 수 없는 것을 세우면 지출이 두 배로 부푼다
 * @param observedLevels 이름에서 레벨로. `equipment-items.json` 이 못 채운 자리를 받는다
 */
export function toEnhancementSpending(
  entries: readonly EnhancementHistoryEntry[],
  eventNames: ReadonlySet<string> | null,
  observedLevels: ReadonlyMap<string, number> = new Map(),
): EnhancementSpendingRow[] {
  const rows: EnhancementSpendingRow[] = []
  for (const entry of entries) {
    if (isSpendingRecord(worldOf(entry), entry.characterName, eventNames) !== true) continue
    rows.push({ ...entry, costMeso: costOf(entry, observedLevels) })
  }
  return rows
}
