/**
 * 미완료 스케줄 알림 스위치(설정 > 알림 설정의 `미완료 스케줄 알림`). 기본은 켜짐이다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export async function getScheduleAlertEnabled(): Promise<boolean> {
  return (await preferences.get(STORAGE_KEYS.scheduleAlertEnabled)) !== 'off'
}

export async function setScheduleAlertEnabled(enabled: boolean): Promise<void> {
  await preferences.set(STORAGE_KEYS.scheduleAlertEnabled, enabled ? 'on' : 'off')
}
