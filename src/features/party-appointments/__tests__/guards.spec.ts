import { DAILY_ALARM_LIMIT, alarmsOnDate } from '../guards'
import type { PartyAppointment } from '../../../types/party-appointment'

function appointment(overrides: Partial<PartyAppointment>): PartyAppointment {
  return {
    id: 'a1',
    bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
    members: [],
    timeKst: '21:00',
    durationMinutes: 30,
    leadMinutes: 10,
    schedule: { type: 'once', dateKey: '2026-10-01' },
    exceptions: {},
    ...overrides,
  }
}

it('하루 알림은 셋까지다', () => {
  expect(DAILY_ALARM_LIMIT).toBe(3)
})

describe('alarmsOnDate', () => {
  it('그 날 시작하는 약속 중 알림이 달린 것만 센다', () => {
    const list = [
      appointment({ id: 'a' }),
      appointment({ id: 'b', leadMinutes: null }),
      appointment({ id: 'c', schedule: { type: 'once', dateKey: '2026-10-02' } }),
    ]

    expect(alarmsOnDate(list, '2026-10-01')).toBe(1)
  })

  it('반복 약속은 그 날 회차가 서면 센다', () => {
    // 2026-10-01 은 목요일(4)이다.
    const weekly = appointment({ schedule: { type: 'weekly', weekday: 4, fromWeek: '2026-09-17', untilWeek: null } })
    // 이 주만 알림을 끈 회차는 안 센다. 알림 수는 약속이 아니라 회차의 알림을 본다.
    const quiet = appointment({
      id: 'quiet',
      schedule: { type: 'weekly', weekday: 4, fromWeek: '2026-09-17', untilWeek: null },
      exceptions: {
        '2026-10-01': {
          type: 'override',
          dateKey: '2026-10-01',
          timeKst: '21:00',
          durationMinutes: 30,
          bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
          leadMinutes: null,
        },
      },
    })

    expect(alarmsOnDate([weekly, quiet], '2026-10-01')).toBe(1)
  })

  it('고치는 중인 약속은 빼고 센다', () => {
    const list = [appointment({ id: 'a' }), appointment({ id: 'b' })]

    expect(alarmsOnDate(list, '2026-10-01', 'b')).toBe(1)
  })
})
