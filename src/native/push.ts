import { getPushPort, type PushData } from './ports'

export type { PushData }

export async function subscribeToPushTopic(topic: string): Promise<void> {
  await getPushPort().subscribe(topic)
}

export async function unsubscribeFromPushTopic(topic: string): Promise<void> {
  await getPushPort().unsubscribe(topic)
}

export function addPushMessageListener(handler: (data: PushData) => void): () => void {
  return getPushPort().addMessageListener(handler)
}

export function addPushOpenedListener(handler: (data: PushData) => void): () => void {
  return getPushPort().addOpenedListener(handler)
}

export async function getInitialPushNotification(): Promise<PushData | null> {
  return getPushPort().getInitialNotification()
}
