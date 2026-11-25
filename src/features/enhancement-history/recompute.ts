/**
 * 다시 매기기 요청에서 이번 회차에 받을 날을 고르는 자리. 요청 목록은 `lib/enhancement/recompute-requests.ts` 가 읽는다.
 *
 * @see docs/features/cashbook.md
 */
import { datesBetween } from '../../lib/calendar'
import type { RecomputeRequest } from '../../lib/enhancement/recompute-requests'

/**
 * 이번 회차에 다시 받을 날. 기간을 조회 하한과 오늘 사이로 자르고, 진행 다음 날부터 앞에서 고른다.
 *
 * @param doneThroughDate 지난 회차까지 받은 마지막 날. 처음이면 `null`
 * @param perRound 한 회차에 받을 날 수의 한도. 넥슨 로그인 계정만 있고 API 키 계정은 `null`
 * @returns `last` 가 참이면 이 날들을 받고 나면 요청이 끝난다. 받을 날이 없어도 참이다
 */
export function recomputeDatesOf(
  request: RecomputeRequest,
  doneThroughDate: string | null,
  floorDateKey: string,
  todayDateKey: string,
  perRound: number | null,
): { dates: string[]; last: boolean } {
  const from = [request.from, floorDateKey].sort()[1]
  const to = [request.to, todayDateKey].sort()[0]
  const remaining = from > to ? [] : datesBetween(from, to).filter((date) => doneThroughDate === null || date > doneThroughDate)
  const dates = perRound === null ? remaining : remaining.slice(0, perRound)
  return { dates, last: dates.length === remaining.length }
}
