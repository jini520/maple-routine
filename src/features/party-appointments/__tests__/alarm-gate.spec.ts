// 알림 체크 상자를 켤 때 · 저장할 때의 확인 차례. 기기 권한 → 파티 약속 알림 스위치, 걸리는 첫 하나만.
import { __resetNativePortsForTest, setNotificationsPort } from '../../../native/ports'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getNotificationPermissionAsked, setNotificationPermissionAsked } from '../../../storage/notice-settings'
import { checkAlarmGate, ensureNotificationPermission, type AlarmGateDeps } from '../alarm-gate'

function deps(overrides: Partial<AlarmGateDeps> = {}): AlarmGateDeps {
  return {
    ensurePermission: jest.fn(async () => true),
    switchEnabled: true,
    ...overrides,
  }
}

describe('checkAlarmGate', () => {
  it('걸리는 것이 없으면 통과다', async () => {
    await expect(checkAlarmGate(deps())).resolves.toEqual({ kind: 'ok' })
  })

  it('권한이 없으면 권한이다', async () => {
    await expect(checkAlarmGate(deps({ ensurePermission: async () => false, switchEnabled: false }))).resolves.toEqual({
      kind: 'permission',
    })
  })

  it('권한은 있는데 스위치가 꺼져 있으면 스위치다', async () => {
    await expect(checkAlarmGate(deps({ switchEnabled: false }))).resolves.toEqual({ kind: 'switch' })
  })
})

describe('ensureNotificationPermission', () => {
  const request = jest.fn(async () => true)
  let granted = false

  beforeEach(() => {
    installFakePreferences()
    granted = false
    request.mockClear()
    setNotificationsPort({
      requestPermission: request,
      hasPermission: async () => granted,
      schedule: async () => {},
      cancel: async () => {},
      getPendingCount: async () => 0,
      addPressListener: () => () => {},
      getInitialPress: async () => null,
    })
  })

  afterEach(__resetNativePortsForTest)

  it('권한이 있으면 묻지 않는다', async () => {
    granted = true

    await expect(ensureNotificationPermission()).resolves.toBe(true)
    expect(request).not.toHaveBeenCalled()
  })

  it('한 번도 안 물었으면 OS 팝업으로 묻고, 물었다고 적는다', async () => {
    await expect(ensureNotificationPermission()).resolves.toBe(true)

    expect(request).toHaveBeenCalledTimes(1)
    await expect(getNotificationPermissionAsked()).resolves.toBe(true)
  })

  // iOS 는 두 번째로는 팝업을 안 띄운다. 물었는데 없으면 모달이 설정으로 보낸다.
  it('물었는데 없으면 다시 묻지 않고 거짓이다', async () => {
    await setNotificationPermissionAsked()

    await expect(ensureNotificationPermission()).resolves.toBe(false)
    expect(request).not.toHaveBeenCalled()
  })
})
