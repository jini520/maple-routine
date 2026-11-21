/**
 * 결정석 가격 표(`crystalPrices` 칸) 조회. 보스 · 난이도 · 기간으로 가격 줄 하나를 고른다.
 *
 * 파티 인원 상한은 여기 없다. 보스 표의 난이도 줄이 들고 `lib/boss/bosses` 의 `getMaxPartySize` 가 읽는다.
 */
import type { BossCrystalPriceRow, CrystalPricesTable } from '../../types/game-data'
import type { BossDifficulty } from '../../types/scheduler'
import {
  compact,
  isNonEmptyString,
  isNonNegativeInteger,
  isPeriodText,
  isRow,
  optional,
  rowsOf,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { deriveAll, gameTable, type GameTable } from '../game-data/table'
import { type EffectivePeriod, getCurrentBossProfitPeriod, isEffectiveAnytimeIn, isEffectiveIn, periodOf } from './boss-profit-period'
import { bossDifficultyOfId } from './bosses'
import { bossCatalogTable } from './catalog'
import type { BossCycle } from '../../types'

/** 가격 한 줄. 판정이 읽는 기간과 함께 든다. */
export interface CrystalPriceEntry {
  priceMeso: number
  period: EffectivePeriod
}

function toPrice(row: Row): BossCrystalPriceRow | null {
  if (!isNonEmptyString(row.bossDifficultyId) || !isNonNegativeInteger(row.priceMeso)) return null
  const validFrom = optional(row.validFrom, isPeriodText)
  const validUntil = optional(row.validUntil, isPeriodText)
  if (validFrom === false || validUntil === false) return null
  return compact({ bossDifficultyId: row.bossDifficultyId, priceMeso: row.priceMeso, validFrom, validUntil })
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. */
export function parseCrystalPrices(value: unknown): CrystalPricesTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const bossCrystalPrices = rowsOf(value.bossCrystalPrices, toPrice)
  if (bossCrystalPrices === null) return null
  return { updatedAt, bossCrystalPrices }
}

export const crystalPricesTable = gameTable('crystalPrices', { updatedAt: null, bossCrystalPrices: [] }, parseCrystalPrices)

function pairKey(bossKey: string, difficulty: string): string {
  return `${bossKey}|${difficulty}`
}

/** 보스 key · 난이도마다 가격 줄들. 패치로 값이 바뀐 조합은 줄이 여럿이다. 모르는 난이도 줄의 가격은 뺀다. */
const pricesByPair = deriveAll([crystalPricesTable, bossCatalogTable] as GameTable<unknown>[], () => {
  const byPair = new Map<string, CrystalPriceEntry[]>()
  for (const row of crystalPricesTable.get().bossCrystalPrices) {
    const owner = bossDifficultyOfId(row.bossDifficultyId)
    if (owner === null) continue
    const key = pairKey(owner.bossKey, owner.difficulty)
    const entry = { priceMeso: row.priceMeso, period: periodOf(row) }
    const rows = byPair.get(key)
    if (rows === undefined) byPair.set(key, [entry])
    else rows.push(entry)
  }
  return byPair
})

function pricesOf(bossKey: string, difficulty: BossDifficulty): readonly CrystalPriceEntry[] {
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
  return pricesOf(bossKey, difficulty).find((entry) => isEffectiveIn(entry.period, periodKey, now))
}

/**
 * 지금 기간의 결정석 가격. 모르면 `null`.
 *
 * 파티 설정을 고치는 자리(보스 카드 · 보스 관리 · 주간 보스 수익 계산기)가 `받는 금액` 을 셀 때 쓴다. 설정은 앞으로
 * 적힐 기록의 약속이라 지금 기간의 가격으로 센다.
 */
export function currentCrystalPriceMeso(
  bossKey: string,
  difficulty: BossDifficulty,
  cycle: BossCycle,
  now: Date,
): number | null {
  return findPriceEntry(bossKey, difficulty, getCurrentBossProfitPeriod(cycle, now).periodKey, now)?.priceMeso ?? null
}

/** 그 기간에 가격을 아는 조합인가. 시계를 안 본다. 기록을 지우는 판정이 쓴다. */
export function hasPriceEntry(bossKey: string, difficulty: BossDifficulty, periodKey: string): boolean {
  return pricesOf(bossKey, difficulty).some((entry) => isEffectiveAnytimeIn(entry.period, periodKey))
}
