// 재조정을 실제 저장소 · 포트에 잇는 흐름. 권한 · 스위치 · 실패 · 멱등 · 다시 부르는 신호.
import { focusManager } from '@tanstack/react-query'

import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { setScheduleAlertEnabled } from '../../../storage/schedule-alert-settings'
import type { CachedSchedulerEntry } from '../../../storage/scheduler-cache'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import { useResetBoundaryTick } from '../../query/reset-timer'
import type { ScheduleRoundResult } from '../../schedule-sync/schedule-query'
import {
  __resetNativePortsForTest,
  setNotificationsPort,
  type ExactAlarmSetting,
  type LocalNotificationRequest,
} from '../../../native/ports'
import { getNotificationLedger, setNotificationLedger } from '../../../storage/notification-ledger'
import { setPartyAppointments } from '../../../storage/party-appointments'
import { setPartyAlarmEnabled } from '../../../storage/party-appointment-settings'
import { reconcileLocalNotifications, watchReconcileTriggers } from '../run'
import type { PartyAppointment } from '../../../types/party-appointment'

const NOW = new Date('2026-10-07T10:00:00Z')

const appointment: PartyAppointment = {
  id: '3f2b6c1e-8d4a-4c2f-9b1e-5a7d0c9e2f41',
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
let exactSetting: ExactAlarmSetting | Error = 'enabled'
let exactReads = 0
const scheduled: LocalNotificationRequest[] = []
const cancelled: number[] = []

beforeEach(async () => {
  installFakePreferences()
  granted = true
  failSchedule = false
  exactSetting = 'enabled'
  exactReads = 0
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
    getExactAlarmSetting: async () => {
      exactReads += 1
      if (exactSetting instanceof Error) throw exactSetting
      return exactSetting
    },
    openExactAlarmSettings: async () => {},
  })
  await setPartyAppointments([appointment])
})

afterEach(() => {
  __resetNativePortsForTest()
  queryClient.clear()
})

/** 추적 캐릭터 하나의 마지막 스케줄. 일일 퀘스트 하나가 남아 있다 */
function scheduleEntry(): CachedSchedulerEntry {
  return {
    state: {
      asOf: '2026-10-07T00:00+09:00',
      characterName: '낟낟',
      world: '베라',
      worldKey: 'bera',
      level: 280,
      jobClass: '렌',
      dailyContents: [{ contentKey: null, apiName: '일일 퀘스트', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 0 }],
      weeklyContents: [],
      bossContents: [],
      isDailyStale: false,
      isWeeklyStale: false,
      isWeeklyBossStale: false,
      isMonthlyBossStale: false,
    },
    syncedAt: '2026-10-07T05:00:00.000Z',
  }
}

function round(): ScheduleRoundResult {
  return { fetchedAt: '2026-10-07T05:00:00.000Z', receivedAt: null, ocids: [], outcomes: {}, stranded: [] }
}

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

describe('정확한 알람 권한', () => {
  it.each([
    ['enabled', true],
    // 안드로이드 12 미만 · iOS. 권한 없이 정한 시각에 울린다.
    ['unsupported', true],
    ['disabled', false],
  ] as const)('권한 %p 면 exact %p 로 예약하고 원장에 적는다', async (setting, exact) => {
    exactSetting = setting

    await reconcileLocalNotifications(NOW)

    expect(scheduled.map((request) => request.exact)).toEqual([exact])
    expect((await getNotificationLedger()).map((entry) => entry.exact)).toEqual([exact])
  })

  // 권한 없이 정확한 알람을 고르면 notifee 가 에러 없이 예약을 건너뛴다. 늦게 오는 알림이 안 오는 알림보다 낫다.
  it('권한을 읽다 실패하면 권한 없는 알람으로 잡는다', async () => {
    exactSetting = new Error('읽기 실패')

    await reconcileLocalNotifications(NOW)

    expect(scheduled.map((request) => request.exact)).toEqual([false])
  })

  it('권한은 재조정마다 한 번 읽는다', async () => {
    queryClient.setQueryData(queryKeys.trackedOcids(), ['ocid-1'])
    queryClient.setQueryData(queryKeys.schedule('ocid-1'), scheduleEntry())

    await reconcileLocalNotifications(NOW)

    expect(scheduled.length).toBeGreaterThan(1)
    expect(exactReads).toBe(1)
  })

  // 설정에서 권한을 켜고 돌아오면 복귀의 재조정이 정확한 알람으로 옮긴다.
  it('권한이 바뀌면 같은 알림을 다시 예약한다', async () => {
    exactSetting = 'disabled'
    await reconcileLocalNotifications(NOW)
    exactSetting = 'enabled'

    await reconcileLocalNotifications(NOW)

    expect(scheduled.map((request) => request.exact)).toEqual([false, true])
    expect(scheduled[0]!.id).toBe(scheduled[1]!.id)
    expect(cancelled).toEqual([])
  })
})

describe('미완료 스케줄 알림', () => {
  it('추적 캐릭터의 마지막 스케줄로 schedule 채널에 예약하고, 스위치를 끄면 취소한다', async () => {
    queryClient.setQueryData(queryKeys.trackedOcids(), ['ocid-1'])
    queryClient.setQueryData(queryKeys.schedule('ocid-1'), scheduleEntry())

    await reconcileLocalNotifications(NOW)
    const alerts = scheduled.filter((request) => request.channel === 'schedule')

    // 10-07(수) 19:00 KST 라 오늘 21:00 부터 7일 안의 날마다 한 장이다.
    expect(alerts).toHaveLength(7)
    expect(alerts[0]!.scheduleAt.toISOString()).toBe('2026-10-07T12:00:00.000Z')
    // 수요일이라 주간이 드는 날이지만, 주간은 남은 것이 없고 같은 리셋 주라 그 상태를 믿어 제목에서 빠진다.
    expect(alerts[0]!.title).toBe('일간 스케줄이 남은 것 같아요')

    await setScheduleAlertEnabled(false)
    await reconcileLocalNotifications(NOW)

    expect(cancelled).toEqual(expect.arrayContaining(alerts.map((request) => request.id)))
  })
})

describe('watchReconcileTriggers', () => {
  it('스케줄 회차 쿼리가 새 데이터를 들면 부르고, 다른 쿼리에는 안 부른다', () => {
    const reconcile = jest.fn()
    const stop = watchReconcileTriggers(reconcile)

    queryClient.setQueryData(queryKeys.scheduleRound(), round())
    expect(reconcile).toHaveBeenCalledTimes(1)
    queryClient.setQueryData(queryKeys.trackedOcids(), ['ocid-1'])
    expect(reconcile).toHaveBeenCalledTimes(1)

    stop()
    queryClient.setQueryData(queryKeys.scheduleRound(), round())
    expect(reconcile).toHaveBeenCalledTimes(1)
  })

  // 복귀는 AppShell 이 따로 잇는다. 여기서도 부르면 돌아올 때 두 번 돈다.
  it('자정 틱과 배경 전환에 부르고, 복귀에는 안 부른다', () => {
    const reconcile = jest.fn()
    const stop = watchReconcileTriggers(reconcile)

    useResetBoundaryTick.setState((state) => ({ tick: state.tick + 1 }))
    expect(reconcile).toHaveBeenCalledTimes(1)
    focusManager.setFocused(false)
    expect(reconcile).toHaveBeenCalledTimes(2)
    focusManager.setFocused(true)
    expect(reconcile).toHaveBeenCalledTimes(2)

    focusManager.setFocused(undefined)
    stop()
  })
})
