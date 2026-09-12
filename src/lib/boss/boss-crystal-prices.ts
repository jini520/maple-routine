import bossCrystalPricesData from '../../data/boss-crystal-prices.json'
import type { BossDifficulty } from '../../types'
import { isEffectiveIn } from './boss-profit-period'

export interface CrystalPriceEntry {
  boss: string
  difficulty: string
  priceMeso: number | null
  maxPartySize?: number
  /** 이 날부터 유효하다(KST `YYYY-MM-DD`). 없으면 처음부터다. */
  from?: string
  /** 이 날 전까지 유효하다. 없으면 끝이 없다. */
  until?: string
}

export const CRYSTAL_PRICES = bossCrystalPricesData.prices as CrystalPriceEntry[]
export const DEFAULT_MAX_PARTY_SIZE = bossCrystalPricesData.partySizeScaling.defaultMaxPartySize

function isPair(entry: CrystalPriceEntry, boss: string, difficulty: BossDifficulty): boolean {
  return entry.boss === boss && entry.difficulty === difficulty
}

/**
 * 그 기간의 가격 줄. 패치로 값이 바뀐 조합은 줄이 여럿이고 기간의 첫날이 하나를 고른다.
 *
 * 기간을 받는 것은 가격을 동기화한 날이 아니라 처치의 기간이 정하게 하기 위해서다.
 */
export function findPriceEntry(
  boss: string,
  difficulty: BossDifficulty,
  periodKey: string,
): CrystalPriceEntry | undefined {
  return CRYSTAL_PRICES.find((entry) => isPair(entry, boss, difficulty) && isEffectiveIn(entry, periodKey))
}

/** 파티 인원 상한. 기간을 안 탄다. 한 조합의 줄들이 같은 값을 드는 것은 정합성 테스트가 지킨다. */
export function getMaxPartySize(boss: string, difficulty: BossDifficulty): number {
  return CRYSTAL_PRICES.find((entry) => isPair(entry, boss, difficulty))?.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE
}
