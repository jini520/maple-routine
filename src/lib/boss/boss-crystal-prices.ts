/**
 * 결정석 가격 표(`crystalPrices` 칸) 조회. 보스 · 난이도 · 기간으로 가격 줄 하나를 고른다.
 *
 * 파티 인원 상한은 여기 없다. 보스 표의 난이도 줄이 들고 `lib/boss/bosses` 의 `getMaxPartySize` 가 읽는다.
 */
import bundled from '../../data/crystal-prices.json'
import type { CrystalPriceRow, CrystalPricesTable } from '../../types/game-data'
import { BOSS_DIFFICULTIES, type BossDifficulty } from '../../types/scheduler'
import {
  compact,
  isNonEmptyString,
  isNonNegativeInteger,
  isOneOf,
  isPeriodText,
  isRow,
  optional,
  rowsOf,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { bundledTable, derive } from '../game-data/table'
import { isEffectiveAnytimeIn, isEffectiveIn } from './boss-profit-period'

export type CrystalPriceEntry = CrystalPriceRow

function toPrice(row: Row): CrystalPriceRow | null {
  if (!isNonEmptyString(row.boss) || !isOneOf(row.difficulty, BOSS_DIFFICULTIES)) return null
  if (!isNonNegativeInteger(row.priceMeso)) return null
  const from = optional(row.from, isPeriodText)
  const until = optional(row.until, isPeriodText)
  if (from === false || until === false) return null
  return compact({ boss: row.boss, difficulty: row.difficulty, priceMeso: row.priceMeso, from, until })
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. */
export function parseCrystalPrices(value: unknown): CrystalPricesTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const prices = rowsOf(value.prices, toPrice)
  if (prices === null) return null
  return { updatedAt, prices }
}

export const crystalPricesTable = bundledTable('crystalPrices', bundled, parseCrystalPrices)

function pairKey(bossKey: string, difficulty: string): string {
  return `${bossKey}|${difficulty}`
}

/** 보스 · 난이도마다 가격 줄들. 패치로 값이 바뀐 조합은 줄이 여럿이다. */
const pricesByPair = derive(crystalPricesTable, (table) => {
  const byPair = new Map<string, CrystalPriceRow[]>()
  for (const row of table.prices) {
    const key = pairKey(row.boss, row.difficulty)
    const rows = byPair.get(key)
    if (rows === undefined) byPair.set(key, [row])
    else rows.push(row)
  }
  return byPair
})

function pricesOf(bossKey: string, difficulty: BossDifficulty): readonly CrystalPriceRow[] {
  return pricesByPair().get(pairKey(bossKey, difficulty)) ?? []
}

/**
 * 그 기간의 가격 줄. 패치로 값이 바뀐 조합은 줄이 여럿이고 기간의 첫날이 하나를 고른다.
 *
 * 기간을 받는 것은 가격을 동기화한 날이 아니라 처치의 기간이 정하게 하기 위해서다.
 *
 * @param now 패치가 기간 첫날 안에서 적용될 때 쓴다. 09-17 패치는 오전 10시인데 주간 리셋은 그
 *   날 00:00 이라, 그 열 시간에 굳는 기록은 옛 가격이어야 한다.
 */
export function findPriceEntry(
  bossKey: string,
  difficulty: BossDifficulty,
  periodKey: string,
  now: Date,
): CrystalPriceEntry | undefined {
  return pricesOf(bossKey, difficulty).find((entry) => isEffectiveIn(entry, periodKey, now))
}

/** 그 기간에 가격을 아는 조합인가. 시계를 안 본다. 기록을 지우는 판정이 쓴다. */
export function hasPriceEntry(bossKey: string, difficulty: BossDifficulty, periodKey: string): boolean {
  return pricesOf(bossKey, difficulty).some((entry) => isEffectiveAnytimeIn(entry, periodKey))
}
