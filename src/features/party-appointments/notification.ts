/**
 * 레지스트리에 들어가는 파티 약속 알림 종류. 앞으로 7일 안에 울릴 회차마다 알림 하나를 계획한다.
 */
import { resetWeekStartOf, shiftDateKey } from '../../lib/calendar'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getPartyAlarmEnabled } from '../../storage/party-appointment-settings'
import { getPartyAppointments } from '../../storage/party-appointments'
import type { PartyAppointment } from '../../types/party-appointment'
import { notificationId, type PlannedNotification } from '../local-notifications/reconcile'
import { notificationText } from './notification-text'
import { occurrencesInWeek } from './occurrences'

export const PARTY_NOTIFICATION_KIND = 'party-appointment'

const HORIZON_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 지금부터 7일 안에 울릴 회차의 알림. 알림이 없거나 울릴 시각이 지난 회차는 뺀다.
 *
 * @param names 캐릭터 `ocid → 이름`
 */
export function planPartyNotifications(
  appointments: readonly PartyAppointment[],
  names: ReadonlyMap<string, string>,
  now: Date,
): PlannedNotification[] {
  const nowMs = now.getTime()
  const lastWeek = resetWeekStartOf(getCurrentKstDateKey(new Date(nowMs + HORIZON_MS)))
  const planned: PlannedNotification[] = []
  // 지평선이 리셋 주 경계를 넘으면 다음 주 회차도 본다.
  for (let week = resetWeekStartOf(getCurrentKstDateKey(now)); week <= lastWeek; week = shiftDateKey(week, 7)) {
    for (const occurrence of occurrencesInWeek(appointments, week)) {
      if (occurrence.leadMinutes === null) continue
      const fireAt = occurrence.startsAt.getTime() - occurrence.leadMinutes * 60_000
      if (fireAt <= nowMs || fireAt > nowMs + HORIZON_MS) continue
      planned.push({
        id: notificationId(PARTY_NOTIFICATION_KIND, occurrence.appointment.id, occurrence.dateKey),
        kind: PARTY_NOTIFICATION_KIND,
        fireAt,
        ...notificationText(occurrence, names),
        channel: 'party',
      })
    }
  }
  return planned
}

/** 약속에 나오는 캐릭터의 이름. 앱을 켠 직후에는 화면 스토어가 비어 있어 캐시에서 읽는다 */
async function characterNames(appointments: readonly PartyAppointment[]): Promise<Map<string, string>> {
  const ocids = [...new Set(appointments.flatMap((appointment) => appointment.bosses.map((boss) => boss.ocid)))]
  const entries = await Promise.all(
    ocids.map(async (ocid) => [ocid, (await getCachedCharacterBasic(ocid))?.profile.name ?? ''] as const),
  )
  return new Map(entries)
}

/** `파티 약속 알림` 이 꺼져 있으면 빈 계획이다 */
export async function planPartyAppointmentKind(now: Date): Promise<PlannedNotification[]> {
  if (!(await getPartyAlarmEnabled())) return []
  const appointments = await getPartyAppointments()
  return planPartyNotifications(appointments, await characterNames(appointments), now)
}
