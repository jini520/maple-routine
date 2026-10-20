// 파티 약속 알림 스위치의 스토어.
const mockReconcile = jest.fn(async () => undefined)
jest.mock('../../local-notifications/run', () => ({
  requestNotificationReconcile: () => mockReconcile(),
}))

import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { usePartyAlarmSettingsStore } from '../alarm-settings'

beforeEach(() => {
  installFakePreferences()
  usePartyAlarmSettingsStore.setState({ enabled: true, loaded: false })
})

// 스위치를 끄면 예약된 약속 알림을 취소하고, 켜면 다시 잡는다.
it('바꾸면 알림 재조정을 부른다', async () => {
  await usePartyAlarmSettingsStore.getState().setEnabled(false)

  expect(mockReconcile).toHaveBeenCalled()
})
