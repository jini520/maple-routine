import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalNotifications } from '@capacitor/local-notifications'
import {
  cancelLocalNotification,
  getPendingNotificationCount,
  hasNotificationPermission,
  requestNotificationPermission,
  scheduleLocalNotification,
} from '../notifications'

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    requestPermissions: vi.fn(),
    checkPermissions: vi.fn(),
    schedule: vi.fn(),
    cancel: vi.fn(),
    getPending: vi.fn(),
  },
}))

beforeEach(() => {
  vi.mocked(LocalNotifications.requestPermissions).mockReset()
  vi.mocked(LocalNotifications.checkPermissions).mockReset()
  vi.mocked(LocalNotifications.schedule).mockReset()
  vi.mocked(LocalNotifications.cancel).mockReset()
  vi.mocked(LocalNotifications.getPending).mockReset()
})

describe('requestNotificationPermission', () => {
  it('display가 granted면 true를 반환한다', async () => {
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({ display: 'granted' })
    await expect(requestNotificationPermission()).resolves.toBe(true)
  })

  it('display가 denied면 false를 반환한다', async () => {
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({ display: 'denied' })
    await expect(requestNotificationPermission()).resolves.toBe(false)
  })
})

describe('hasNotificationPermission', () => {
  it('display가 granted면 true를 반환한다', async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'granted' })
    await expect(hasNotificationPermission()).resolves.toBe(true)
  })

  it('display가 prompt면 false를 반환한다', async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'prompt' })
    await expect(hasNotificationPermission()).resolves.toBe(false)
  })
})

describe('scheduleLocalNotification', () => {
  it('올바른 인자로 LocalNotifications.schedule을 호출한다', async () => {
    vi.mocked(LocalNotifications.schedule).mockResolvedValue({ notifications: [] })
    const scheduleAt = new Date('2026-07-12T00:00:00+09:00')

    await scheduleLocalNotification({
      id: 1,
      title: '일간 콘텐츠 미완료',
      body: '몬스터파크가 아직 남았어요',
      scheduleAt,
    })

    expect(LocalNotifications.schedule).toHaveBeenCalledWith({
      notifications: [
        {
          id: 1,
          title: '일간 콘텐츠 미완료',
          body: '몬스터파크가 아직 남았어요',
          schedule: { at: scheduleAt },
        },
      ],
    })
  })
})

describe('cancelLocalNotification', () => {
  it('올바른 id로 LocalNotifications.cancel을 호출한다', async () => {
    vi.mocked(LocalNotifications.cancel).mockResolvedValue(undefined)

    await cancelLocalNotification(42)

    expect(LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 42 }] })
  })
})

describe('getPendingNotificationCount', () => {
  it('예약된 알림 개수를 반환한다', async () => {
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({
      notifications: [
        { id: 1, title: 'a', body: 'a' },
        { id: 2, title: 'b', body: 'b' },
      ],
    })

    await expect(getPendingNotificationCount()).resolves.toBe(2)
  })

  it('예약된 알림이 없으면 0을 반환한다', async () => {
    vi.mocked(LocalNotifications.getPending).mockResolvedValue({ notifications: [] })

    await expect(getPendingNotificationCount()).resolves.toBe(0)
  })
})
