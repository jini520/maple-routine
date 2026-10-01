import { resetWeekStartOf, shiftDateKey } from '../../lib/calendar'
import type { PartyAppointment, PartyAppointmentOccurrence } from '../../types/party-appointment'

const MINUTE_MS = 60_000

/** KST 는 서머타임이 없어 +09:00 고정이다 */
export function kstStartsAt(dateKey: string, timeKst: string): Date {
  return new Date(`${dateKey}T${timeKst}:00+09:00`)
}

function weeklyDateIn(weekStart: string, weekday: number): string {
  // 목요일(4)에서 시작하는 이레 안에서 그 요일까지의 거리
  return shiftDateKey(weekStart, (weekday + 7 - 4) % 7)
}

/** 한 회차가 서는 값. 이 주만 바꾼 회차는 예외가, 아니면 약속이 준다 */
type OccurrenceValues = Pick<PartyAppointment, 'timeKst' | 'durationMinutes' | 'bosses' | 'leadMinutes'>

function occurrenceOf(
  appointment: PartyAppointment,
  dateKey: string,
  values: OccurrenceValues,
  overridden: boolean,
): PartyAppointmentOccurrence {
  const startsAt = kstStartsAt(dateKey, values.timeKst)
  const endsAt = new Date(startsAt.getTime() + values.durationMinutes * MINUTE_MS)
  return {
    appointment,
    dateKey,
    timeKst: values.timeKst,
    startsAt,
    endsAt,
    bosses: values.bosses,
    leadMinutes: values.leadMinutes,
    overridden,
  }
}

/**
 * 한 리셋 주(목요일 dateKey)에 서는 약속 회차. 시작 날짜로 주에 넣고, 시작 순.
 *
 * @example occurrencesInWeek(appointments, resetWeekStartOf(todayKey))
 */
export function occurrencesInWeek(
  appointments: readonly PartyAppointment[],
  weekStart: string,
): PartyAppointmentOccurrence[] {
  const result: PartyAppointmentOccurrence[] = []
  for (const appointment of appointments) {
    const { schedule } = appointment
    if (schedule.type === 'once') {
      if (resetWeekStartOf(schedule.dateKey) !== weekStart) continue
      result.push(occurrenceOf(appointment, schedule.dateKey, appointment, false))
      continue
    }
    if (weekStart < schedule.fromWeek) continue
    if (schedule.untilWeek !== null && weekStart >= schedule.untilWeek) continue
    const exception = appointment.exceptions[weekStart]
    result.push(
      exception === undefined
        ? occurrenceOf(appointment, weeklyDateIn(weekStart, schedule.weekday), appointment, false)
        : occurrenceOf(appointment, exception.dateKey, exception, true),
    )
  }
  return result.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}
