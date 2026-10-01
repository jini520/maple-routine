import { agendaDays, endClockOf } from '../agenda'
import { occurrencesInWeek } from '../occurrences'
import type { PartyAppointment } from '../../../types/party-appointment'

function appointment(overrides: Partial<PartyAppointment>): PartyAppointment {
  return {
    id: 'a1',
    bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
    members: [],
    timeKst: '21:00',
    durationMinutes: 30,
    leadMinutes: null,
    schedule: { type: 'once', dateKey: '2026-10-01' },
    exceptions: {},
    ...overrides,
  }
}

// 2026-10-01 은 목요일이다. 그 주는 10/1 ~ 10/7.
const WEEK = '2026-10-01'

describe('agendaDays', () => {
  it('약속이 있는 날만 날짜 순으로 묶고, 하루 안은 시작 순이다', () => {
    const late = appointment({ id: 'late', timeKst: '22:00', schedule: { type: 'once', dateKey: '2026-10-04' } })
    const second = appointment({ id: 'second', timeKst: '21:00' })
    const first = appointment({ id: 'first', timeKst: '20:30' })

    const days = agendaDays(occurrencesInWeek([late, second, first], WEEK))

    expect(days.map((day) => day.dateKey)).toEqual(['2026-10-01', '2026-10-04'])
    expect(days[0]!.occurrences.map((one) => one.appointment.id)).toEqual(['first', 'second'])
  })

  it('약속이 없으면 빈 목록이다', () => {
    expect(agendaDays([])).toEqual([])
  })
})

describe('endClockOf', () => {
  it('같은 날 끝나면 그 시각이다', () => {
    const [occurrence] = occurrencesInWeek([appointment({ timeKst: '20:30', durationMinutes: 60 })], WEEK)

    expect(endClockOf(occurrence!)).toBe('21:30')
  })

  it('자정을 넘으면 시계 그대로 적는다', () => {
    const [midnight] = occurrencesInWeek([appointment({ timeKst: '23:30', durationMinutes: 30 })], WEEK)
    const after = occurrencesInWeek([appointment({ timeKst: '23:30', durationMinutes: 60 })], WEEK)[0]

    expect(endClockOf(midnight!)).toBe('00:00')
    expect(endClockOf(after!)).toBe('00:30')
  })
})
