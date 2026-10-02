/**
 * 로컬 알림 탭을 받아 종류별로 나누는 훅. 지금 종류는 파티 약속 하나이고, 열 약속을 남긴다.
 *
 * 탭이 오는 길은 둘이다. 앱이 살아 있을 때의 리스너와, 죽어 있다 탭으로 열렸을 때 한 번 답하는 `getInitialPress`.
 * iOS 는 죽어 있다 열릴 때 같은 탭을 두 길로 보내서 같은 회차는 한 번만 남긴다.
 */
import { useEffect } from 'react'

import { addNotificationPressListener, getInitialNotificationPress, type NotificationData } from '../../native/notifications'
import { parsePartyNotificationData, usePartyAppointmentOpenStore } from '../party-appointments/open-request'

export function useLocalNotificationPress(): void {
  useEffect(() => {
    let lastKey: string | null = null
    const pressed = (data: NotificationData): void => {
      const request = parsePartyNotificationData(data)
      if (request === null) return
      const key = `${request.appointmentId}:${request.dateKey}`
      if (key === lastKey) return
      lastKey = key
      usePartyAppointmentOpenStore.getState().open(request)
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
