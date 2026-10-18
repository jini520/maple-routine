/**
 * 강화 기록 한 건이 쓴 **메소**로. 재료(규칙 셋 · 재설정 표 둘 · 스타포스 단계)는 `enhancementCosts` 칸이 들고
 * 식은 여기 있다.
 *
 * **모르면 `null` 이다. 0 이 아니다.** 못 매긴 것을 0 으로 세우면 합계가 조용히 거짓이 된다.
 * 부르는 쪽은 `null` 을 지출에서 빼고 건수만 센다.
 *
 * @see docs/persistence/sqlite.md `enhancement_history`
 */
import bundled from '../../data/enhancement-costs.json'
import {
  POTENTIAL_GRADES,
  POTENTIAL_RESET_TYPES,
  type EnhancementCostsTable,
  type EnhancementRules,
  type PotentialGradeKey,
  type PotentialResetCostRow,
  type PotentialResetTypeKey,
  type SoulPotentialResetCostRow,
  type StarforceStepRow,
} from '../../types/game-data'
import {
  isFiniteNumber,
  isNonNegativeInteger,
  isOneOf,
  isPositiveInteger,
  isRow,
  rowsOf,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { bundledTable, derive } from '../game-data/table'

/** 응답의 `potential_type` 글자 → 표의 종류 key. 이 둘 말고는 안 온다(1년치 4,507건 실측). */
const RESET_TYPE_KEYS: Record<string, PotentialResetTypeKey | undefined> = {
  '잠재능력 재설정': 'potential',
  '에디셔널 잠재능력 재설정': 'additional',
}
export type PotentialResetType = '잠재능력 재설정' | '에디셔널 잠재능력 재설정'

/** 응답의 등급 글자 → 표의 등급 key. 노멀은 재설정할 수 없어 표에 없다. */
const GRADE_KEYS: Record<string, PotentialGradeKey | undefined> = {
  레어: 'rare',
  에픽: 'epic',
  유니크: 'unique',
  레전드리: 'legendary',
}

/** 소울 잠재능력이 생긴 날(KST `YYYY-MM-DD`). 그 전 날짜는 소울 사용 내역이 있을 수 없다. */
export const SOUL_POTENTIAL_FROM = '2026-09-17'

function toRules(value: unknown): EnhancementRules | null {
  if (!isRow(value)) return null
  const { cubeAppraisalFreeMaxLevel, cubeAppraisalCoefficient, starforceDestroyDefenceSurchargePercent } = value
  if (!isNonNegativeInteger(cubeAppraisalFreeMaxLevel) || !isPositiveInteger(cubeAppraisalCoefficient)) return null
  if (!isNonNegativeInteger(starforceDestroyDefenceSurchargePercent)) return null
  return { cubeAppraisalFreeMaxLevel, cubeAppraisalCoefficient, starforceDestroyDefenceSurchargePercent }
}

function toResetCost(row: Row): PotentialResetCostRow | null {
  if (!isOneOf(row.type, POTENTIAL_RESET_TYPES) || !isOneOf(row.grade, POTENTIAL_GRADES)) return null
  if (!isPositiveInteger(row.minLevel) || !isNonNegativeInteger(row.costMeso)) return null
  return { type: row.type, minLevel: row.minLevel, grade: row.grade, costMeso: row.costMeso }
}

function toSoulResetCost(row: Row): SoulPotentialResetCostRow | null {
  if (!isOneOf(row.grade, POTENTIAL_GRADES) || !isNonNegativeInteger(row.costMeso)) return null
  return { grade: row.grade, costMeso: row.costMeso }
}

function toStep(row: Row): StarforceStepRow | null {
  if (!isNonNegativeInteger(row.fromStar) || !isFiniteNumber(row.exponent) || !isPositiveInteger(row.divisor)) return null
  return { fromStar: row.fromStar, exponent: row.exponent, divisor: row.divisor }
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. */
export function parseEnhancementCosts(value: unknown): EnhancementCostsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const rules = toRules(value.rules)
  const potentialResetCosts = rowsOf(value.potentialResetCosts, toResetCost)
  const soulPotentialResetCosts = rowsOf(value.soulPotentialResetCosts, toSoulResetCost)
  const starforceSteps = rowsOf(value.starforceSteps, toStep)
  if (rules === null || potentialResetCosts === null || soulPotentialResetCosts === null || starforceSteps === null) {
    return null
  }
  return { updatedAt, rules, potentialResetCosts, soulPotentialResetCosts, starforceSteps }
}

export const enhancementCostsTable = bundledTable('enhancementCosts', bundled, parseEnhancementCosts)

const index = derive(enhancementCostsTable, (table) => {
  // 종류 · 등급마다 레벨 구간 줄을 minLevel 내림차순으로. 처음 걸리는 줄이 그 레벨의 줄이다.
  const resetRows = new Map<string, PotentialResetCostRow[]>()
  for (const row of table.potentialResetCosts) {
    const key = `${row.type}|${row.grade}`
    const rows = resetRows.get(key)
    if (rows === undefined) resetRows.set(key, [row])
    else rows.push(row)
  }
  for (const rows of resetRows.values()) rows.sort((a, b) => b.minLevel - a.minLevel)
  return {
    resetRows,
    soulByGrade: new Map(table.soulPotentialResetCosts.map((row) => [row.grade, row.costMeso])),
    steps: new Map(table.starforceSteps.map((step) => [step.fromStar, step])),
  }
})

/**
 * 큐브 1회당 감정비용.
 *
 * 큐브 종류를 안 가린다. 큐브 자체는 캐시·이벤트로 얻으므로 메소가 드는 것은 감정뿐이다.
 * 무료 상한 이하가 0 인 것은 통찰력 90 이상이면 무료이고 이 앱이 모든 캐릭터를 100 으로 보기 때문이다.
 */
export function cubeAppraisalCost(itemLevel: number): number {
  const { rules } = enhancementCostsTable.get()
  if (itemLevel <= rules.cubeAppraisalFreeMaxLevel) return 0
  return rules.cubeAppraisalCoefficient * itemLevel * itemLevel
}

/**
 * 잠재 재설정 1회 비용. 등급을 모르거나 재설정할 수 없는 등급이면 `null`.
 *
 * @param type 응답의 `potential_type` 글자 그대로
 * @param grade **누르기 전** 등급. 응답의 등급 칸은 오른 뒤 값이라 넘기면 안 된다.
 */
export function potentialResetCost(type: PotentialResetType, itemLevel: number, grade: string): number | null {
  const typeKey = RESET_TYPE_KEYS[type]
  const gradeKey = GRADE_KEYS[grade]
  if (typeKey === undefined || gradeKey === undefined) return null
  const row = index()
    .resetRows.get(`${typeKey}|${gradeKey}`)
    ?.find((candidate) => itemLevel >= candidate.minLevel)
  return row?.costMeso ?? null
}

/** 소울 잠재능력 재설정 1회 비용. 레벨을 안 본다. 표에 없는 등급이면 `null`. */
export function soulPotentialResetCost(grade: string): number | null {
  const gradeKey = GRADE_KEYS[grade]
  return gradeKey === undefined ? null : (index().soulByGrade.get(gradeKey) ?? null)
}

/**
 * 스타포스 1회 비용. 성수가 표를 벗어나면 `null`.
 *
 * 파괴한 줄도 시도 비용만 센다. 복구비용은 안 센다. 응답이 장비를 이름으로만 가리켜서
 * 파괴 뒤 12성 재개가 복구인지 이름만 같은 다른 개체인지 가릴 수가 없다.
 *
 * @param fromStar 시도 **전** 성수(`before_starforce_count`)
 * @param discountRate 이벤트 할인 백분율. 반올림 **뒤**에 깎는 것이라 순서를 바꾸면 값이 어긋난다.
 * @param destroyDefence 파괴 방지를 켰나. 추가분은 할인 전 값에 붙고 할인을 안 받는다.
 * @param mvpDiscountRate MVP 할인 백분율. 이벤트 할인에 곱하고, 둘을 곱한 뒤 한 번만 내림한다.
 */
export function starforceCost(
  itemLevel: number,
  fromStar: number,
  discountRate = 0,
  destroyDefence = false,
  mvpDiscountRate = 0,
): number | null {
  const step = index().steps.get(fromStar)
  if (step === undefined) return null
  const { rules } = enhancementCostsTable.get()
  const raw = 1000 + (itemLevel ** 3 * (fromStar + 1) ** step.exponent) / step.divisor
  const rounded = Math.round(raw / 100) * 100
  const surcharge = destroyDefence ? (rounded * rules.starforceDestroyDefenceSurchargePercent) / 100 : 0
  return Math.floor((rounded * (100 - discountRate) * (100 - mvpDiscountRate)) / 10000) + surcharge
}
