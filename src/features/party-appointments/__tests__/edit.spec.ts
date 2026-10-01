import { applyDelete, applyEdit, draftFromOccurrence, isPastWeek } from '../edit'
import { occurrencesInWeek } from '../occurrences'
import type { AppointmentDraft } from '../draft'
import type { PartyAppointment } from '../../../types/party-appointment'

const LIMBO = { bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }
const JUPITER = { bossKey: 'jupiter', difficulty: 'normal', ocid: 'ocid-2' }

function appointment(overrides: Partial<PartyAppointment>): PartyAppointment {
  return {
    id: 'a1',
    bosses: [LIMBO],
    members: [],
    timeKst: '21:00',
    durationMinutes: 30,
    leadMinutes: 10,
    schedule: { type: 'weekly', weekday: 4, fromWeek: '2026-09-17', untilWeek: null },
    exceptions: {},
    ...overrides,
  }
}

// 2026-10-01 은 목요일이고 그 리셋 주의 시작이다.
const WEEK = '2026-10-01'

function draft(overrides: Partial<AppointmentDraft>): AppointmentDraft {
  return {
    startDateKey: '2026-10-01',
    startMinutes: 22 * 60,
    endDateKey: '2026-10-01',
    endMinutes: 23 * 60,
    bosses: [JUPITER],
    alarmOn: false,
    leadMinutes: 10,
    repeats: true,
    ...overrides,
  }
}

describe('isPastWeek', () => {
  it('오늘이 든 주보다 앞인 주만 지난 주다', () => {
    expect(isPastWeek('2026-09-24', '2026-10-02')).toBe(true)
    expect(isPastWeek('2026-10-01', '2026-10-02')).toBe(false)
    expect(isPastWeek('2026-10-08', '2026-10-02')).toBe(false)
  })
})

describe('draftFromOccurrence', () => {
  it('회차의 시작 · 종료 · 보스 · 알림 · 반복으로 채운다', () => {
    const [occurrence] = occurrencesInWeek([appointment({ timeKst: '23:30', durationMinutes: 60 })], WEEK)

    expect(draftFromOccurrence(occurrence!)).toEqual({
      startDateKey: '2026-10-01',
      startMinutes: 23 * 60 + 30,
      endDateKey: '2026-10-02',
      endMinutes: 30,
      bosses: [LIMBO],
      alarmOn: true,
      leadMinutes: 10,
      repeats: true,
    })
  })

  it('알림이 없던 회차는 꺼진 채 기본 10분 전을 들고 있다', () => {
    const [occurrence] = occurrencesInWeek([appointment({ leadMinutes: null })], WEEK)

    expect(draftFromOccurrence(occurrence!)).toMatchObject({ alarmOn: false, leadMinutes: 10 })
  })
})

describe('applyEdit', () => {
  it('한 번뿐인 약속은 같은 id 로 덮는다', () => {
    const once = appointment({ schedule: { type: 'once', dateKey: '2026-10-01' } })

    const result = applyEdit([once], once, WEEK, draft({ repeats: false }), { thisWeekOnly: false, newId: 'x' })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'a1',
      timeKst: '22:00',
      durationMinutes: 60,
      bosses: [JUPITER],
      leadMinutes: null,
      schedule: { type: 'once', dateKey: '2026-10-01' },
    })
  })

  it('이 주만 적용하면 그 주의 예외로 약속 전체를 적는다', () => {
    const weekly = appointment({})

    const [result] = applyEdit([weekly], weekly, WEEK, draft({ alarmOn: true, leadMinutes: 30 }), {
      thisWeekOnly: true,
      newId: 'x',
    })

    expect(result!.timeKst).toBe('21:00')
    expect(result!.exceptions[WEEK]).toEqual({
      type: 'override',
      dateKey: '2026-10-01',
      timeKst: '22:00',
      durationMinutes: 60,
      bosses: [JUPITER],
      leadMinutes: 30,
    })
  })

  it('앞으로 모두: 지난 주부터 이어 온 반복은 이 주 전까지로 끝내고 새 약속을 연다', () => {
    const weekly = appointment({
      exceptions: {
        '2026-09-24': {
          type: 'override',
          dateKey: '2026-09-24',
          timeKst: '20:00',
          durationMinutes: 30,
          bosses: [LIMBO],
          leadMinutes: null,
        },
      },
    })

    const result = applyEdit([weekly], weekly, WEEK, draft({}), { thisWeekOnly: false, newId: 'new' })

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ id: 'a1', schedule: { untilWeek: WEEK } })
    // 지난 주의 예외는 옛 약속에 그대로 남는다.
    expect(result[0]!.exceptions['2026-09-24']).toBeDefined()
    expect(result[1]).toMatchObject({
      id: 'new',
      timeKst: '22:00',
      bosses: [JUPITER],
      schedule: { type: 'weekly', weekday: 4, fromWeek: WEEK, untilWeek: null },
      exceptions: {},
    })
  })

  it('앞으로 모두: 이 주에 시작한 반복은 같은 id 로 덮고 옛 예외를 버린다', () => {
    const weekly = appointment({
      schedule: { type: 'weekly', weekday: 4, fromWeek: WEEK, untilWeek: null },
      exceptions: {
        '2026-10-08': {
          type: 'override',
          dateKey: '2026-10-08',
          timeKst: '20:00',
          durationMinutes: 30,
          bosses: [LIMBO],
          leadMinutes: null,
        },
      },
    })

    const result = applyEdit([weekly], weekly, WEEK, draft({}), { thisWeekOnly: false, newId: 'new' })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'a1', timeKst: '22:00', exceptions: {} })
  })

  it('앞으로 모두에서 반복을 끄면 그 날짜 한 번뿐인 약속이 된다', () => {
    const weekly = appointment({})

    const result = applyEdit([weekly], weekly, WEEK, draft({ repeats: false }), { thisWeekOnly: false, newId: 'new' })

    expect(result[1]).toMatchObject({ id: 'new', schedule: { type: 'once', dateKey: '2026-10-01' } })
  })

  it('다른 약속은 건드리지 않는다', () => {
    const other = appointment({ id: 'other' })
    const weekly = appointment({})

    const result = applyEdit([other, weekly], weekly, WEEK, draft({}), { thisWeekOnly: true, newId: 'x' })

    expect(result[0]).toBe(other)
  })
})

describe('applyDelete', () => {
  it('한 번뿐인 약속은 지운다', () => {
    const once = appointment({ schedule: { type: 'once', dateKey: '2026-10-01' } })

    expect(applyDelete([once], once, WEEK)).toEqual([])
  })

  it('지난 주부터 이어 온 반복은 이 주 전까지로 끝낸다', () => {
    const weekly = appointment({})

    expect(applyDelete([weekly], weekly, WEEK)).toEqual([
      { ...weekly, schedule: { ...weekly.schedule, untilWeek: WEEK } },
    ])
  })

  it('이 주에 시작한 반복은 통째로 지운다', () => {
    const weekly = appointment({ schedule: { type: 'weekly', weekday: 4, fromWeek: WEEK, untilWeek: null } })

    expect(applyDelete([weekly], weekly, WEEK)).toEqual([])
  })
})
