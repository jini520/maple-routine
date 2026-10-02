// 로컬 알림 탭이 앱에 닿는 길을 모아 종류별로 나눈다. 지금 종류는 파티 약속 하나다.
import { renderHook } from '@testing-library/react-native'

import { __resetNativePortsForTest, setNotificationsPort } from '../../../native/ports'
import { usePartyAppointmentOpenStore } from '../../party-appointments/open-request'
import { useLocalNotificationPress } from '../use-notification-press'

let pressHandler: ((data: Record<string, string>) => void) | null = null
let initial: Record<string, string> | null = null

beforeEach(() => {
  pressHandler = null
  initial = null
  usePartyAppointmentOpenStore.setState({ request: null })
  setNotificationsPort({
    requestPermission: async () => true,
    hasPermission: async () => true,
    schedule: async () => {},
    cancel: async () => {},
    getPendingCount: async () => 0,
    addPressListener: (handler) => {
      pressHandler = handler
      return () => {
        pressHandler = null
      }
    },
    getInitialPress: async () => initial,
  })
})

afterEach(__resetNativePortsForTest)

const PARTY = { kind: 'party-appointment', appointmentId: 'a1', dateKey: '2026-10-08' }

describe('useLocalNotificationPress', () => {
  it('파티 약속 알림을 누르면 열 약속을 남긴다', async () => {
    await renderHook(() => useLocalNotificationPress())

    pressHandler!(PARTY)

    expect(usePartyAppointmentOpenStore.getState().request).toEqual({ appointmentId: 'a1', dateKey: '2026-10-08' })
  })

  it('죽어 있다 탭으로 열렸으면 그 약속을 남긴다', async () => {
    initial = PARTY
    await renderHook(() => useLocalNotificationPress())
    await new Promise((resolve) => setImmediate(resolve))

    expect(usePartyAppointmentOpenStore.getState().request).toEqual({ appointmentId: 'a1', dateKey: '2026-10-08' })
  })

  // iOS 는 죽어 있다 열릴 때 두 길로 같은 탭이 온다. 같은 회차를 두 번 열지 않는다.
  it('같은 탭이 두 길로 와도 한 번만 남긴다', async () => {
    initial = PARTY
    const open = jest.spyOn(usePartyAppointmentOpenStore.getState(), 'open')
    await renderHook(() => useLocalNotificationPress())
    pressHandler!(PARTY)
    await new Promise((resolve) => setImmediate(resolve))

    expect(open).toHaveBeenCalledTimes(1)
  })

  it('다른 종류는 무시한다', async () => {
    await renderHook(() => useLocalNotificationPress())

    pressHandler!({ kind: 'notice' })

    expect(usePartyAppointmentOpenStore.getState().request).toBeNull()
  })
})
