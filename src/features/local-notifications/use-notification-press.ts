/**
 * 로컬 알림 탭을 받아 종류별로 나누는 훅. 파티 약속은 열 약속을, 미완료 스케줄 알림은 열 주기를 남긴다.
 *
 * 탭이 오는 길은 둘이다. 앱이 살아 있을 때의 리스너와, 죽어 있다 탭으로 열렸을 때 한 번 답하는 `getInitialPress`.
 * iOS 는 죽어 있다 열릴 때 같은 탭을 두 길로 보내서 같은 알림은 한 번만 남긴다.
 */
import { useEffect } from 'react'

import { addNotificationPressListener, getInitialNotificationPress, type NotificationData } from '../../native/notifications'
import { parsePartyNotificationData, usePartyAppointmentOpenStore } from '../party-appointments/open-request'
import { parseScheduleAlertData, useScheduleAlertOpenStore } from '../schedule-alert/open-request'

export function useLocalNotificationPress(): void {
  useEffect(() => {
    let lastKey: string | null = null
    const once = (key: string): boolean => {
      if (key === lastKey) return false
      lastKey = key
      return true
    }
    const pressed = (data: NotificationData): void => {
      const party = parsePartyNotificationData(data)
      if (party !== null) {
        if (once(`party:${party.appointmentId}:${party.dateKey}`)) usePartyAppointmentOpenStore.getState().open(party)
        return
      }
      const alert = parseScheduleAlertData(data)
      if (alert !== null && once(`schedule-alert:${alert.dateKey}`)) useScheduleAlertOpenStore.getState().open(alert.cycle)
    }
    const off = addNotificationPressListener(pressed)
    void getInitialNotificationPress()
      .then((data) => {
        if (data !== null) pressed(data)
      })
      .catch(() => undefined)
    return off
  }, [])
}
