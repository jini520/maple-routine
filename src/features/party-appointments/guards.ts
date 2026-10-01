import { resetWeekStartOf } from '../../lib/calendar'
import type { PartyAppointment } from '../../types/party-appointment'
import { occurrencesInWeek } from './occurrences'

/** 한 사람이 하루에 달 수 있는 약속 알림 수 */
export const DAILY_ALARM_LIMIT = 3

/**
 * 그 날(KST) 시작하는 약속 중 알림이 달린 회차 수.
 *
 * @param excludeId 고치는 중인 약속. 자기 알림은 빼고 세야 고칠 때 자기 몫에 막히지 않는다.
 */
export function alarmsOnDate(
  appointments: readonly PartyAppointment[],
  dateKey: string,
  excludeId?: string,
): number {
  const others = appointments.filter((appointment) => appointment.id !== excludeId)
  return occurrencesInWeek(others, resetWeekStartOf(dateKey)).filter(
    (occurrence) => occurrence.dateKey === dateKey && occurrence.leadMinutes !== null,
  ).length
}
