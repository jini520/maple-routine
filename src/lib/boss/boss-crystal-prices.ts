import bossCrystalPricesData from '../../data/boss-crystal-prices.json'
import type { BossDifficulty } from '../../types'
import { isEffectiveAnytimeIn, isEffectiveIn } from './boss-profit-period'

export interface CrystalPriceEntry {
  /** 보스 key. */
  boss: string
  /** 난이도 key. */
  difficulty: string
  priceMeso: number | null
  maxPartySize?: number
  /** 이 때부터 유효하다(KST `YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm`). 없으면 처음부터다. */
  from?: string
  /** 이 때 전까지 유효하다. 없으면 끝이 없다. */
  until?: string
}

export const CRYSTAL_PRICES = bossCrystalPricesData.prices as CrystalPriceEntry[]
export const DEFAULT_MAX_PARTY_SIZE = bossCrystalPricesData.partySizeScaling.defaultMaxPartySize

function isPair(entry: CrystalPriceEntry, bossKey: string, difficulty: BossDifficulty): boolean {
  return entry.boss === bossKey && entry.difficulty === difficulty
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
  return CRYSTAL_PRICES.find((entry) => isPair(entry, bossKey, difficulty) && isEffectiveIn(entry, periodKey, now))
}

/** 그 기간에 가격을 아는 조합인가. 시계를 안 본다. 기록을 지우는 판정이 쓴다. */
export function hasPriceEntry(bossKey: string, difficulty: BossDifficulty, periodKey: string): boolean {
  return CRYSTAL_PRICES.some((entry) => isPair(entry, bossKey, difficulty) && isEffectiveAnytimeIn(entry, periodKey))
}

/** 파티 인원 상한. 기간을 안 탄다. 한 조합의 줄들이 같은 값을 드는 것은 정합성 테스트가 지킨다. */
export function getMaxPartySize(bossKey: string, difficulty: BossDifficulty): number {
  return CRYSTAL_PRICES.find((entry) => isPair(entry, bossKey, difficulty))?.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE
}
