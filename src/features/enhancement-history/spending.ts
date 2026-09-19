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
  soulPotentialResetCost,
  starforceCost,
  type PotentialResetType,
} from '../../lib/enhancement/cost'
import type { EnhancementCategory } from '../../lib/enhancement/categories'
import { isSpendingRecord } from '../../lib/enhancement/world'
import { comparableEquipmentName, equipmentItemLevelOf } from '../../lib/equipment/equipment-items'
import { worldKeyOfApiName } from '../../lib/world/worlds'
import type { EnhancementHistoryEntry } from '../../storage/enhancement-history'

export interface EnhancementSpendingRow extends EnhancementHistoryEntry {
  /** 모르면 `null`. 화면은 그 줄을 금액 없이 건수만 센다 */
  costMeso: number | null
  /** 화면이 가르는 단위. `kind` 와 달리 잠재를 본·에디셔널로 나눈다 */
  category: EnhancementCategory
}

function categoryOf(entry: EnhancementHistoryEntry): EnhancementCategory {
  if (entry.kind === 'cube') return 'cube_reset'
  if (entry.kind === 'starforce') return 'starforce'
  if (entry.kind === 'soul_potential') return 'soul_potential'
  // 응답이 `에디셔널 잠재능력 재설정` 이라고 말한다. 그 값이 아니면 본 잠재다.
  return text(entry.payload, 'potential_type') === '에디셔널 잠재능력 재설정' ? 'additional_potential' : 'potential'
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

/** 스타포스 응답의 `world_name` 으로 찾은 월드 key. 큐브·잠재는 월드를 안 줘서 `null` 이다. 저장된 응답 원문이라 여기서 맞춘다. */
function worldKeyOf(entry: EnhancementHistoryEntry): string | null {
  const world = text(entry.payload, 'world_name')
  return world === '' ? null : worldKeyOfApiName(world)
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

  // 표에 없는 장비는 key 가 없어 관측 레벨을 이름으로 찾는다.
  const level =
    equipmentItemLevelOf(entry.itemKey) ?? observedLevels.get(comparableEquipmentName(entry.targetItem)) ?? null
  const fromStar = field(entry.payload, 'before_starforce_count')
  if (level === null || typeof fromStar !== 'number') return null

  // 모르는 값이면 추가분 없이 센다. 시도 비용은 확실히 들었다.
  const destroyDefence = text(entry.payload, 'destroy_defence') === '파괴 방지 적용'
  return starforceCost(level, fromStar, discountRate(entry.payload), destroyDefence)
}

/** 등급 차례. 사용 전 옵션에서 가장 높은 것을 고를 때 쓴다. */
const GRADE_ORDER = ['노멀', '레어', '에픽', '유니크', '레전드리']

/**
 * 재설정 전 등급. 사용 전 옵션 줄들의 `grade` 중 가장 높은 것. 옵션이 없거나 모르는 글자가 섞이면 `null`.
 *
 * 응답의 등급 칸(`potential_option_grade` 등)은 **오른 뒤** 등급이라 쓰지 않는다. 비용은 누르기 전
 * 등급으로 내므로, 그 칸을 쓰면 등급이 오른 줄이 한 등급 비싸게 선다.
 *
 * @param optionsKey `before_potential_option` · `before_additional_potential_option` · `before_soul_potential_option`
 */
function gradeBeforeReset(payload: unknown, optionsKey: string): string | null {
  const options = field(payload, optionsKey)
  if (!Array.isArray(options) || options.length === 0) return null
  let highest = -1
  for (const option of options) {
    const rank = GRADE_ORDER.indexOf(text(option, 'grade'))
    if (rank < 0) return null
    highest = Math.max(highest, rank)
  }
  return GRADE_ORDER[highest]
}

function potentialMeso(entry: EnhancementHistoryEntry): number | null {
  const type = text(entry.payload, 'potential_type')
  if (type !== '잠재능력 재설정' && type !== '에디셔널 잠재능력 재설정') return null
  if (entry.itemLevel === null) return null

  // 종류가 어느 옵션을 볼지 정한다.
  const grade = gradeBeforeReset(
    entry.payload,
    type === '잠재능력 재설정' ? 'before_potential_option' : 'before_additional_potential_option',
  )
  return grade === null ? null : potentialResetCost(type as PotentialResetType, entry.itemLevel, grade)
}

function soulPotentialMeso(entry: EnhancementHistoryEntry): number | null {
  const grade = gradeBeforeReset(entry.payload, 'before_soul_potential_option')
  return grade === null ? null : soulPotentialResetCost(grade)
}

/**
 * 이 줄이 얼마인가. **모르면 `null`. 0 이 아니다.** 못 매긴 것을 0 으로 세우면 합계가 조용히
 * 거짓이 된다.
 *
 * 수집기도 이 함수를 부른다. 값을 못 매기는 줄은 **저장하지 않고 버리기** 때문이다
 * (사용자 지정). 읽는 쪽과 버리는 쪽이 같은 함수를 봐야 화면에 없는 줄이 DB 에만 남지 않는다.
 *
 * @param observedLevels 이름에서 레벨로. 스타포스 응답에 `item_level` 이 없어 이 표가 받는다
 */
export function enhancementCostOf(
  entry: EnhancementHistoryEntry,
  observedLevels: ReadonlyMap<string, number>,
): number | null {
  if (entry.kind === 'cube') {
    return entry.itemLevel === null ? null : cubeAppraisalCost(entry.itemLevel)
  }
  if (entry.kind === 'potential') return potentialMeso(entry)
  if (entry.kind === 'soul_potential') return soulPotentialMeso(entry)
  return starforceMeso(entry, observedLevels)
}

/**
 * 이벤트 월드 줄을 걷어내고 나머지에 값을 매긴다.
 *
 * @param eventNames 스페셜 캐릭터 이름. **목록을 못 받았으면 `null`** 이고, 그때는 월드를
 *   모르는 줄을 전부 뺀다. 가릴 수 없는 것을 세우면 지출이 두 배로 부푼다
 * @param observedLevels 이름에서 레벨로. 장비 표에 없는 장비를 받는다
 */
export function toEnhancementSpending(
  entries: readonly EnhancementHistoryEntry[],
  eventNames: ReadonlySet<string> | null,
  observedLevels: ReadonlyMap<string, number> = new Map(),
): EnhancementSpendingRow[] {
  const rows: EnhancementSpendingRow[] = []
  for (const entry of entries) {
    if (isSpendingRecord(worldKeyOf(entry), entry.characterName, eventNames) !== true) continue
    rows.push({ ...entry, costMeso: enhancementCostOf(entry, observedLevels), category: categoryOf(entry) })
  }
  return rows
}
