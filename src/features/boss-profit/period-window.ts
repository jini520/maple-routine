/**
 * 미리 들 기간 목록. **어디까지 채워 두면 옮겨도 안 기다리나**.
 *
 * 두 화면의 답이 다르다. 보스 수익의 화살표는 한 칸이 아니라 **기록이 있는 가장 가까운 기간**
 * 으로 건너뛰므로(`resolvePreviousPeriodKey`) 미리 읽을 대상이 달력의 이웃이 아니라 그 착지점이다.
 * 아이템 가격 화면의 화살표는 한 칸씩 걸으므로(`getAdjacentPeriodKey`) 거기서는 달력의 이웃이
 * 곧 갈 수 있는 곳이다.
 *
 * 두 목록 다 **보는 기간이 맨 앞**이다. 그것이 늦게 채워지면 옮긴 화면이 빈 채로 남는다.
 *
 * @see docs/features/boss-profit.md 의 `기간을 미리 들고 있는다`
 */
import {
  getAdjacentPeriodKey,
  getCurrentBossProfitPeriod,
  isEarliestNavigablePeriod,
  isLatestPeriod,
} from '../../lib/boss/boss-profit-period'
import type { BossCycle } from '../../types'
import { resolveNextPeriodKey, resolvePreviousPeriodKey } from './period-navigation'

/** 보는 기간 앞뒤로 몇 칸씩 채우나. 다섯(`2 + 1 + 2`)이 창이 된다. */
export const PREFETCH_RADIUS = 2

/** 가격 화면이 미리 드는 범위. 보는 기간이 든 달의 앞뒤 몇 달인가. */
export const DROP_WINDOW_MONTHS = 2

/** 창의 한 칸. 탭이 함께 붙는 것은 오늘의 주간·월간이 반대 축에서도 들기 때문이다. */
export interface PeriodWindowEntry {
  tab: BossCycle
  periodKey: string
}

function monthOf(periodKey: string): string {
  return periodKey.slice(0, 'YYYY-MM'.length)
}

function shiftMonth(monthKey: string, steps: number): string {
  let shifted = monthKey
  for (let index = 0; index < Math.abs(steps); index += 1) {
    shifted = getAdjacentPeriodKey('monthly', shifted, steps < 0 ? 'prev' : 'next')
  }
  return shifted
}

/**
 * 보스 수익이 미리 들 기간들. **보는 기간 → 오늘의 두 축 → 화살표가 착지하는 앞뒤 두 칸**.
 *
 * 오늘 둘이 앞쪽에 있는 것은 `오늘` 버튼과 탭 전환이 언제나 그리로 가기 때문이다. 창 밖으로
 * 멀리 나가 있어도 그 둘은 표에 있어야 눌러도 안 기다린다.
 *
 * @param tab 지금 보고 있는 주기
 * @param periodKey 지금 보고 있는 기간
 * @param ocids 착지점을 찾을 때 볼 캐릭터들
 * @param now 오늘의 기간을 정하는 시각
 */
export async function resolvePeriodWindow(
  tab: BossCycle,
  periodKey: string,
  ocids: string[],
  now: Date,
): Promise<PeriodWindowEntry[]> {
  const entries: PeriodWindowEntry[] = []
  const seen = new Set<string>()
  const push = (entry: PeriodWindowEntry): void => {
    const key = `${entry.tab}|${entry.periodKey}`
    if (seen.has(key)) return
    seen.add(key)
    entries.push(entry)
  }

  push({ tab, periodKey })
  push({ tab: 'weekly', periodKey: getCurrentBossProfitPeriod('weekly', now).periodKey })
  push({ tab: 'monthly', periodKey: getCurrentBossProfitPeriod('monthly', now).periodKey })

  let backward: string | null = periodKey
  let forward: string | null = periodKey
  for (let step = 1; step <= PREFETCH_RADIUS; step += 1) {
    if (backward !== null) {
      backward = await resolvePreviousPeriodKey(tab, backward, ocids)
      if (backward !== null) push({ tab, periodKey: backward })
    }
    if (forward !== null) {
      forward = await resolveNextPeriodKey(tab, forward, ocids, now)
      if (forward !== null) push({ tab, periodKey: forward })
    }
  }

  return entries
}

/**
 * 아이템 가격 화면이 미리 들 기간들. **보는 기간이 든 달의 앞뒤 두 달**이고 가까운 순이다.
 *
 * 갈 수 없는 곳은 안 넣는다. 앞으로는 이번 기간까지(`isLatestPeriod`), 뒤로는 화살표가 죽는
 * 자리까지(`isEarliestNavigablePeriod`)다. 그 밖은 읽어 봐야 도착할 일이 없다.
 *
 * @param cycle 그 화면이 이어받은 주기
 * @param periodKey 지금 보고 있는 기간
 * @param now 앞쪽 벽을 정하는 시각
 */
export function dropWindowPeriodKeys(cycle: BossCycle, periodKey: string, now: Date): string[] {
  const floorMonth = shiftMonth(monthOf(periodKey), -DROP_WINDOW_MONTHS)
  const ceilMonth = shiftMonth(monthOf(periodKey), DROP_WINDOW_MONTHS)

  const keys = [periodKey]
  let backward: string | null = periodKey
  let forward: string | null = periodKey
  while (backward !== null || forward !== null) {
    if (backward !== null) {
      const previous: string | null = isEarliestNavigablePeriod(cycle, backward)
        ? null
        : getAdjacentPeriodKey(cycle, backward, 'prev')
      backward = previous === null || monthOf(previous) < floorMonth ? null : previous
      if (backward !== null) keys.push(backward)
    }
    if (forward !== null) {
      const next: string | null = isLatestPeriod(cycle, forward, now)
        ? null
        : getAdjacentPeriodKey(cycle, forward, 'next')
      forward = next === null || monthOf(next) > ceilMonth ? null : next
      if (forward !== null) keys.push(forward)
    }
  }

  return keys
}
