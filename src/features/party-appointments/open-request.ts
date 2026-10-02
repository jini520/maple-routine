/**
 * 알림을 눌러 열 약속. 앱 위에서 받은 탭을 들고 있다가 약속 화면이 그 회차의 상세를 열면 비운다.
 */
import { create } from 'zustand'

import { resetWeekStartOf } from '../../lib/calendar'
import type { NotificationData } from '../../native/notifications'
import type { PartyAppointment, PartyAppointmentOccurrence } from '../../types/party-appointment'
import { PARTY_NOTIFICATION_KIND } from './notification'
import { occurrencesInWeek } from './occurrences'

export interface PartyAppointmentOpenRequest {
  appointmentId: string
  /** 회차 날짜 KST `YYYY-MM-DD` */
  dateKey: string
}

/** 파티 약속 알림의 `data` 면 열 회차. 아니면 `null` */
export function parsePartyNotificationData(data: NotificationData): PartyAppointmentOpenRequest | null {
  const { kind, appointmentId, dateKey } = data
  if (kind !== PARTY_NOTIFICATION_KIND || appointmentId === undefined || dateKey === undefined) return null
  return { appointmentId, dateKey }
}

/**
 * 그 회차가 든 리셋 주와 회차. 약속을 지웠거나 그 회차가 없으면 회차는 `undefined` 이고 주만 연다.
 */
export function findNotifiedOccurrence(
  appointments: readonly PartyAppointment[],
  request: PartyAppointmentOpenRequest,
): { weekStart: string; occurrence: PartyAppointmentOccurrence | undefined } {
  const weekStart = resetWeekStartOf(request.dateKey)
  const occurrence = occurrencesInWeek(appointments, weekStart).find(
    (item) => item.appointment.id === request.appointmentId && item.dateKey === request.dateKey,
  )
  return { weekStart, occurrence }
}

interface PartyAppointmentOpenState {
  request: PartyAppointmentOpenRequest | null
  open: (request: PartyAppointmentOpenRequest) => void
  clear: () => void
}

export const usePartyAppointmentOpenStore = create<PartyAppointmentOpenState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  clear: () => set({ request: null }),
}))
