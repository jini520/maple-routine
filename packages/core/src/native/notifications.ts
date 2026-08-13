import { getNotificationsPort, type LocalNotificationRequest } from './ports'

export type { LocalNotificationRequest }

export async function requestNotificationPermission(): Promise<boolean> {
  return getNotificationsPort().requestPermission()
}

export async function hasNotificationPermission(): Promise<boolean> {
  return getNotificationsPort().hasPermission()
}

export async function scheduleLocalNotification(request: LocalNotificationRequest): Promise<void> {
  await getNotificationsPort().schedule(request)
}

export async function cancelLocalNotification(id: number): Promise<void> {
  await getNotificationsPort().cancel(id)
}

export async function getPendingNotificationCount(): Promise<number> {
  return getNotificationsPort().getPendingCount()
}
