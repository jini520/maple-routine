// 미완료 스케줄 알림 스위치의 스토어. 바꾸면 재조정을 부르고 백그라운드 태스크를 걸거나 푼다.
const mockReconcile = jest.fn(async () => undefined)
jest.mock('../../local-notifications/run', () => ({
  requestNotificationReconcile: () => mockReconcile(),
}))

import { __resetNativePortsForTest, setBackgroundTaskPort } from '../../../native/ports'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { setScheduleAlertEnabled } from '../../../storage/schedule-alert-settings'
import { useScheduleAlertSettingsStore } from '../alert-settings'

const registered: number[] = []
let unregistered = 0

beforeEach(() => {
  installFakePreferences()
  mockReconcile.mockClear()
  registered.length = 0
  unregistered = 0
  setBackgroundTaskPort({
    register: async (minutes) => {
      registered.push(minutes)
    },
    unregister: async () => {
      unregistered += 1
    },
  })
  useScheduleAlertSettingsStore.setState({ enabled: true, loaded: false })
})

afterEach(__resetNativePortsForTest)

it('끄면 재조정을 부르고 태스크를 푼다', async () => {
  await useScheduleAlertSettingsStore.getState().setEnabled(false)

  expect(mockReconcile).toHaveBeenCalled()
  expect(unregistered).toBe(1)
  expect(registered).toEqual([])
})

it('켜면 재조정을 부르고 태스크를 건다', async () => {
  await useScheduleAlertSettingsStore.getState().setEnabled(true)

  expect(mockReconcile).toHaveBeenCalled()
  expect(registered).toEqual([120])
})

it('저장된 값을 읽고, 없으면 켜짐이다', async () => {
  await useScheduleAlertSettingsStore.getState().load()
  expect(useScheduleAlertSettingsStore.getState()).toMatchObject({ enabled: true, loaded: true })

  await setScheduleAlertEnabled(false)
  await useScheduleAlertSettingsStore.getState().load()
  expect(useScheduleAlertSettingsStore.getState().enabled).toBe(false)
})
