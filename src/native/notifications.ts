import { LocalNotifications } from '@capacitor/local-notifications'

export interface LocalNotificationRequest {
  id: number
  title: string
  body: string
  scheduleAt: Date
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { display } = await LocalNotifications.requestPermissions()
  return display === 'granted'
}

export async function hasNotificationPermission(): Promise<boolean> {
  const { display } = await LocalNotifications.checkPermissions()
  return display === 'granted'
}

export async function scheduleLocalNotification(request: LocalNotificationRequest): Promise<void> {
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
}

export async function cancelLocalNotification(id: number): Promise<void> {
  await LocalNotifications.cancel({ notifications: [{ id }] })
}

export async function getPendingNotificationCount(): Promise<number> {
  const { notifications } = await LocalNotifications.getPending()
  return notifications.length
}
