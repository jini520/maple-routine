/**
 * 기간 네비게이션이 기대는 물음. **이전·다음 기간이 어디인가**와 **더 뒤로 갈 수 있나**.
 *
 * 조회는 여기 없다. 창 동기화(`features/schedule-window`)가 진입할 때 창 안 기간을 다 채우므로
 * 이 파일이 API 를 부를 일이 사라졌다.
 */

import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import { resetWeekStartOf } from '../../lib/calendar'
import { findAdjacentPeriodKeyWithRecords, getMonthlyDefeatDates } from '../../storage/boss-profit'
import type { BossCycle } from '../../types'
import { withSqliteFallback } from './sqlite-guards'

/**
 * 이전 기간. **기록이 있는 가장 가까운 기간**이고 없으면 `null`(안 움직인다).
 *
 * 한 칸씩 걸으면 오래 쉬었다 돌아온 사용자가 예전 기록에 닿는 데 수십 번이 든다. 그 사이는
 * 전부 조회 불가라 같은 화면이다.
 *
 * **조회 가능성을 안 본다.** 창 안의 0건도 건너뛴다(사용자 선택). 찾는 것은 기록이지 0 이 아니다.
 * 대가로 조회해서 0건을 확인한 주를 화살표로는 못 본다. 월간 탭의 주차 소계 행에는 남는다.
 *
 * 스케줄러 하한(`MIN_SCHEDULER_DATE`)도 안 본다. **기록이 있다는 것이 곧 보여줄 수 있다는 뜻**
 * 이고, 그 아래에는 애초에 기록이 안 생긴다.
 */
export async function resolvePreviousPeriodKey(
  tab: BossCycle,
  periodKey: string,
  ocids: string[],
): Promise<string | null> {
  const [byRecords, byMonthlyKill] = await Promise.all([
    withSqliteFallback(findAdjacentPeriodKeyWithRecords(ocids, tab, periodKey, 'prev'), null),
    monthlyKillWeeks(tab, ocids),
  ])
  const earlier = byMonthlyKill.filter((week) => week < periodKey)
  const nearest = earlier.length === 0 ? null : earlier.reduce((a, b) => (a > b ? a : b))
  if (byRecords === null || nearest === null) {
    return byRecords ?? nearest
  }
  return byRecords > nearest ? byRecords : nearest
}

/**
 * 월간 처치가 선 주들(주간 탭에서만). **그 주에 주간 기록이 없어도 열려야 한다.**
 *
 * 월간 기록의 `period_key` 는 달이라 주간 키 비교에 안 걸린다. 달 경계 주가 특히 그렇다 - 9/1
 * 에 잡은 9월 보스는 8/27 주에 서는데, 그 주에 주간 처치가 없으면 화살표가 안 열려 그 금액에
 * 닿을 길이 사라진다.
 *
 * 날짜를 모르는 기록은 안 본다. 그쪽은 `resolveUndatedWeek` 이 **기록이 있는 주차**만 고르므로
 * 이미 열리는 자리에 선다.
 */
async function monthlyKillWeeks(tab: BossCycle, ocids: string[]): Promise<string[]> {
  if (tab !== 'weekly') {
    return []
  }
  const dates = await withSqliteFallback(getMonthlyDefeatDates(ocids), [])
  return dates.map(resetWeekStartOf)
}

/**
 * 다음 기간. **기록이 있는 가장 가까운 기간**이고, 앞에 없으면 **지금 기간**이다.
 *
 * 지금은 기록이 없어도 갈 수 있어야 하는 자리다. 이번 주에 아직 안 잡았다고 돌아올 길이
 * 막히면 안 된다. 이미 지금 기간이면 `null` 이다(그보다 뒤는 미래다).
 */
export async function resolveNextPeriodKey(
  tab: BossCycle,
  periodKey: string,
  ocids: string[],
  now: Date,
): Promise<string | null> {
  const current = getCurrentBossProfitPeriod(tab, now).periodKey
  if (periodKey >= current) {
    return null
  }
  const [byRecords, byMonthlyKill] = await Promise.all([
    withSqliteFallback(findAdjacentPeriodKeyWithRecords(ocids, tab, periodKey, 'next'), null),
    monthlyKillWeeks(tab, ocids),
  ])
  const later = byMonthlyKill.filter((week) => week > periodKey)
  const nearest = later.length === 0 ? null : later.reduce((a, b) => (a < b ? a : b))
  const found =
    byRecords === null || nearest === null
      ? (byRecords ?? nearest)
      : byRecords < nearest
        ? byRecords
        : nearest
  // 찾은 것이 지금보다 뒤일 수는 없지만, 값이 그렇게 오더라도 지금에서 멈춘다.
  return found === null || found > current ? current : found
}

/**
 * 이전 화살표가 사는가. `resolvePreviousPeriodKey` 와 **같은 판정**이라 눌렀는데 안 움직이는
 * 일이 없다.
 */
export async function canReachPreviousPeriod(
  tab: BossCycle,
  periodKey: string,
  ocids: string[],
): Promise<boolean> {
  return (await resolvePreviousPeriodKey(tab, periodKey, ocids)) !== null
}
