/**
 * 주간 보스 수익 계산기의 계산. 고른 보스마다 내 몫을 지금 가격으로 세어 더한다.
 *
 * 몫은 보스 수익과 같은 식(`crystalPayoutMeso`)이다. 식이 둘이면 같은 보스 · 같은 파티가 두 화면에서 다른 금액이 된다.
 */
import type { BossDifficulty } from '../../types'
import { findPriceEntry } from './boss-crystal-prices'
import { getCurrentBossProfitPeriod } from './boss-profit-period'
import { bossReferenceOrder, isSeasonBoss, WEEKLY_BOSS_CLEAR_LIMIT } from './bosses'
import { crystalPayoutMeso, type PartyShares } from './party-shares'

/** 계산기의 보스 한 줄. 기록에도 이 값만 남기고 금액은 남기지 않는다 */
export interface CalculatorBoss {
  bossKey: string
  difficulty: BossDifficulty
  partySize: number
  shares: PartyShares
}

/** 이 보스 · 난이도 · 파티의 내 몫. 가격은 지금 주의 가격이다 */
export function bossPayoutMeso(boss: CalculatorBoss, now: Date): number {
  const periodKey = getCurrentBossProfitPeriod('weekly', now).periodKey
  const price = findPriceEntry(boss.bossKey, boss.difficulty, periodKey, now)?.priceMeso ?? 0
  return crystalPayoutMeso(price, boss.partySize, boss.shares)
}

export function totalPayoutMeso(bosses: readonly CalculatorBoss[], now: Date): number {
  return bosses.reduce((sum, boss) => sum + bossPayoutMeso(boss, now), 0)
}

/** 보스 표의 기준 순서로 늘어놓는다. 계산기의 보스 줄과 보스 선택의 선택 줄이 이 순서를 지킨다 */
export function sortByReferenceOrder<T extends { bossKey: string }>(bosses: readonly T[]): T[] {
  return [...bosses].sort((a, b) => bossReferenceOrder(a.bossKey) - bossReferenceOrder(b.bossKey))
}

/**
 * 주간 12개 한도를 넘는 보스를 몫이 작은 쪽부터 뺀다. 시즌 보스는 한도에 세지 않고 그대로 둔다.
 *
 * 보스 관리 값으로 채울 때 쓴다. 자동 모드는 게임에 등록한 보스를 그대로 가져와 12개를 넘을 수 있다.
 */
export function keepTopByPayout(
  bosses: readonly CalculatorBoss[],
  now: Date,
  limit: number = WEEKLY_BOSS_CLEAR_LIMIT,
): CalculatorBoss[] {
  const counted = bosses.filter((boss) => !isSeasonBoss(boss.bossKey))
  const kept = new Set(
    [...counted].sort((a, b) => bossPayoutMeso(b, now) - bossPayoutMeso(a, now)).slice(0, limit),
  )
  return sortByReferenceOrder(bosses.filter((boss) => isSeasonBoss(boss.bossKey) || kept.has(boss)))
}

/** 억 단위 소수 둘째 자리까지 반올림한 글자. 도넛 옆 캐릭터별 금액이 쓴다(`2억 6490만` → `2.65억`) */
export function formatEok(meso: number): string {
  if (meso === 0) return '0억'
  return `${(Math.round(meso / 1_000_000) / 100).toFixed(2)}억`
}
