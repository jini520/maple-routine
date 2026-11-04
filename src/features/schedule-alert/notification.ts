/**
 * 미완료 스케줄 알림의 계획. 레지스트리의 `schedule-alert` 종류다.
 *
 * 매일 21:00 KST 하루 한 장이고 추적 캐릭터 전체를 한 장으로 접는다. 수요일은 주간, 그 달의 마지막 날은 월간이 함께 든다.
 * 마지막 상태는 계획하는 지금과 같은 기간일 때만 믿고, 다른 기간은 초기화 뒤라 모르는 것이라 남은 것으로 본다.
 */
import { monthKeyOf, resetWeekStartOf, shiftDateKey } from '../../lib/calendar'
import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { getManualTrackedContent } from '../../storage/manual-tracked-content'
import { getScheduleAlertEnabled } from '../../storage/schedule-alert-settings'
import { getTrackingMode } from '../../storage/tracking-mode'
import { readManualCompleted } from '../boss-scheduler/manual-completed-query'
import { buildBossViews } from '../boss-scheduler/views'
import { buildContentViews } from '../content-scheduler/views'
import { notificationId, type PlannedNotification } from '../local-notifications/reconcile'
import { remainingScheduleOf } from '../remaining-schedule/remaining-schedule'
import { readScheduleSnapshot } from '../schedule-sync/read-schedule'
import { scheduleAlertText, type AlertCycle } from './notification-text'

export const SCHEDULE_ALERT_KIND = 'schedule-alert'

const CYCLES: readonly AlertCycle[] = ['daily', 'weekly', 'monthly']
const HORIZON_DAYS = 7
const HORIZON_MS = HORIZON_DAYS * 24 * 60 * 60 * 1000

/** 마지막으로 아는 상태. 주기마다 추적 캐릭터 중 하나라도 남은 것이 있는가 */
export interface ScheduleAlertState {
  hasCharacters: boolean
  remaining: Record<AlertCycle, boolean>
}

/** 그날 21:00 KST. 기기 시간대와 관계없다 */
function fireAtOf(dateKey: string): number {
  return Date.parse(`${dateKey}T21:00:00+09:00`)
}

/** 그날 드는 주기. 일간은 매일, 주간은 다음 날이 리셋 주의 시작(목요일)인 날, 월간은 다음 날이 1일인 날 */
function dueCycles(dateKey: string): AlertCycle[] {
  const nextDay = shiftDateKey(dateKey, 1)
  return CYCLES.filter((cycle) => {
    if (cycle === 'daily') return true
    if (cycle === 'weekly') return resetWeekStartOf(nextDay) === nextDay
    return nextDay.endsWith('-01')
  })
}

/** 지금 아는 상태가 그날의 상태인가. 초기화를 사이에 두면 아니다 */
function isSamePeriod(cycle: AlertCycle, todayKey: string, dateKey: string): boolean {
  if (cycle === 'daily') return todayKey === dateKey
  if (cycle === 'weekly') return resetWeekStartOf(todayKey) === resetWeekStartOf(dateKey)
  return monthKeyOf(todayKey) === monthKeyOf(dateKey)
}

export function planScheduleAlerts(state: ScheduleAlertState, now: Date): PlannedNotification[] {
  if (!state.hasCharacters) return []
  const nowMs = now.getTime()
  const todayKey = getCurrentKstDateKey(now)
  const planned: PlannedNotification[] = []
  for (let offset = 0; offset <= HORIZON_DAYS; offset += 1) {
    const dateKey = shiftDateKey(todayKey, offset)
    const fireAt = fireAtOf(dateKey)
    if (fireAt <= nowMs || fireAt > nowMs + HORIZON_MS) continue
    // 같은 기간이면 마지막 상태를 믿어 다 한 주기를 뺀다. 다른 기간은 모르는 것이라 남은 것으로 본다.
    const listed = dueCycles(dateKey).filter((cycle) => !isSamePeriod(cycle, todayKey, dateKey) || state.remaining[cycle])
    if (listed.length === 0) continue
    const unknown = listed.some((cycle) => !isSamePeriod(cycle, todayKey, dateKey))
    planned.push({
      id: notificationId(SCHEDULE_ALERT_KIND, 'day', dateKey),
      kind: SCHEDULE_ALERT_KIND,
      fireAt,
      ...scheduleAlertText(listed, unknown),
      channel: 'schedule',
      data: { kind: SCHEDULE_ALERT_KIND, cycle: listed[0]!, dateKey },
    })
  }
  return planned
}

/**
 * 캐시와 저장소에서 마지막 상태를 읽는다. 화면이 보는 것과 같은 캐시라 값이 갈리지 않는다.
 * 세는 함수는 today 의 남은 스케줄 타일과 같은 `remainingScheduleOf` 다.
 */
export async function readScheduleAlertState(now: Date): Promise<ScheduleAlertState> {
  const snapshot = readScheduleSnapshot()
  const remaining: Record<AlertCycle, boolean> = { daily: false, weekly: false, monthly: false }
  if (snapshot.ocids.length === 0) return { hasCharacters: false, remaining }

  const contents = new Map(buildContentViews(snapshot).map((view) => [view.ocid, view]))
  const bosses = new Map(buildBossViews(snapshot).map((view) => [view.ocid, view]))
  const trackingMode = (await getTrackingMode()) ?? 'auto'
  const manualByOcid = Object.fromEntries(
    await Promise.all(snapshot.ocids.map(async (ocid) => [ocid, await getManualTrackedContent(ocid)] as const)),
  )
  const weeklyPeriodKey = getCurrentBossProfitPeriod('weekly', now).periodKey
  const monthlyPeriodKey = getCurrentBossProfitPeriod('monthly', now).periodKey
  const manualCompletedByOcid = await readManualCompleted(snapshot.ocids, [weeklyPeriodKey, monthlyPeriodKey])

  for (const ocid of snapshot.ocids) {
    const left = remainingScheduleOf({
      content: contents.get(ocid),
      boss: bosses.get(ocid),
      trackingMode,
      manualContentItems: manualByOcid[ocid] ?? [],
      manualBossByOcid: manualByOcid,
      manualCompletedByOcid,
      weeklyPeriodKey,
      now,
    })
    remaining.daily ||= left.dailyNames.length > 0
    remaining.weekly ||= left.weeklyNames.length > 0 || left.weeklyBosses.length > 0
    remaining.monthly ||= left.monthlyBosses.length > 0
  }
  return { hasCharacters: true, remaining }
}

/** `미완료 스케줄 알림` 이 꺼져 있으면 빈 계획이다 */
export async function planScheduleAlertKind(now: Date): Promise<PlannedNotification[]> {
  if (!(await getScheduleAlertEnabled())) return []
  return planScheduleAlerts(await readScheduleAlertState(now), now)
}
