/**
 * 받은 강화 내역 줄을 날짜 · 캐릭터 · 분류 · 장비별 합계로 묶는다. 응답 원본은 저장하지 않고 이 합계만 저장한다.
 *
 * 비용은 MVP 할인 전 두 몫이다. 할인은 화면에 보일 때 붙인다. 값을 못 매기는 줄과 전용 재화 줄은 합계에 넣지 않는다.
 */
import {
  cubeAppraisalCost,
  potentialResetCost,
  soulPotentialResetCost,
  starforceCostParts,
  type PotentialResetType,
  type StarforceCostParts,
} from '../../lib/enhancement/cost'
import type { EnhancementCategory } from '../../lib/enhancement/categories'
import { isSpendingRecord } from '../../lib/enhancement/world'
import { comparableEquipmentName, equipmentItemLevelOf } from '../../lib/equipment/equipment-items'
import { worldKeyOfApiName } from '../../lib/world/worlds'
import type { EnhancementKind } from '../../nexon/history/client'

/** 묶기 전 응답 줄 한 개. 수집기가 받은 줄과 옛 원본 표의 줄이 이 모양이다. */
export interface EnhancementSource {
  kind: EnhancementKind
  dateKey: string
  characterName: string
  /** API 이름 원문. 화면은 이 글자를 보인다 */
  targetItem: string
  /** 장비 key. 장비 표에 없는 장비면 `null` 이다 */
  itemKey: string | null
  /** 큐브 · 잠재 응답이 주는 장비 레벨. 스타포스 · 소울은 `null` 이다 */
  itemLevel: number | null
  payload: unknown
}

/** 합계 한 줄. 기기 `enhancement_totals` 의 칸과 맞는다. */
export interface EnhancementTotalDraft {
  historyDate: string
  characterName: string
  enhancementType: EnhancementKind
  /** 화면이 가르는 단위. `enhancementType` 과 달리 잠재를 본 · 에디셔널로 나눈다 */
  enhancementCategory: EnhancementCategory
  /** 장비별로 묶는 열쇠. 장비 key, 없으면 공백을 지운 이름이다 */
  itemGroup: string
  itemKey: string | null
  itemName: string
  attempts: number
  attemptCostMeso: number
  destroyDefenceCostMeso: number
  /** 이벤트 월드 캐릭터인가. 캐릭터 목록을 못 받아 판정하지 못했으면 `null` */
  eventWorld: boolean | null
}

