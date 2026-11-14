/**
 * 한 캐릭터의 그 주 결정석 몫. `주간 보스 수입 이전` 시트의 체크 박스가 금액 칸에 채운다.
 *
 * @see docs/features/cashbook.md 의 `입력`
 */
import { isMonthlyRowInWeek, monthsOfWeek } from '../../lib/boss/monthly-boss-week'
import { resetWeekStartOf } from '../../lib/calendar'
import { getBossProfitRecords, getWeeklyPeriodKeysWithRecords } from '../../storage/boss-profit'

/**
 * 보스 수익 주간 탭에서 그 캐릭터 카드의 결정석 몫과 같은 값을 내는 함수. 그 주에 선 월간 보스의 몫도 들고 드롭은 들지 않는다.
 *
 * @param dateKey 시트에서 고른 날짜. 그 날이 든 주(목요일부터 수요일까지)를 센다
 * @example const meso = await loadWeekCrystalMeso(senderOcid, dateKey, new Date())
 */
export async function loadWeekCrystalMeso(ocid: string, dateKey: string, now: Date): Promise<number> {
  const weekKey = resetWeekStartOf(dateKey)
  const monthKeys = monthsOfWeek(weekKey)
  const [records, weekLists] = await Promise.all([
    getBossProfitRecords([ocid], [weekKey, ...monthKeys]),
    Promise.all(monthKeys.map((monthKey) => getWeeklyPeriodKeysWithRecords([ocid], monthKey))),
  ])
  const weeksWithRecords = weekLists.flat()
  return records
    .filter((record) =>
      record.cycle === 'weekly'
        ? record.periodKey === weekKey
        : isMonthlyRowInWeek({
            weeklyPeriodKey: weekKey,
            monthlyPeriodKey: record.periodKey,
            isComplete: true,
            defeatedOn: record.defeatedOn ?? null,
            now,
            weeksWithRecords,
          }),
    )
    .reduce((sum, record) => sum + record.payoutMeso, 0)
}
