/**
 * 강화 기록 한 건이 쓴 **메소**로. 값은 전부 `src/data/enhancement-prices.json` 이 든다.
 *
 * **모르면 `null` 이다. 0 이 아니다.** 못 매긴 것을 0 으로 세우면 합계가 조용히 거짓이 된다.
 * 부르는 쪽은 `null` 을 지출에서 빼고 건수만 센다.
 *
 * @see docs/persistence/sqlite.md `enhancement_history`
 */
import prices from '../../data/enhancement-prices.json'

/** 응답의 `potential_type` 그대로. 이 둘 말고는 안 온다(1년치 4,507건 실측). */
export type PotentialResetType = keyof typeof prices.potentialReset.byType

interface GradeRow {
  minLevel: number
  [grade: string]: number
}

const RESET_ROWS = prices.potentialReset.byType as Record<string, GradeRow[]>
const STAR_STEPS = new Map(prices.starforce.steps.map((step) => [step.fromStar, step]))

/**
 * 큐브 1회당 감정비용.
 *
 * 큐브 종류를 안 가린다. 큐브 자체는 캐시·이벤트로 얻으므로 메소가 드는 것은 감정뿐이다.
 * 120 이하가 0 인 것은 통찰력 90 이상이면 무료이고 이 앱이 모든 캐릭터를 100 으로 보기 때문이다.
 */
export function cubeAppraisalCost(itemLevel: number): number {
  if (itemLevel <= prices.cubeAppraisal.freeAtOrBelowLevel) return 0
  return 20 * itemLevel * itemLevel
}

/**
 * 잠재 재설정 1회 비용. 등급을 모르거나 재설정할 수 없는 등급이면 `null`.
 *
 * @param grade 종류에 따라 다른 칸을 넘길 것. 본 잠재는 `potential_option_grade`,
 *   에디셔널은 `additional_potential_option_grade` 다.
 */
export function potentialResetCost(
  type: PotentialResetType,
  itemLevel: number,
  grade: string,
): number | null {
  // 줄이 minLevel 내림차순이라 처음 걸리는 줄이 그 레벨의 줄이다.
  const row = RESET_ROWS[type]?.find((candidate) => itemLevel >= candidate.minLevel)
  return row?.[grade] ?? null
}

/**
 * 스타포스 1회 비용. 성수가 표를 벗어나면 `null`.
 *
 * @param fromStar 시도 **전** 성수(`before_starforce_count`)
 * @param discountRate 백분율. 반올림 **뒤**에 깎는 것이라 순서를 바꾸면 값이 어긋난다.
 */
export function starforceCost(
  itemLevel: number,
  fromStar: number,
  discountRate = 0,
): number | null {
  const step = STAR_STEPS.get(fromStar)
  if (step === undefined) return null
  const raw = 1000 + itemLevel ** 3 * (fromStar + 1) ** step.exponent / step.divisor
  const rounded = Math.round(raw / 100) * 100
  return Math.floor((rounded * (100 - discountRate)) / 100)
}
