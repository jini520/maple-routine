/**
 * 기간 네비게이션이 기대는 두 물음. **직전 기간 총액**과 **더 뒤로 갈 수 있나**.
 *
 * 조회는 여기 없다. 창 동기화(`features/schedule-window`)가 진입할 때 창 안 기간을 다 채우므로
 * 이 파일이 API 를 부를 일이 사라졌다.
 */

import { getComparisonPeriodKeys } from '../../lib/boss/boss-profit-delta'
import { getAdjacentPeriodKey, isEarliestNavigablePeriod, isPeriodQueryable } from '../../lib/boss/boss-profit-period'
import { getBossProfitRecords, hasBossProfitRecordsAtOrBefore } from '../../storage/boss-profit'
import type { BossCycle } from '../../types'
import { withSqliteFallback } from './sqlite-guards'

// 현재 기간에서 한 칸 더 과거로 이동해도 되는지 판단한다. 이전 버튼 게이트와 조회 불가 경계가
// 서로 다른 하한을 쓰지 않게 한다. 착지할 이전 기간이 실제로 데이터를 보여줄 수 있을 때만
// 이동을 허용한다.
//  1) MIN_SCHEDULER_DATE 이전(스케줄러 API 존재 이전)은 어떤 경우에도 데이터가 없다 → 불가.
//  2) 지금 API 로 조회 가능하면(롤링 윈도우 안) 도달 시 백필로 채울 수 있다 → 가능.
//  3) 롤링 윈도우 밖이라 지금은 조회 불가지만 저장해 둔 기록이 있으면 보여줄 수 있다 → 가능.
// 이 캐시 존중이 롤링 하한을 그대로 이전 게이트로 쓰지 않는 이유다.
/**
 * 직전 기간 총 수익. SQLite 한 번이면 끝난다.
 *
 * `getComparisonPeriodKeys` 가 그 화면 총액 산식과 짝을 맞춘 키 목록을 준다. 월간 탭이면 직전
 * 달(monthly)과 그 달에 속한 주차들(weekly)이 함께 들어 있고 화면 총액도 그 둘을 더하므로,
 * cycle 로 거르지 않고 전부 합치는 것이 맞다.
 *
 * 기간 상태를 묻지 않는다. 기록이 없는 기간은 그냥 0 이다.
 */
export async function loadPreviousPeriodTotal(
  ocids: string[],
  tab: BossCycle,
  periodKey: string,
): Promise<number> {
  if (ocids.length === 0) {
    return 0
  }
  // 결정석만 센다. 아이템 판매가는 그 주에 실제로 판 값이라 주마다 들쭉날쭉하고, 섞으면 증감이
  // 이번 주 보스를 얼마나 돌았나 가 아니라 비싼 게 떴나 를 말하게 된다.
  const records = await withSqliteFallback(
    getBossProfitRecords(ocids, getComparisonPeriodKeys(tab, periodKey)),
    [],
  )
  return records.reduce((sum, record) => sum + record.payoutMeso, 0)
}

export async function canReachPreviousPeriod(
  tab: BossCycle,
  periodKey: string,
  ocids: string[],
  now: Date,
): Promise<boolean> {
  if (isEarliestNavigablePeriod(tab, periodKey)) {
    return false
  }
  const prevPeriodKey = getAdjacentPeriodKey(tab, periodKey, 'prev')
  if (isPeriodQueryable(tab, prevPeriodKey, now)) {
    return true
  }
  // 그 기간 또는 더 과거에 기록이 있으면 통과시킨다. 바로 이전 한 칸의 기록만 보면 접속하지
  // 않은 주가 벽이 되어 그 뒤의 기록 전체에 도달할 수 없다. 빈 기간은 한 칸씩 지나가야 하지만
  // 벽은 사라진다.
  return hasBossProfitRecordsAtOrBefore(ocids, tab, prevPeriodKey)
}
