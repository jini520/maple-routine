// 백그라운드 태스크의 몸통. 캐시 복원을 기다린 뒤 회차를 받고 재조정한다. 회차가 실패해도 재조정은 한다.
const mockCalls: string[] = []
let mockRefreshFails = false
jest.mock('../../query/persist', () => ({
  whenQueryCacheRestored: async () => {
    mockCalls.push('restored')
  },
}))
jest.mock('../../schedule-sync/schedule-query', () => ({
  refreshSchedules: async () => {
    mockCalls.push('refresh')
    if (mockRefreshFails) throw new Error('회차 실패')
  },
}))
jest.mock('../../local-notifications/run', () => ({
  requestNotificationReconcile: async () => {
    mockCalls.push('reconcile')
  },
}))

import { __resetNativePortsForTest, setBackgroundTaskPort } from '../../../native/ports'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { setScheduleAlertEnabled } from '../../../storage/schedule-alert-settings'
import { BACKGROUND_REFRESH_INTERVAL_MINUTES, runBackgroundRefresh, syncBackgroundRefreshRegistration } from '../background-refresh'

beforeEach(() => {
  installFakePreferences()
  mockCalls.length = 0
  mockRefreshFails = false
})

afterEach(__resetNativePortsForTest)

describe('runBackgroundRefresh', () => {
  // 복원 전에 읽으면 추적 캐릭터가 없는 것으로 보여 계획이 빈다.
  it('캐시 복원을 기다린 뒤 회차를 받고 재조정한다', async () => {
    await runBackgroundRefresh()

    expect(mockCalls).toEqual(['restored', 'refresh', 'reconcile'])
  })

  // 캐시의 마지막 상태로 다시 쓰는 것이고 이미 서 있는 예약과 같으면 아무것도 안 한다.
  it('회차가 실패해도 재조정한다', async () => {
    mockRefreshFails = true

    await runBackgroundRefresh()

    expect(mockCalls).toEqual(['restored', 'refresh', 'reconcile'])
  })
})

describe('syncBackgroundRefreshRegistration', () => {
  const registered: number[] = []
  let unregistered = 0

  beforeEach(() => {
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
  })

  it('스위치가 켜져 있으면 걸고, 꺼져 있으면 푼다', async () => {
    await syncBackgroundRefreshRegistration()
    expect(registered).toEqual([BACKGROUND_REFRESH_INTERVAL_MINUTES])

    await setScheduleAlertEnabled(false)
    await syncBackgroundRefreshRegistration()
    expect(unregistered).toBe(1)
  })
})
