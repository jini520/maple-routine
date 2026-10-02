// 파티 약속 알림의 계획. 앞으로 7일 안에 울릴 회차마다 알림 하나다.
import { notificationId } from '../../local-notifications/reconcile'
import { PARTY_NOTIFICATION_KIND, planPartyNotifications } from '../notification'
import type { PartyAppointment } from '../../../types/party-appointment'

const NAMES = new Map([['ocid-1', '낟낟']])

function once(id: string, dateKey: string, leadMinutes: number | null, timeKst = '21:00'): PartyAppointment {
  return {
    id,
    bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
    members: [],
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
