// 파티 약속 알림 스위치(설정 > 알림 설정). 기본은 켜짐이다.
import { installFakePreferences } from './fake-preferences'
import { getPartyAlarmEnabled } from '../party-appointment-settings'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('partyAlarmEnabled')
})

describe('파티 약속 알림 스위치', () => {
  it('저장된 값이 없으면 켜짐', async () => {
    await expect(getPartyAlarmEnabled()).resolves.toBe(true)
  })
})
