/** MVP 등급 표(`mvpGrades` 칸) 조회. */
import { MVP_GRADE_KEYS, type MvpGradeKey, type MvpGradeRow, type MvpGradesTable } from '../../types/game-data'
import {
  compact,
  isInteger,
  isNonEmptyString,
  isOneOf,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { gameTable, derive } from '../game-data/table'

export type { MvpGradeKey }
export type MvpGrade = MvpGradeRow

function isPercent(value: unknown): value is number {
  return isInteger(value) && value >= 0 && value <= 100
}

function toGrade(row: Row): MvpGradeRow | null {
  if (!isNonEmptyString(row.id) || !isOneOf(row.key, MVP_GRADE_KEYS) || !isNonEmptyString(row.name)) return null
  if (!isPercent(row.auctionFeePercent) || !isPercent(row.starforceDiscountPercent)) return null
  const plateAssetId = optional(row.plateAssetId, isNonEmptyString)
  if (plateAssetId === false) return null
  return compact({
    id: row.id,
    key: row.key,
    name: row.name,
    auctionFeePercent: row.auctionFeePercent,
    starforceDiscountPercent: row.starforceDiscountPercent,
    plateAssetId,
  })
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다.
 *
 * `normal` 줄은 꼭 있어야 한다. 등급을 모르는 캐릭터의 수수료가 그 줄이다.
 */
export function parseMvpGrades(value: unknown): MvpGradesTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const mvpGrades = rowsOf(value.mvpGrades, toGrade)
  if (mvpGrades === null || !uniqueBy(mvpGrades, (grade) => grade.key) || !uniqueBy(mvpGrades, (grade) => grade.id)) return null
  if (!mvpGrades.some((grade) => grade.key === 'normal')) return null
  return { updatedAt, mvpGrades }
}

export const mvpGradesTable = gameTable<MvpGradesTable>('mvpGrades', { updatedAt: null, mvpGrades: [] }, parseMvpGrades)

/** 등급 전부. 낮은 등급부터이고 이 차례가 높낮이다. */
export function mvpGrades(): readonly MvpGrade[] {
  return mvpGradesTable.get().mvpGrades
}

const index = derive(mvpGradesTable, (table) => ({
  byKey: new Map<string, MvpGrade>(table.mvpGrades.map((grade) => [grade.key, grade])),
  byId: new Map<string, MvpGrade>(table.mvpGrades.map((grade) => [grade.id, grade])),
  rankByKey: new Map<string, number>(table.mvpGrades.map((grade, rank) => [grade.key, rank])),
}))

/** 표의 한 줄. 모르는 key 는 `null`. */
export function findMvpGrade(key: string | null | undefined): MvpGrade | null {
  return key == null ? null : (index().byKey.get(key) ?? null)
}

/** 줄 id 로 찾은 표의 한 줄. 기록은 등급을 줄 id 로 든다. 모르는 id 는 `null`. */
export function findMvpGradeById(id: string | null | undefined): MvpGrade | null {
  return id == null ? null : (index().byId.get(id) ?? null)
}

/** 경매장 수수료(%). 등급이 없으면 일반 요율. */
export function auctionFeePercentOf(key: MvpGradeKey | null): number {
  return (findMvpGrade(key) ?? index().byKey.get('normal')!).auctionFeePercent
}

/** 스타포스 할인(%). 등급이 없으면 0. */
export function starforceDiscountPercentOf(key: MvpGradeKey | null): number {
  return findMvpGrade(key)?.starforceDiscountPercent ?? 0
}

/** 가장 높은 등급. 하나도 없으면 `null`. */
export function highestMvpGrade(keys: readonly (MvpGradeKey | null)[]): MvpGradeKey | null {
  const rankByKey = index().rankByKey
  let best: MvpGradeKey | null = null
  for (const key of keys) {
    if (key === null) continue
    if (best === null || (rankByKey.get(key) ?? -1) > (rankByKey.get(best) ?? -1)) best = key
  }
  return best
}

/** 고른 등급의 혜택 한 줄. `경매장 수수료 3% · 스타포스 10% 할인` */
export function mvpBenefitText(key: MvpGradeKey): string {
  const discount = starforceDiscountPercentOf(key)
  return `경매장 수수료 ${auctionFeePercentOf(key)}% · 스타포스 ${discount === 0 ? '할인 없음' : `${discount}% 할인`}`
}
