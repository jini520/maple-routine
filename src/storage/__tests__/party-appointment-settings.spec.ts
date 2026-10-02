// 파티 약속 알림 스위치(설정 > 알림 설정). 기본은 켜짐이다.
import { installFakePreferences } from './fake-preferences'
import { getPartyAlarmEnabled, setPartyAlarmEnabled } from '../party-appointment-settings'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('partyAlarmEnabled')
})

describe('파티 약속 알림 스위치', () => {
  it('저장된 값이 없으면 켜짐', async () => {
    await expect(getPartyAlarmEnabled()).resolves.toBe(true)
  })

  it('끄면 꺼진 것을 읽는다', async () => {
    await setPartyAlarmEnabled(false)
    await expect(getPartyAlarmEnabled()).resolves.toBe(false)
  })

  it('다시 켜면 켜진다', async () => {
    await setPartyAlarmEnabled(false)
    await setPartyAlarmEnabled(true)
    await expect(getPartyAlarmEnabled()).resolves.toBe(true)
  })
})
