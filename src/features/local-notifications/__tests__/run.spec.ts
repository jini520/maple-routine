// 재조정을 실제 저장소 · 포트에 잇는 흐름. 권한 · 스위치 · 실패 · 멱등.
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { __resetNativePortsForTest, setNotificationsPort, type LocalNotificationRequest } from '../../../native/ports'
import { getNotificationLedger, setNotificationLedger } from '../../../storage/notification-ledger'
import { setPartyAppointments } from '../../../storage/party-appointments'
import { setPartyAlarmEnabled } from '../../../storage/party-appointment-settings'
import { reconcileLocalNotifications } from '../run'
import type { PartyAppointment } from '../../../types/party-appointment'

const NOW = new Date('2026-10-07T10:00:00Z')

const appointment: PartyAppointment = {
  id: 'a1',
  bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
  members: [],
  timeKst: '21:00',
  durationMinutes: 30,
  leadMinutes: 10,
  schedule: { type: 'once', dateKey: '2026-10-07' },
  exceptions: {},
}

let granted = true
let failSchedule = false
const scheduled: LocalNotificationRequest[] = []
const cancelled: number[] = []

beforeEach(async () => {
  installFakePreferences()
  granted = true
  failSchedule = false
  scheduled.length = 0
  cancelled.length = 0
  setNotificationsPort({
    requestPermission: async () => granted,
    hasPermission: async () => granted,
    schedule: async (request) => {
      if (failSchedule) throw new Error('예약 실패')
      scheduled.push(request)
    },
    cancel: async (id) => {
      cancelled.push(id)
    },
    getPendingCount: async () => scheduled.length,
    addPressListener: () => () => {},
    getInitialPress: async () => null,
  })
  await setPartyAppointments([appointment])
})

afterEach(__resetNativePortsForTest)

describe('reconcileLocalNotifications', () => {
  it('약속 알림을 party 채널로 예약하고 원장에 적는다', async () => {
    await reconcileLocalNotifications(NOW)

    expect(scheduled).toHaveLength(1)
    expect(scheduled[0]!.channel).toBe('party')
    expect(scheduled[0]!.scheduleAt.toISOString()).toBe('2026-10-07T11:50:00.000Z')
    const ledger = await getNotificationLedger()
    expect(ledger.map((entry) => entry.id)).toEqual([scheduled[0]!.id])
  })

  it('두 번 돌려도 다시 예약하지 않는다', async () => {
    await reconcileLocalNotifications(NOW)
    await reconcileLocalNotifications(NOW)

    expect(scheduled).toHaveLength(1)
    expect(cancelled).toEqual([])
  })

  it('권한이 없으면 예약하지 않고 원장에 있던 것을 취소한다', async () => {
    await reconcileLocalNotifications(NOW)
    const [{ id }] = await getNotificationLedger()
    granted = false

    await reconcileLocalNotifications(NOW)

    expect(cancelled).toEqual([id])
    await expect(getNotificationLedger()).resolves.toEqual([])
  })

  it('파티 약속 알림 스위치가 꺼져 있으면 취소한다', async () => {
    await reconcileLocalNotifications(NOW)
    await setPartyAlarmEnabled(false)

    await reconcileLocalNotifications(NOW)

    expect(cancelled).toHaveLength(1)
    await expect(getNotificationLedger()).resolves.toEqual([])
  })

  // 원장 먼저 쓰면 크래시 뒤 원장이 예약돼 있다고 말해 다시 예약할 기회를 잃는다.
  it('예약이 실패한 것은 원장에 적지 않아 다음에 다시 한다', async () => {
    failSchedule = true
    await reconcileLocalNotifications(NOW)
    await expect(getNotificationLedger()).resolves.toEqual([])

    failSchedule = false
    await reconcileLocalNotifications(NOW)
    expect(scheduled).toHaveLength(1)
  })

  // OTA 가 알림 종류를 지우면 그 예약도 함께 사라져야 한다.
  it('레지스트리에 없는 종류가 원장에 있으면 취소한다', async () => {
    await setNotificationLedger([{ id: 99, kind: 'gone-kind', fireAt: NOW.getTime() + 1000, title: 't', body: 'b' }])

    await reconcileLocalNotifications(NOW)

    expect(cancelled).toEqual([99])
  })
})
