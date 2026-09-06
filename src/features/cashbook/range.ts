/**
 * 가계부가 **그리는 날짜 범위**.
 *
 * 화면과 층이 같은 답을 봐야 한다. 층은 이 범위의 강화 사용 내역을 받고 화면은 같은 범위의
 * 금액을 읽는다. 둘이 갈리면 열지도가 지출을 빼고 그려지거나, 안 그리는 날을 받느라 콜이 샌다.
 */
import {
  buildCalendarMonth,
  buildResetWeek,
  type CalendarWeek,
  monthKeyOf,
  resetWeekStartOf,
} from '../../lib/calendar'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'

export interface CashbookRange {
  from: string
  to: string
}

/**
 * 두 격자가 **함께 덮는** 날짜 범위. 보이는 칸(주간이면 이레)과 열지도 기준(언제나 그 달)을 다
 * 담아야 한다. 주간이 달을 걸치면 그 이레가 기준 달의 격자 밖으로 나갈 수 있어(예: 7/30 목요일
 * 주는 8/5 까지 가는데 7월 격자는 8/1 에 끝난다) 둘의 **합집합**을 쓴다.
 */
export function coveringRange(...grids: readonly CalendarWeek[][]): CashbookRange {
  const keys = grids.flat().flatMap((week) => week.map((day) => day.dateKey))
  return { from: keys.reduce((a, b) => (a < b ? a : b)), to: keys.reduce((a, b) => (a > b ? a : b)) }
}

/**
 * 처음 열었을 때의 범위. **주간 보기가 기본**이다.
 *
 * 층이 마운트에서 이 값을 쓴다. 화면이 자기 범위를 알려 주기를 기다리면 창이 먼저 분모를 잡고
 * 뒤늦게 히스토리가 자기 몫을 더해 **진행 바가 뒤로 간다**.
 */
export function defaultCashbookRange(now: Date): CashbookRange {
  const weekStartKey = resetWeekStartOf(getCurrentKstDateKey(now))
  return coveringRange([buildResetWeek(weekStartKey)], buildCalendarMonth(monthKeyOf(weekStartKey)))
}
