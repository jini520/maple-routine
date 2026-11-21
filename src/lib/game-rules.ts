/** 게임 규칙(`gameRules` 칸) 조회. */
import type { GameRules, GameRulesTable } from '../types/game-data'
import { isNonNegativeInteger, isPositiveInteger, isRow, updatedAtOf } from './game-data/contract'
import { gameTable } from './game-data/table'

export type { GameRules }

const POSITIVE: readonly (keyof GameRules)[] = [
  'weeklyBossSelectionLimit',
  'weeklyCrystalSaleLimit',
  'defaultMaxPartySize',
  'cubeAppraisalCoefficient',
]
const NON_NEGATIVE: readonly (keyof GameRules)[] = [
  'spendTariffPercent',
  'rewardCoinPriceMeso',
  'mesoMarketFeePercent',
  'cubeAppraisalFreeMaxLevel',
  'starforceDestroyDefenceSurchargePercent',
]

/** 규칙 아홉이 모두 정수로 있어야 통과한다. 하나라도 어기면 표 전체가 `null` 이다. */
export function parseGameRules(value: unknown): GameRulesTable | null {
  if (!isRow(value) || !isRow(value.gameRules)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const rules = value.gameRules
  if (!POSITIVE.every((key) => isPositiveInteger(rules[key]))) return null
  if (!NON_NEGATIVE.every((key) => isNonNegativeInteger(rules[key]))) return null
  const gameRules = Object.fromEntries(
    [...POSITIVE, ...NON_NEGATIVE].map((key) => [key, rules[key] as number]),
  ) as unknown as GameRules
  return { updatedAt, gameRules }
}

const EMPTY: GameRules = {
  weeklyBossSelectionLimit: 0,
  weeklyCrystalSaleLimit: 0,
  defaultMaxPartySize: 0,
  spendTariffPercent: 0,
  rewardCoinPriceMeso: 0,
  mesoMarketFeePercent: 0,
  cubeAppraisalFreeMaxLevel: 0,
  cubeAppraisalCoefficient: 0,
  starforceDestroyDefenceSurchargePercent: 0,
}

export const gameRulesTable = gameTable('gameRules', { updatedAt: null, gameRules: EMPTY }, parseGameRules)

/** 지금 규칙 */
export function gameRules(): GameRules {
  return gameRulesTable.get().gameRules
}
