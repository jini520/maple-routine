import { getBackgroundTaskPort } from './ports'

/** 백그라운드 재확인 태스크를 OS 에 건다. 이미 걸려 있으면 간격만 바뀐다 */
export async function registerBackgroundRefresh(minimumIntervalMinutes: number): Promise<void> {
  await getBackgroundTaskPort().register(minimumIntervalMinutes)
}

export async function unregisterBackgroundRefresh(): Promise<void> {
  await getBackgroundTaskPort().unregister()
}
