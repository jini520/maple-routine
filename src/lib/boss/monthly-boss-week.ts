/**
 * 월간 보스가 **어느 주에 서는가**.
 *
 * 월간 보스(검은마법사)는 월간 탭에서 빠져 각 캐릭터의 주간 보스 목록 맨 위로 온다. 기록의
 * `period_key` 는 달(`YYYY-MM`)이라 그 자체로는 주를 못 든다. 그 주를 여기서 고른다.
 *
 * 규칙은 셋이고 **한 달에 딱 한 주에만** 선다.
 *
 * 1. 그 주가 속한 달과 기록의 달이 같아야 한다. 주가 속한 달은 **그 주의 목요일** 기준이다
 *    (사용자 지정). 8/27 주는 9/1~9/2 를 품지만 8월이다.
 * 2. 아직 안 잡았으면 **이번 주에만** 선다. 지난 주에 미완료를 남기면 그 주에 할 일이 아니었던
 *    것이 할 일이었던 것으로 굳는다.
 * 3. 잡았으면 **잡은 주에** 선다. 날짜를 모르면 `resolveUndatedWeek` 이 고른다(그 달에서
 *    기록이 있는 가장 빠른 주차).
 *
 * @see docs/features/boss-profit.md 월간 보스
 */
import {
  getCurrentBossProfitPeriod,
  getPeriodDateKeys,
  getWeeklyPeriodKeysInMonth,
} from './boss-profit-period'

/** 주간 기간 키(`YYYY-MM-DD`, 목요일)가 속한 달. */
function monthOfWeek(weeklyPeriodKey: string): string {
  return weeklyPeriodKey.slice(0, 7)
}

/**
 * 잡은 날을 모르는 기록을 놓을 주차. **그 달에서 주간 기록이 있는 가장 빠른 주차**다.
 *
 * `defeated_on` 은 그 달 앞 2주 안에 앱을 열었을 때만 채워진다(스케줄러 조회 창이 13일이라 그
 * 달 1일을 못 보면 영영 `NULL`). 못 채운 기록을 어느 주에도 안 놓으면 그 금액이 주간 화면에서
 * 통째로 사라진다.
 *
 * **가장 빠른 주차인 이유**: 날짜를 못 캤다는 것 자체가 그 처치가 조회 창보다 앞, 곧 그 달의
 * 앞쪽이었다는 뜻이다. 뒤쪽 주에 놓으면 체계적으로 틀린 쪽으로 민다. 실제 데이터에서 원장이
 * 그것을 증명했다(네 캐릭터가 8/23 에 이미 완료였는데 화면은 08-27 주에 세우고 있었다).
 *
 * **기록이 있는 주차만 고르는 이유**: 기록이 없는 주는 이전 기간 게이트
 * (`hasBossProfitRecordsAtOrBefore`)에 막혀 열리지도 않는다. 금액을 아무도 못 가는 자리에
 * 두는 셈이 된다.
 *
 * @param weeksWithRecords 그 캐릭터들이 주간 기록을 가진 주차들. 순서·중복·달 무관
 */
export function resolveUndatedWeek(
  monthlyPeriodKey: string,
  now: Date,
  weeksWithRecords: readonly string[],
): string {
  const weeks = getWeeklyPeriodKeysInMonth(monthlyPeriodKey)
  const recorded = new Set(weeksWithRecords)
  const earliest = weeks.find((week) => recorded.has(week))
  if (earliest !== undefined) {
    return earliest
  }

  // 그 달에 주간 기록이 하나도 없다. 어느 주도 안 열리므로 어디에 놓든 같고, 적어도 아직 오지
  // 않은 주에는 안 놓는다(그 주는 `예정` 으로 선다).
  const currentWeek = getCurrentBossProfitPeriod('weekly', now).periodKey
  return [...weeks].reverse().find((week) => week <= currentWeek) ?? weeks[0]
}

export interface MonthlyRowWeekInput {
  /** 지금 보고 있는 주(`YYYY-MM-DD`, 목요일). */
  weeklyPeriodKey: string
  /** 그 월간 기록의 달(`YYYY-MM`). */
  monthlyPeriodKey: string
  isComplete: boolean
  /** 며칟날 잡았나(`YYYY-MM-DD`). 모르면 `null`. */
  defeatedOn: string | null
  now: Date
  /** 그 캐릭터들이 주간 기록을 가진 주차들. 날짜 모르는 기록을 놓을 주를 이것이 고른다. */
  weeksWithRecords: readonly string[]
}

export function isMonthlyRowInWeek(input: MonthlyRowWeekInput): boolean {
  if (input.monthlyPeriodKey !== monthOfWeek(input.weeklyPeriodKey)) {
    return false
  }

  if (!input.isComplete) {
    return input.weeklyPeriodKey === getCurrentBossProfitPeriod('weekly', input.now).periodKey
  }

  if (input.defeatedOn === null) {
    return (
      input.weeklyPeriodKey ===
      resolveUndatedWeek(input.monthlyPeriodKey, input.now, input.weeksWithRecords)
    )
  }

  return getPeriodDateKeys('weekly', input.weeklyPeriodKey).includes(input.defeatedOn)
}

/**
 * 다음 주를 미리 볼 수 있는가. **달 경계를 걸친 주의 이틀 남짓만** 참이다.
 *
 * 주가 속한 달은 그 주의 목요일 기준이라, 9월 보스는 9월 첫 목요일 주부터 선다. 그런데 9/1~9/2
 * 는 아직 8/27 주다. 그 이틀 동안 이 달의 월간 보스가 화면 어디에도 없다. 게임에서는 이미 잡을
 * 수 있는데 앱에는 자리가 없는 것이라, **그때만** 앞으로 한 칸 연다(사용자 지정).
 *
 * 그 밖에는 언제나 거짓이다. 이 함수가 참인 동안에도 열리는 것은 한 칸뿐이고, 그 주에 서면
 * `weeklyPeriodKey !== 현재 주` 라 더 못 간다.
 */
export function canPreviewNextWeek(weeklyPeriodKey: string, now: Date): boolean {
  if (weeklyPeriodKey !== getCurrentBossProfitPeriod('weekly', now).periodKey) {
    return false
  }
  return getCurrentBossProfitPeriod('monthly', now).periodKey !== monthOfWeek(weeklyPeriodKey)
}
