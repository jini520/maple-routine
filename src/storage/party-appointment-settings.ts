/**
 * 파티 약속 알림 스위치(설정 > 알림 설정의 `파티 약속 알림`). 기본은 켜짐이다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export async function getPartyAlarmEnabled(): Promise<boolean> {
  return (await preferences.get(STORAGE_KEYS.partyAlarmEnabled)) !== 'off'
}

export async function setPartyAlarmEnabled(enabled: boolean): Promise<void> {
  await preferences.set(STORAGE_KEYS.partyAlarmEnabled, enabled ? 'on' : 'off')
}
