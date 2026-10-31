/**
 * 진행 중인 회차와 지금 뒤에 시작하는 회차. today 의 다음 파티 스케줄 위젯과 시간표 · 보드가 쓴다.
 *
 * 앞으로 찾을 때는 리셋 주와 상관없이 찾는다. 한 번 약속은 한참 뒤에 있을 수 있어 가장 먼 한 번 약속의 주까지 본다.
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

/**
 * 시작했고 끝나지 않은 회차를 시작 순으로.
 *
 * 회차는 시작한 주에 속해서, 수요일 밤에 시작해 자정을 넘긴 회차는 지난 주까지 봐야 찾는다.
 */
export function runningOccurrences(
  appointments: readonly PartyAppointment[],
  now: Date,
): PartyAppointmentOccurrence[] {
  const nowMs = now.getTime()
  const thisWeek = resetWeekStartOf(getCurrentKstDateKey(now))
  return [shiftDateKey(thisWeek, -7), thisWeek]
    .flatMap((week) => occurrencesInWeek(appointments, week))
    .filter((occurrence) => occurrence.startsAt.getTime() <= nowMs && nowMs < occurrence.endsAt.getTime())
}

/** 시간표와 보드가 주황으로 칠할 회차. 진행 중인 회차가 있으면 전부, 없으면 다음 회차 하나 */
export function accentOccurrences(
  appointments: readonly PartyAppointment[],
  now: Date,
): PartyAppointmentOccurrence[] {
  const running = runningOccurrences(appointments, now)
  return running.length > 0 ? running : upcomingOccurrences(appointments, now, 1)
}
