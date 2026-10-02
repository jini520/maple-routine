/**
 * 로컬 알림 종류의 목록. 종류 하나가 한 줄이다. 여기서 빠진 종류의 예약은 재조정이 취소한다.
 */
import { PARTY_NOTIFICATION_KIND, planPartyAppointmentKind } from '../party-appointments/notification'
import type { PlannedNotification } from './reconcile'

export interface NotificationKind {
  kind: string
  /** 지금 예약해야 할 이 종류의 알림 */
  plan: (now: Date) => Promise<PlannedNotification[]>
}

export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  { kind: PARTY_NOTIFICATION_KIND, plan: planPartyAppointmentKind },
]
