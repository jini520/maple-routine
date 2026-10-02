// 파티 약속 알림 스위치의 스토어. 기기에 남은 값을 읽고, 바꾸면 남긴다.
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getPartyAlarmEnabled, setPartyAlarmEnabled } from '../../../storage/party-appointment-settings'
import { usePartyAlarmSettingsStore } from '../alarm-settings'

beforeEach(() => {
  installFakePreferences()
  usePartyAlarmSettingsStore.setState({ enabled: true, loaded: false })
})

describe('usePartyAlarmSettingsStore', () => {
  it('읽기 전에는 켜짐이다(기본값)', () => {
    expect(usePartyAlarmSettingsStore.getState().enabled).toBe(true)
  })

  it('기기에 꺼 둔 값을 읽는다', async () => {
    await setPartyAlarmEnabled(false)

    await usePartyAlarmSettingsStore.getState().load()

    expect(usePartyAlarmSettingsStore.getState()).toMatchObject({ enabled: false, loaded: true })
  })

  it('바꾸면 기기에 남긴다', async () => {
    await usePartyAlarmSettingsStore.getState().setEnabled(false)

    expect(usePartyAlarmSettingsStore.getState().enabled).toBe(false)
    await expect(getPartyAlarmEnabled()).resolves.toBe(false)
  })
})
