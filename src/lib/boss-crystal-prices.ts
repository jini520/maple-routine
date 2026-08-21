import bossCrystalPricesData from '../data/boss-crystal-prices.json'
import type { BossDifficulty } from '../types'

export interface CrystalPriceEntry {
  boss: string
  difficulty: string
  priceMeso: number | null
  maxPartySize?: number
}

export const CRYSTAL_PRICES = bossCrystalPricesData.prices as CrystalPriceEntry[]
export const DEFAULT_MAX_PARTY_SIZE = bossCrystalPricesData.partySizeScaling.defaultMaxPartySize

export function findPriceEntry(boss: string, difficulty: BossDifficulty): CrystalPriceEntry | undefined {
  return CRYSTAL_PRICES.find((entry) => entry.boss === boss && entry.difficulty === difficulty)
}

export function getMaxPartySize(boss: string, difficulty: BossDifficulty): number {
  return findPriceEntry(boss, difficulty)?.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE
}
