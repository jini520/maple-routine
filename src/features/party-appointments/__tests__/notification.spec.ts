// 파티 약속 알림의 계획. 앞으로 7일 안에 울릴 회차마다 알림 하나다.
jest.mock('../../../storage/party-appointments', () => ({ getPartyAppointments: jest.fn(async () => []) }))
jest.mock('../../../storage/party-appointment-settings', () => ({ getPartyAlarmEnabled: jest.fn(async () => true) }))
jest.mock('../../server-sync/keyless', () => ({
  ...jest.requireActual('../../server-sync/keyless'),
  loadKeyLostScope: jest.fn(),
}))
jest.mock('../../schedule-sync/read-schedule', () => ({
  readCharacterBasic: (ocid: string) => (ocid === 'ocid-1' ? { profile: { name: '낟낟' } } : undefined),
}))

import { notificationId } from '../../local-notifications/reconcile'
import { PARTY_NOTIFICATION_KIND, planPartyAppointmentKind, planPartyNotifications } from '../notification'
import type { PartyAppointment } from '../../../types/party-appointment'

const NAMES = new Map([['ocid-1', '낟낟']])

function once(id: string, dateKey: string, leadMinutes: number | null, timeKst = '21:00'): PartyAppointment {
  return {
    id,
    bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
    timeKst,
    durationMinutes: 30,
    leadMinutes,
    schedule: { type: 'once', dateKey },
    exceptions: {},
  }
}

// 2026-10-07(수) 19:00 KST
const NOW = new Date('2026-10-07T10:00:00Z')

describe('planPartyNotifications', () => {
  it('알림을 단 회차마다 시작 전 그 분에 하나를 낸다', () => {
    const [item, ...rest] = planPartyNotifications([once('a1', '2026-10-07', 10)], NAMES, NOW)

    expect(rest).toEqual([])
    // 21:00 KST = 12:00Z, 10분 전
    expect(item!.fireAt).toBe(Date.parse('2026-10-07T11:50:00Z'))
    expect(item!.kind).toBe(PARTY_NOTIFICATION_KIND)
    expect(item!.channel).toBe('party')
    expect(item!.id).toBe(notificationId(PARTY_NOTIFICATION_KIND, 'a1', '2026-10-07'))
    expect(item!.title).toBe('낟낟 파티 보스 스케줄이 곧 시작해요')
    expect(item!.body).toBe('21:00 낟낟 하드 림보 파티 10분 전이에요')
    // 탭하면 이것으로 회차를 다시 찾는다.
    expect(item!.data).toEqual({ kind: PARTY_NOTIFICATION_KIND, appointmentId: 'a1', dateKey: '2026-10-07' })
  })

  it('알림이 없는 약속은 내지 않는다', () => {
    expect(planPartyNotifications([once('a1', '2026-10-07', null)], NAMES, NOW)).toEqual([])
  })

  it('울릴 시각이 이미 지났으면 내지 않는다', () => {
    // 19:05 KST 시작, 10분 전이면 18:55 로 지났다
    expect(planPartyNotifications([once('a1', '2026-10-07', 10, '19:05')], NAMES, NOW)).toEqual([])
  })

  it('7일 뒤에 울릴 것은 내지 않는다', () => {
    expect(planPartyNotifications([once('a1', '2026-10-15', 10)], NAMES, NOW)).toEqual([])
  })

  // 수요일에서 본 목요일은 다음 리셋 주다. 주 경계를 넘어 계획해야 한다.
  it('리셋 주 경계를 넘어 다음 주 회차도 낸다', () => {
    const weekly: PartyAppointment = {
      ...once('w1', '2026-10-01', 30),
      schedule: { type: 'weekly', weekday: 4, fromWeek: '2026-10-01', untilWeek: null },
    }

    const items = planPartyNotifications([weekly], NAMES, NOW)

    expect(items.map((item) => item.id)).toEqual([notificationId(PARTY_NOTIFICATION_KIND, 'w1', '2026-10-08')])
  })
})

describe('planPartyAppointmentKind', () => {
  const { getPartyAppointments } = jest.requireMock('../../../storage/party-appointments') as Record<string, jest.Mock>
  const { loadKeyLostScope } = jest.requireMock('../../server-sync/keyless') as Record<string, jest.Mock>

  function mixed(id: string, ocids: string[]): PartyAppointment {
    return {
      ...once(id, '2026-10-07', 10),
      bosses: ocids.map((ocid, index) => ({ bossKey: index === 0 ? 'limbo' : 'lucid', difficulty: 'hard', ocid })),
    }
  }

  // 부계정 키가 이 기기에 없으면 그 캐릭터의 파티는 알리지 않는다(사용자 지정).
  it('키 없는 부계정 캐릭터와 이 기기가 모르는 캐릭터의 보스는 알리지 않고, 섞인 스케줄은 남은 보스로 알린다', async () => {
    getPartyAppointments.mockResolvedValue([
      mixed('lost', ['ocid-sub']),
      mixed('unknown', ['#a1b2']),
      mixed('both', ['ocid-1', 'ocid-sub']),
    ])
    loadKeyLostScope.mockResolvedValue({ mapleIds: new Set(['sub']), ocids: new Map([['ocid-sub', 'sub']]) })

    const planned = await planPartyAppointmentKind(NOW)

    expect(planned.map((one) => one.id)).toEqual([notificationId(PARTY_NOTIFICATION_KIND, 'both', '2026-10-07')])
    expect(planned[0]!.title).toBe('낟낟 파티 보스 스케줄이 곧 시작해요')
    expect(planned[0]!.body).toBe('21:00 낟낟 하드 림보 파티 10분 전이에요')
  })
})
