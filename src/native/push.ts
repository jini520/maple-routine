import { getPushPort } from './ports'

export async function subscribeToPushTopic(topic: string): Promise<void> {
  await getPushPort().subscribe(topic)
}

export async function unsubscribeFromPushTopic(topic: string): Promise<void> {
  await getPushPort().unsubscribe(topic)
}
