/** MVP 등급 표(`src/data/mvp-grades.json`) 조회. */
import gradesData from '../../data/mvp-grades.json'

export type MvpGradeKey = 'normal' | 'bronze' | 'silver' | 'gold' | 'diamond' | 'red' | 'black'

export interface MvpGrade {
  key: MvpGradeKey
  name: string
  auctionFeePercent: number
  starforceDiscountPercent: number
}

/** 낮은 등급부터. 이 차례가 높낮이 */
export const MVP_GRADES: readonly MvpGrade[] = gradesData.grades as MvpGrade[]

const gradeByKey = new Map<string, MvpGrade>(MVP_GRADES.map((grade) => [grade.key, grade]))
const rankByKey = new Map<string, number>(MVP_GRADES.map((grade, index) => [grade.key, index]))

/** 표의 한 줄. 모르는 key 는 `null`. */
export function findMvpGrade(key: string | null | undefined): MvpGrade | null {
  return key == null ? null : (gradeByKey.get(key) ?? null)
}

/** 경매장 수수료(%). 등급이 없으면 일반 요율. */
export function auctionFeePercentOf(key: MvpGradeKey | null): number {
  return (findMvpGrade(key) ?? gradeByKey.get('normal')!).auctionFeePercent
}

/** 스타포스 할인(%). 등급이 없으면 0. */
export function starforceDiscountPercentOf(key: MvpGradeKey | null): number {
  return findMvpGrade(key)?.starforceDiscountPercent ?? 0
}

/** 가장 높은 등급. 하나도 없으면 `null`. */
export function highestMvpGrade(keys: readonly (MvpGradeKey | null)[]): MvpGradeKey | null {
  let best: MvpGradeKey | null = null
  for (const key of keys) {
    if (key === null) continue
    if (best === null || rankByKey.get(key)! > rankByKey.get(best)!) best = key
  }
  return best
}
