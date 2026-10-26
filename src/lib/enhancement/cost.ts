/**
 * 강화 기록 한 건이 쓴 **메소**로. 재료(규칙 셋 · 재설정 표 둘 · 스타포스 단계)는 `enhancementCosts` 칸이 들고
 * 식은 여기 있다.
 *
 * **모르면 `null` 이다. 0 이 아니다.** 못 매긴 것을 0 으로 세우면 합계가 조용히 거짓이 된다.
 * 부르는 쪽은 `null` 을 지출에서 빼고 건수만 센다.
 *
 * @see docs/persistence/sqlite.md `enhancement_history`
 */
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
import { gameTable, derive } from '../game-data/table'

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

export const enhancementCostsTable = gameTable('enhancementCosts', { updatedAt: null, rules: { cubeAppraisalFreeMaxLevel: 0, cubeAppraisalCoefficient: 0, starforceDestroyDefenceSurchargePercent: 0 }, potentialResetCosts: [], soulPotentialResetCosts: [], starforceSteps: [] }, parseEnhancementCosts)

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

/** 스타포스 1회 비용을 MVP 할인을 받는 몫과 받지 않는 몫으로 나눈 것. */
export interface StarforceCostParts {
  /** 이벤트 할인까지 붙인 시도 비용. MVP 할인은 화면에 보일 때 이 값에 붙인다 */
  attemptMeso: number
  /** 파괴 방지 추가분. 어떤 할인도 받지 않는다 */
  destroyDefenceMeso: number
}

/**
 * 스타포스 1회 비용을 MVP 할인 전 두 몫으로. 성수가 표를 벗어나면 `null`.
 *
 * 합계는 MVP 할인 전 값으로 저장하고 할인은 화면에 보일 때 붙인다. 그래서 등급 기간을 고쳐도 다시 받을 필요가 없다.
 * 반올림한 값은 100 의 배수라 이벤트 할인을 붙여도 정수다.
 *
 * @param fromStar 시도 **전** 성수(`before_starforce_count`)
 * @param discountRate 이벤트 할인 백분율. 반올림 **뒤**에 깎는 것이라 순서를 바꾸면 값이 어긋난다.
 * @param destroyDefence 파괴 방지를 켰나. 추가분은 할인 전 값에 붙고 할인을 안 받는다.
 */
export function starforceCostParts(
  itemLevel: number,
  fromStar: number,
  discountRate = 0,
  destroyDefence = false,
): StarforceCostParts | null {
  const step = index().steps.get(fromStar)
  if (step === undefined) return null
  const { rules } = enhancementCostsTable.get()
  const raw = 1000 + (itemLevel ** 3 * (fromStar + 1) ** step.exponent) / step.divisor
  const rounded = Math.round(raw / 100) * 100
  return {
    attemptMeso: Math.floor((rounded * (100 - discountRate)) / 100),
    destroyDefenceMeso: destroyDefence ? (rounded * rules.starforceDestroyDefenceSurchargePercent) / 100 : 0,
  }
}

/**
 * 합계의 두 몫에 MVP 할인을 붙인 금액. 시도 비용에 할인을 한 번 붙이고 내림한 뒤 파괴 방지 추가분을 더한다.
 *
 * 시도마다 내림하던 것이 합계에 한 번 내림하는 것으로 바뀌어 시도당 1 메소 이하가 다를 수 있다.
 */
export function withMvpDiscount(parts: StarforceCostParts, mvpDiscountRate: number): number {
  return Math.floor((parts.attemptMeso * (100 - mvpDiscountRate)) / 100) + parts.destroyDefenceMeso
}
