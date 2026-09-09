/**
 * 가계부가 **읽는 날짜 범위**.
 *
 * 화면과 층이 같은 답을 봐야 한다. 층은 이 범위의 강화 사용 내역을 Open API 에서 받고 화면은
 * 같은 범위의 금액을 기기 DB 에서 읽는다. 둘이 갈리면 격자에 그릴 것이 있는데 받아 온 적이
 * 없는 달이 생긴다.
 */
import {
  getAdjacentMonthKey,
  monthBounds,
  monthKeyOf,
  resetWeekStartOf,
} from '../../lib/calendar'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'

export interface CashbookRange {
  from: string
  to: string
}

/** 보는 달 앞뒤로 몇 달씩 채우나. 다섯 달(`2 + 1 + 2`)이 창이 된다. */
export const PREFETCH_RADIUS = 2

/**
 * 채워 둘 달들. **보는 달이 먼저**고 그다음 가까운 순이다.
 *
 * 순서가 곧 기기 DB 를 읽는 순서다. 보는 달이 늦게 오면 옮긴 화면이 빈 채로 남는다.
 *
 * 앞으로는 이번 달까지만, 뒤로는 한도까지만 간다. 그 밖으로는 화살표가 죽어 있어 갈 수 없고,
 * 채워 봐야 볼 수 없는 달이다.
 *
 * @param viewMonthKey 지금 보는 달
 * @param todayMonthKey 이번 달. 창의 천장이다
 */
export function monthWindow(viewMonthKey: string, todayMonthKey: string): string[] {
  const keys = [viewMonthKey]
  for (let step = 1; step <= PREFETCH_RADIUS; step += 1) {
    keys.push(getAdjacentMonthKey(viewMonthKey, -step), getAdjacentMonthKey(viewMonthKey, step))
  }
  // 바닥은 **주간이 닿는 달**이다. 월간이 3월에서 막혀도 주간은 2월에 시작하는 그 한 주까지 간다.
  const floor = monthKeyOf(floorWeekStartKey(todayMonthKey))
  return keys.filter((key) => key >= floor && key <= todayMonthKey)
}

/**
 * 창 전체를 덮는 하나의 날짜 범위. **층에 이 범위를 알린다.**
 *
 * 층에게 보이는 격자만 알리면 이웃 달이 기기 DB 에 없는 채로 남아, 옮겼을 때 그릴 것이 없다.
 * 창을 통째로 넘겨 **창 안은 언제나 받아 둔 상태**로 만든다. 이미 받아 둔 날은 조회 원장이
 * 걸러 내므로(`planEnhancementHistory`) 두 번 받지 않는다.
 */
export function monthWindowRange(viewMonthKey: string, todayMonthKey: string): CashbookRange {
  const months = [...monthWindow(viewMonthKey, todayMonthKey)].sort()
  const thisMonth = monthBounds(todayMonthKey)
  /**
   * 창이 비는 것은 **한도 밖의 달**을 보고 있을 때다. 화살표가 그리로 못 가게 막으므로 앱에서는
   * 안 나지만, 함수는 답을 내야 한다. 뒤집힌 범위를 주면 `datesBetween` 이 빈 목록을 낸다.
   */
  if (months.length === 0) return { from: thisMonth.to, to: thisMonth.from }
  return {
    from: monthBounds(months[0]).from,
    to: monthBounds(months[months.length - 1]).to,
  }
}

/**
 * Open API 로 거슬러 올라가는 한도. **앱 정책이다.**
 *
 * 넥슨 강화 기록 API 는 오늘로부터 2년까지 준다. 그 끝까지 받으면 첫 진입이 몇 배로 길어져,
 * 그보다 짧게 끊는다. **이미 받아 둔 날은 이 한도와 무관하다** - 기기 DB 에서 읽는 것이라
 * 2년이든 3년이든 그대로 그려진다.
 */
export const HISTORY_MONTHS_BACK = 18

/**
 * 갈 수 있는 **가장 이른 달**. 월간 화살표가 여기서 죽는다.
 *
 * 그 아래에 기기 DB 의 기록이 남아 있어도 안 간다(사용자 지정). 한도 아래는 새로 받을 길이
 * 없어 반쪽만 채워진 달이 되고, 화면이 그것을 그 달의 전부처럼 말하게 된다.
 */
export function floorMonthKey(todayMonthKey: string): string {
  return getAdjacentMonthKey(todayMonthKey, -HISTORY_MONTHS_BACK)
}

/**
 * 갈 수 있는 **가장 이른 주**이자 Open API 에 조회를 낼 수 있는 가장 이른 날.
 *
 * 1년 6개월 전 그 날짜가 아니라 **그 달 1일이 든 리셋 주의 목요일**이다. 주간 보기의 한 칸이
 * 목요일에 시작하므로 날짜로 끊으면 그 주의 앞부분만 비어 한 주가 반쪽으로 보인다. 그 달 1일이
 * 앞 달의 마지막 주에 들면 시작일도 앞 달이다(예: 2025-03-01 이 토요일이면 2025-02-27 목요일).
 *
 * **그래서 주간이 월간보다 며칠 더 간다.** 월간의 바닥이 3월이어도 주간은 2월 27일에 시작하는
 * 그 한 주까지 간다. 그 주가 3월 1일을 들고 있어서다.
 */
export function floorWeekStartKey(todayMonthKey: string): string {
  return resetWeekStartOf(monthBounds(floorMonthKey(todayMonthKey)).from)
}

/**
 * Open API 에 조회를 낼 수 있는 가장 이른 날. 갈 수 있는 가장 이른 주와 **같은 날**이다.
 *
 * @param todayDateKey KST `YYYY-MM-DD`
 */
export function historyFloorDateKey(todayDateKey: string): string {
  return floorWeekStartKey(monthKeyOf(todayDateKey))
}

/**
 * 층에 알리는 범위. 창 전체이되 **한도 아래로는 안 내려간다**.
 *
 * 한도보다 이른 달을 보고 있으면 `from` 이 `to` 를 넘어서고, 그때는 받을 날이 하나도 없다
 * (`datesBetween` 이 빈 목록을 준다). 그리는 것은 그대로다 - 기기 DB 읽기는 이 한도를 안 본다.
 *
 * @param todayDateKey KST `YYYY-MM-DD`
 */
export function apiWindowRange(viewMonthKey: string, todayDateKey: string): CashbookRange {
  const window = monthWindowRange(viewMonthKey, monthKeyOf(todayDateKey))
  const floor = historyFloorDateKey(todayDateKey)
  return { from: window.from < floor ? floor : window.from, to: window.to }
}

/**
 * 처음 열었을 때의 범위. 이번 달과 그 앞 둘이다.
 *
 * 층이 마운트에서 이 값을 쓴다. 화면이 자기 범위를 알려 주기를 기다리면 창이 먼저 분모를 잡고
 * 뒤늦게 히스토리가 자기 몫을 더해 **진행 바가 뒤로 간다**. 그래서 화면이 첫 렌더에 알릴 그
 * 범위와 **같아야 한다**(같으면 층이 두 번째 회차를 안 연다).
 */
export function defaultCashbookRange(now: Date): CashbookRange {
  const todayDateKey = getCurrentKstDateKey(now)
  return apiWindowRange(monthKeyOf(todayDateKey), todayDateKey)
}