function categoryOf(entry: EnhancementSource): EnhancementCategory {
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

/**
 * 전용 재화로 하는 강화. **메소가 한 푼도 안 든다**(사용자 확인).
 *
 * 2026-09-16 공지로 큐브 사용 내역과 스타포스 내역에 들어왔다. 넥슨은 새 칸을 안 만들고 두 칸의
 * 이름만 고쳐 적었다 - `cube_type` 이 `사용 큐브 및 특수 재화`, `upgrade_item` 이
 * `사용 주문서 및 특수 재화 명` 이다. 그래서 재화 이름이 그 두 칸으로 온다.
 *
 * 값 글자는 실제 기록에서 확인했다(2026-09-21). 정확히 `펄스 인핸서` 다.
 *
 * 이름으로 가른다. 큐브는 `cube_type` 을 안 보고 줄마다 감정비용을 세므로, 안 가르면 펄스
 * 인핸서로 돌린 줄에 감정비용이 붙는다(레벨 130 이면 338,000 메소).
 */
const SPECIAL_CURRENCY = new Set(['펄스 인핸서'])

function usesSpecialCurrency(entry: EnhancementSource): boolean {
  return (
    SPECIAL_CURRENCY.has(text(entry.payload, 'cube_type')) ||
    SPECIAL_CURRENCY.has(text(entry.payload, 'upgrade_item'))
  )
}

/** 스타포스 응답의 `world_name` 으로 찾은 월드 key. 큐브·잠재는 월드를 안 줘서 `null` 이다. 저장된 응답 원문이라 여기서 맞춘다. */
function worldKeyOf(entry: EnhancementSource): string | null {
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

function starforceParts(entry: EnhancementSource): StarforceCostParts | null {
  // 강화권은 메소가 안 든다. 0 이지 모르는 것이 아니다.
  if (text(entry.payload, 'upgrade_item') !== '') return { attemptMeso: 0, destroyDefenceMeso: 0 }

  // 장비 레벨은 장비 표에서만 찾는다. 표에 없는 장비는 값을 못 매긴다.
  const level = equipmentItemLevelOf(entry.itemKey)
  const fromStar = field(entry.payload, 'before_starforce_count')
  if (level === null || typeof fromStar !== 'number') return null

  // 모르는 값이면 추가분 없이 센다. 시도 비용은 확실히 들었다.
  const destroyDefence = text(entry.payload, 'destroy_defence') === '파괴 방지 적용'
  return starforceCostParts(level, fromStar, discountRate(entry.payload), destroyDefence)
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

function potentialMeso(entry: EnhancementSource): number | null {
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

function soulPotentialMeso(entry: EnhancementSource): number | null {
  const grade = gradeBeforeReset(entry.payload, 'before_soul_potential_option')
  return grade === null ? null : soulPotentialResetCost(grade)
}

/**
 * 이 줄의 MVP 할인 전 비용 두 몫. **모르면 `null`. 0 이 아니다.** 못 매긴 것을 0 으로 세우면 합계가 조용히 거짓이 된다.
 */
export function enhancementCostPartsOf(entry: EnhancementSource): StarforceCostParts | null {
  if (entry.kind === 'starforce') return starforceParts(entry)
  const cost =
    entry.kind === 'cube'
      ? entry.itemLevel === null
        ? null
        : cubeAppraisalCost(entry.itemLevel)
      : entry.kind === 'potential'
        ? potentialMeso(entry)
        : soulPotentialMeso(entry)
  return cost === null ? null : { attemptMeso: cost, destroyDefenceMeso: 0 }
}

/** 장비별로 묶는 열쇠. 장비 key 와 이름이 같은 글자여도 섞이지 않게 앞에 표시를 단다. */
export function itemGroupOf(itemKey: string | null, targetItem: string): string {
  return itemKey !== null ? `key:${itemKey}` : `name:${comparableEquipmentName(targetItem)}`
}

/**
 * 줄들을 날짜 · 캐릭터 · 분류 · 장비별 합계로 묶는다.
 *
 * 전용 재화 줄과 값을 못 매기는 줄은 넣지 않는다. 전용 재화는 메소가 안 들고, 0 원으로 세우면 건수만 뜬다(사용자 지정).
 * 이벤트 월드는 스타포스면 응답의 월드로, 그 밖은 캐릭터 목록의 이름으로 판정해 줄에 적는다.
 *
 * @param eventNames 스페셜 캐릭터 이름. **목록을 못 받았으면 `null`** 이고, 그때 월드를 모르는 줄은 판정을 비운다
 */
export function summarizeEnhancement(
  entries: readonly EnhancementSource[],
  eventNames: ReadonlySet<string> | null,
): EnhancementTotalDraft[] {
  const totals = new Map<string, EnhancementTotalDraft>()
  for (const entry of entries) {
    if (usesSpecialCurrency(entry)) continue
    const parts = enhancementCostPartsOf(entry)
    if (parts === null) continue
    const category = categoryOf(entry)
    const itemGroup = itemGroupOf(entry.itemKey, entry.targetItem)
    const key = [entry.dateKey, entry.characterName, category, itemGroup].join('|')
    const spending = isSpendingRecord(worldKeyOf(entry), entry.characterName, eventNames)
    const total = totals.get(key) ?? {
      historyDate: entry.dateKey,
      characterName: entry.characterName,
      enhancementType: entry.kind,
      enhancementCategory: category,
      itemGroup,
      itemKey: entry.itemKey,
      itemName: entry.targetItem,
      attempts: 0,
      attemptCostMeso: 0,
      destroyDefenceCostMeso: 0,
      eventWorld: spending === null ? null : !spending,
    }
    total.attempts += 1
    total.attemptCostMeso += parts.attemptMeso
    total.destroyDefenceCostMeso += parts.destroyDefenceMeso
    totals.set(key, total)
  }
  return [...totals.values()]
}
