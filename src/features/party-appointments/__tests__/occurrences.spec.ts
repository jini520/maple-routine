import { kstStartsAt, occurrencesInWeek } from '../occurrences'
import type { PartyAppointment } from '../../../types/party-appointment'

function appointment(overrides: Partial<PartyAppointment>): PartyAppointment {
  return {
    id: 'a1',
    bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
    members: [],
    timeKst: '21:00',
    durationMinutes: 30,
    leadMinutes: null,
    schedule: { type: 'once', dateKey: '2026-09-30' },
    exceptions: {},
    ...overrides,
  }
}

// 2026-09-24 는 목요일이다. 그 주는 9/24 ~ 9/30.
const WEEK = '2026-09-24'

describe('kstStartsAt', () => {
  it('KST 벽시계를 UTC 순간으로 바꾼다', () => {
    expect(kstStartsAt('2026-09-30', '21:00').toISOString()).toBe('2026-09-30T12:00:00.000Z')
  })

  it('KST 자정 언저리는 UTC 로 전날이다', () => {
    expect(kstStartsAt('2026-10-01', '00:20').toISOString()).toBe('2026-09-30T15:20:00.000Z')
  })
})

describe('occurrencesInWeek', () => {
  it('한 번뿐인 약속은 그 날짜가 주 안에 있을 때만 선다', () => {
    const inside = appointment({ id: 'in', schedule: { type: 'once', dateKey: '2026-09-30' } })
    const outside = appointment({ id: 'out', schedule: { type: 'once', dateKey: '2026-10-01' } })

    const result = occurrencesInWeek([inside, outside], WEEK)

    expect(result.map((one) => one.appointment.id)).toEqual(['in'])
  })

  it('수요일 23:59 는 그 주이고 목요일 00:00 은 다음 주다', () => {
    const wed = appointment({ id: 'wed', timeKst: '23:59', schedule: { type: 'once', dateKey: '2026-09-30' } })
    const thu = appointment({ id: 'thu', timeKst: '00:00', schedule: { type: 'once', dateKey: '2026-10-01' } })

    expect(occurrencesInWeek([wed, thu], WEEK).map((one) => one.appointment.id)).toEqual(['wed'])
    expect(occurrencesInWeek([wed, thu], '2026-10-01').map((one) => one.appointment.id)).toEqual(['thu'])
  })

  it('반복 약속은 요일에 맞는 날짜에 선다', () => {
    const tuesday = appointment({
      schedule: { type: 'weekly', weekday: 2, fromWeek: '2026-09-17', untilWeek: null },
    })

    const [one] = occurrencesInWeek([tuesday], WEEK)

    expect(one.dateKey).toBe('2026-09-29')
    expect(one.startsAt.toISOString()).toBe('2026-09-29T12:00:00.000Z')
    expect(one.overridden).toBe(false)
    expect(one.bosses).toEqual([{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }])
    expect(one.leadMinutes).toBeNull()
  })

  it('반복 약속은 fromWeek 부터 서고 untilWeek 는 포함하지 않는다', () => {
    const weekly = appointment({
      schedule: { type: 'weekly', weekday: 4, fromWeek: WEEK, untilWeek: '2026-10-08' },
    })

    expect(occurrencesInWeek([weekly], '2026-09-17')).toHaveLength(0)
    expect(occurrencesInWeek([weekly], WEEK)).toHaveLength(1)
    expect(occurrencesInWeek([weekly], '2026-10-01')).toHaveLength(1)
    expect(occurrencesInWeek([weekly], '2026-10-08')).toHaveLength(0)
  })

  it('이 주만 바꾼 회차는 그 주의 날짜 · 시각 · 길이 · 보스 · 알림으로 선다', () => {
    const jupiter = { bossKey: 'jupiter', difficulty: 'normal', ocid: 'ocid-2' }
    const weekly = appointment({
      schedule: { type: 'weekly', weekday: 0, fromWeek: '2026-09-17', untilWeek: null },
      exceptions: {
        [WEEK]: {
          type: 'override',
          dateKey: '2026-09-26',
          timeKst: '22:30',
          durationMinutes: 60,
          bosses: [jupiter],
          leadMinutes: 30,
        },
      },
    })

    const [one] = occurrencesInWeek([weekly], WEEK)

    expect(one.dateKey).toBe('2026-09-26')
    expect(one.timeKst).toBe('22:30')
    expect(one.endsAt.toISOString()).toBe('2026-09-26T14:30:00.000Z')
    expect(one.bosses).toEqual([jupiter])
    expect(one.leadMinutes).toBe(30)
    expect(one.overridden).toBe(true)
    // 다음 주는 원래 약속 그대로다.
    const [next] = occurrencesInWeek([weekly], '2026-10-01')
    expect(next.timeKst).toBe('21:00')
    expect(next.overridden).toBe(false)
  })

  it('끝나는 순간은 시작에 길이를 더한 것이다', () => {
    const [one] = occurrencesInWeek([appointment({ durationMinutes: 45 })], WEEK)

    expect(one.startsAt.toISOString()).toBe('2026-09-30T12:00:00.000Z')
    expect(one.endsAt.toISOString()).toBe('2026-09-30T12:45:00.000Z')
  })

  it('자정을 넘는 약속은 시작 날짜의 주에 선다', () => {
    const crossing = appointment({
      timeKst: '23:30',
      durationMinutes: 60,
      schedule: { type: 'once', dateKey: '2026-09-30' },
    })

    const [one] = occurrencesInWeek([crossing], WEEK)

    expect(one.dateKey).toBe('2026-09-30')
    expect(one.endsAt.toISOString()).toBe('2026-09-30T15:30:00.000Z')
    expect(occurrencesInWeek([crossing], '2026-10-01')).toHaveLength(0)
  })

  it('날짜와 시각 순으로 정렬한다', () => {
    const late = appointment({ id: 'late', timeKst: '23:00', schedule: { type: 'once', dateKey: '2026-09-30' } })
    const early = appointment({ id: 'early', timeKst: '21:30', schedule: { type: 'once', dateKey: '2026-09-30' } })
    const thursday = appointment({ id: 'thu', timeKst: '22:00', schedule: { type: 'once', dateKey: '2026-09-24' } })

    expect(occurrencesInWeek([late, early, thursday], WEEK).map((one) => one.appointment.id)).toEqual([
      'thu',
      'early',
      'late',
    ])
  })
})
