/**
 * 지금 뒤에 시작하는 회차. today 의 다음 파티 스케줄 위젯이 맨 앞 하나를 보여 준다.
 *
 * 시작한 회차는 빠진다. 리셋 주와 상관없이 앞으로 찾는다. 한 번 약속은 한참 뒤에 있을 수 있어 가장 먼 한 번 약속의 주까지 본다.
 */
import { resetWeekStartOf, shiftDateKey } from '../../lib/calendar'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import type { PartyAppointment, PartyAppointmentOccurrence } from '../../types/party-appointment'
import { occurrencesInWeek } from './occurrences'

/**
 * 지금 뒤에 시작하는 회차를 시작 순으로 `limit` 개까지.
 *
 * @param limit 위젯이 분마다 다음으로 넘어갈 몫까지 넉넉히
 */
export function upcomingOccurrences(
  appointments: readonly PartyAppointment[],
  now: Date,
  limit = 5,
): PartyAppointmentOccurrence[] {
  if (appointments.length === 0) return []
  const nowMs = now.getTime()
  const thisWeek = resetWeekStartOf(getCurrentKstDateKey(now))
  // 반복 약속은 limit 주 안에 limit 회차가 선다. 한 번 약속은 그 날짜의 주까지 가야 한다.
  const onceWeeks = appointments.flatMap((appointment) =>
    appointment.schedule.type === 'once' ? [resetWeekStartOf(appointment.schedule.dateKey)] : [],
  )
  const lastWeek = [shiftDateKey(thisWeek, limit * 7), ...onceWeeks].reduce((a, b) => (a > b ? a : b))

  const result: PartyAppointmentOccurrence[] = []
  for (let week = thisWeek; week <= lastWeek && result.length < limit; week = shiftDateKey(week, 7)) {
    const inWeek = occurrencesInWeek(appointments, week)
      .filter((occurrence) => occurrence.startsAt.getTime() > nowMs)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    result.push(...inWeek)
  }
  return result.slice(0, limit)
}
