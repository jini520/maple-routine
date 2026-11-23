/**
 * 통계의 누적 순수익이 더하기 시작하는 날. 없으면 기록이 처음 있는 날부터다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import { whenRecordsReleased } from './record-hold'
import { enqueueChangedSetting } from './server-sync-queue'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export async function getStatsCumulativeStart(): Promise<string | null> {
  await whenRecordsReleased()
  const value = await preferences.get(STORAGE_KEYS.statsCumulativeStartDate)
  return value !== null && DATE_KEY.test(value) ? value : null
}

export async function setStatsCumulativeStart(dateKey: string): Promise<void> {
  await whenRecordsReleased()
  const before = await preferences.get(STORAGE_KEYS.statsCumulativeStartDate)
  await preferences.set(STORAGE_KEYS.statsCumulativeStartDate, dateKey)
  await enqueueChangedSetting('statsCumulativeStartDate', before, dateKey)
}
