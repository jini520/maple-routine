/**
 * 서버가 연 보스가 **이 기간에도 열려 있는가**.
 *
 * 서버는 보스 key 와 여는 날만 든다. 그 날이 주차인지 달인지, 지금 보는 기간이 그 뒤인지는 앱이
 * 판정한다. 서버가 앱의 기간 축을 알 필요가 없고, 알게 하면 같은 규칙이 두 저장소에 생긴다.
 *
 * @see docs/features/boss-profit.md 직접 완료로 기록한다
 */
import type { BossCycle } from '../../types'
import type { ManualCompletionBoss } from '../../types/manual-completion'
import { getPeriodDateKeys } from './boss-profit-period'

/** 어느 보스의 어느 기간을 묻는가. */
export interface ManualCompletionTarget {
  bossKey: string
  cycle: BossCycle
  periodKey: string
}

/** `YYYY-MM-DD` 인가. 서버 응답이라 모양을 믿지 않는다. */
function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * 그 기간에 직접 완료를 열 수 있나. **모르면 닫힘이다.**
 *
 * 기준은 **그 기간의 마지막 날이 여는 날 이상**이다. 여는 날이 주 한가운데여도 그 주가 열린다.
 * 운영자가 오늘 열면 오늘이 든 주부터 열려야 하기 때문이다.
 *
 * @param opened 서버가 준 목록. 못 받았으면 `null` 이고 그때는 아무것도 안 연다
 */
export function isManualCompletionOpen(
  opened: readonly ManualCompletionBoss[] | null,
  target: ManualCompletionTarget,
): boolean {
  const entry = opened?.find((one) => one.boss === target.bossKey)
  if (entry === undefined || !isDateKey(entry.from)) {
    return false
  }

  const days = getPeriodDateKeys(target.cycle, target.periodKey)
  const lastDay = days[days.length - 1]
  return lastDay !== undefined && lastDay >= entry.from
}

/** 기록 한 줄을 표시 판정에서 찾는 열쇠. 보스 key 와 난이도 key 를 잇는다. */
export function manualCompletionKey(bossKey: string, difficulty: string): string {
  return `${bossKey}|${difficulty}`
}

/**
 * 사용자가 직접 적은 완료를 **표시 목록에 얹는다**. 스케줄 캐시는 안 건드린다.
 *
 * 캐시에 쓰면 다음 동기화가 지운다(`mergeBossCycle` 이 새 응답을 항상 우선한다). 그래서 이 일은
 * 그릴 때마다 한다. 얹는 자리가 하나라야 스케줄러 카드 · today 남은 스케줄 · 주간 한도가 같은
 * 것을 센다.
 *
 * `ownComplete` 도 함께 세운다. 보스 수익이 **실제로 어느 난이도를 처치했는가** 를 그 값으로
 * 판정하는데, 직접 적은 완료는 사용자가 난이도까지 고른 것이라 승격이 아니라 사실이다.
 *
 * @param keys `manualCompletionKey` 로 만든 열쇠들. 그 캐릭터의 그 기간 기록에서 뽑는다
 */
export function applyManualCompletions<T extends { bossKey: string | null; difficulty: string }>(
  bosses: readonly T[],
  keys: ReadonlySet<string>,
): T[] {
  if (keys.size === 0) return [...bosses]
  return bosses.map((boss) =>
    boss.bossKey !== null && keys.has(manualCompletionKey(boss.bossKey, boss.difficulty))
      ? { ...boss, isComplete: true, ownComplete: true }
      : boss,
  )
}
