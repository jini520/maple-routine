import { LocalNotifications } from '@capacitor/local-notifications'
import type { NotificationsPort } from '../ports'

/** `NotificationsPort` 의 Capacitor 구현([[ADR-127]]). */
export const capacitorNotificationsPort: NotificationsPort = {
  async requestPermission() {
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted'
  },
  async hasPermission() {
    const { display } = await LocalNotifications.checkPermissions()
    return display === 'granted'
  },
  async schedule(request) {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: request.id,
          title: request.title,
          body: request.body,
          schedule: { at: request.scheduleAt },
        },
      ],
    })
  },
  async cancel(id) {
    await LocalNotifications.cancel({ notifications: [{ id }] })
  },
  async getPendingCount() {
    const { notifications } = await LocalNotifications.getPending()
    return notifications.length
  },
}
