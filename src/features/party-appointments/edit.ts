/**
 * 상세에서 수정 · 삭제할 때 약속 목록을 바꾸는 순수 함수.
 *
 * 기준은 누른 회차가 든 리셋 주 W 다. 반복 약속은 W 앞의 주를 바꾸지 않는다. 지난 주 기록은 읽기만 하기 때문이다.
 */
import { resetWeekStartOf } from '../../lib/calendar'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import type {
  PartyAppointment,
  PartyAppointmentOccurrence,
  PartyAppointmentSchedule,
} from '../../types/party-appointment'
import { DEFAULT_LEAD_MINUTES, durationOf, toAppointment, type AppointmentDraft } from './draft'

const MINUTE_MS = 60_000

/** 그 주가 오늘이 든 주보다 앞이면 지난 주다. 지난 주 약속은 수정 · 삭제가 없다 */
export function isPastWeek(weekStart: string, todayKey: string): boolean {
  return weekStart < resetWeekStartOf(todayKey)
}

function kstParts(at: Date): { dateKey: string; minutes: number } {
  const dateKey = getCurrentKstDateKey(at)
  const kstMinutes = Math.floor(at.getTime() / MINUTE_MS + 9 * 60)
  return { dateKey, minutes: ((kstMinutes % (24 * 60)) + 24 * 60) % (24 * 60) }
}

/** 수정 시트를 열 때의 값. 이 주만 바꾼 회차면 그 주의 값이다 */
export function draftFromOccurrence(occurrence: PartyAppointmentOccurrence): AppointmentDraft {
  const start = kstParts(occurrence.startsAt)
  const end = kstParts(occurrence.endsAt)
  return {
    startDateKey: start.dateKey,
    startMinutes: start.minutes,
    endMinutes: end.minutes,
    bosses: occurrence.bosses,
    alarmOn: occurrence.leadMinutes !== null,
    leadMinutes: occurrence.leadMinutes ?? DEFAULT_LEAD_MINUTES,
    repeats: occurrence.appointment.schedule.type === 'weekly',
  }
}

/**
 * 반복 요일(0=일). 반복을 안 바꾸는 자리면 약속에 저장된 요일이고, 아니면 고른 시작 날짜의 요일.
 * 이 주만 다른 날로 옮긴 회차도 반복은 원래 요일 그대로다.
 *
 * @param keepSchedule 상세 · `이 주만 적용하기` 처럼 저장해도 반복 요일이 안 바뀌는 자리
 */
export function repeatWeekdayOf(
  draft: AppointmentDraft,
  schedule: PartyAppointmentSchedule | undefined,
  keepSchedule: boolean,
): number {
  if (keepSchedule && schedule?.type === 'weekly') return schedule.weekday
  return new Date(`${draft.startDateKey}T00:00:00Z`).getUTCDay()
}

/**
 * 수정한 약속 목록.
 *
 * @param weekStart 누른 회차가 든 리셋 주
 * @param options.thisWeekOnly 반복 약속에서 그 주 회차만 바꾼다
 * @param options.newId 앞으로 모두로 새 약속을 열 때 쓸 id
 */
export function applyEdit(
  appointments: readonly PartyAppointment[],
  target: PartyAppointment,
  weekStart: string,
  draft: AppointmentDraft,
  options: { thisWeekOnly: boolean; newId: string },
): PartyAppointment[] {
  const { schedule } = target
  const replace = (next: PartyAppointment[]): PartyAppointment[] =>
    appointments.flatMap((one) => (one.id === target.id ? next : [one]))

  if (schedule.type === 'once') {
    return replace([{ ...toAppointment(draft, target.id), members: target.members }])
  }

  if (options.thisWeekOnly) {
    const edited = toAppointment(draft, target.id)
    return replace([
      {
        ...target,
        exceptions: {
          ...target.exceptions,
          [weekStart]: {
            type: 'override',
            dateKey: draft.startDateKey,
            timeKst: edited.timeKst,
            durationMinutes: durationOf(draft),
            bosses: draft.bosses,
            leadMinutes: edited.leadMinutes,
          },
        },
      },
    ])
  }

  // 앞으로 모두. 옛 주별 예외는 시각 · 보스가 바뀌면 뜻을 잃으므로 가져가지 않는다.
  if (schedule.fromWeek < weekStart) {
    const ended: PartyAppointment = { ...target, schedule: { ...schedule, untilWeek: weekStart } }
    const opened = { ...toAppointment(draft, options.newId), members: target.members }
    return replace([ended, opened])
  }
  return replace([{ ...toAppointment(draft, target.id), members: target.members }])
}

/**
 * 삭제한 약속 목록. 반복 약속은 그 주부터 지우고 지난 주는 남긴다.
 *
 * @param weekStart 누른 회차가 든 리셋 주
 */
export function applyDelete(
  appointments: readonly PartyAppointment[],
  target: PartyAppointment,
  weekStart: string,
): PartyAppointment[] {
  const { schedule } = target
  if (schedule.type === 'weekly' && schedule.fromWeek < weekStart) {
    return appointments.map((one) =>
      one.id === target.id ? { ...target, schedule: { ...schedule, untilWeek: weekStart } } : one,
    )
  }
  return appointments.filter((one) => one.id !== target.id)
}
