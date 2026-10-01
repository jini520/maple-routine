import {
  canSave,
  durationOf,
  formatClock,
  formatLead,
  initialDraft,
  moveItem,
  shiftMinutes,
  toAppointment,
  type AppointmentDraft,
} from '../draft'

const LIMBO = { bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }

function draft(overrides: Partial<AppointmentDraft>): AppointmentDraft {
  return {
    startDateKey: '2026-10-01',
    startMinutes: 21 * 60,
    endDateKey: '2026-10-01',
    endMinutes: 21 * 60 + 30,
    bosses: [LIMBO],
    alarmOn: false,
    leadMinutes: 10,
    repeats: false,
    ...overrides,
  }
}

describe('initialDraft', () => {
  it('시작은 지금 이후 첫 5분 칸이고 종료는 그 30분 뒤다', () => {
    // KST 2026-10-01 21:04
    const result = initialDraft(new Date('2026-10-01T12:04:00Z'))

    expect(result).toMatchObject({
      startDateKey: '2026-10-01',
      startMinutes: 21 * 60 + 5,
      endDateKey: '2026-10-01',
      endMinutes: 21 * 60 + 35,
      bosses: [],
      alarmOn: false,
      leadMinutes: 10,
      repeats: false,
    })
  })

  it('딱 5분 칸이면 다음 칸으로 간다', () => {
    const result = initialDraft(new Date('2026-10-01T12:05:00Z'))

    expect(result.startMinutes).toBe(21 * 60 + 10)
  })

  it('자정 직전에 열면 시작과 종료가 다음 날로 넘어간다', () => {
    // KST 2026-10-01 23:58
    const result = initialDraft(new Date('2026-10-01T14:58:00Z'))

    expect(result).toMatchObject({
      startDateKey: '2026-10-02',
      startMinutes: 0,
      endDateKey: '2026-10-02',
      endMinutes: 30,
    })
  })

  it('종료만 자정을 넘으면 종료 날짜만 다음 날이다', () => {
    // KST 2026-10-01 23:40
    const result = initialDraft(new Date('2026-10-01T14:40:00Z'))

    expect(result).toMatchObject({
      startDateKey: '2026-10-01',
      startMinutes: 23 * 60 + 45,
      endDateKey: '2026-10-02',
      endMinutes: 15,
    })
  })
})

describe('shiftMinutes', () => {
  it('하루를 넘으면 날짜를 옮긴다', () => {
    expect(shiftMinutes('2026-10-01', 23 * 60 + 30, 60)).toEqual({ dateKey: '2026-10-02', minutes: 30 })
    expect(shiftMinutes('2026-10-01', 10, -20)).toEqual({ dateKey: '2026-09-30', minutes: 23 * 60 + 50 })
  })
})

describe('durationOf', () => {
  it('종료가 다음 날이어도 분으로 센다', () => {
    expect(durationOf(draft({ startMinutes: 23 * 60 + 30, endDateKey: '2026-10-02', endMinutes: 30 }))).toBe(60)
  })

  it('종료가 시작보다 이르면 음수다', () => {
    expect(durationOf(draft({ startMinutes: 22 * 60 }))).toBe(-30)
  })
})

describe('canSave', () => {
  it('보스가 있고 종료가 시작보다 늦으면 저장할 수 있다', () => {
    expect(canSave(draft({}))).toBe(true)
  })

  it('보스가 없으면 못 한다', () => {
    expect(canSave(draft({ bosses: [] }))).toBe(false)
  })

  it('종료가 시작과 같거나 이르면 못 한다', () => {
    expect(canSave(draft({ endMinutes: 21 * 60 }))).toBe(false)
    expect(canSave(draft({ endMinutes: 20 * 60 }))).toBe(false)
  })
})

describe('toAppointment', () => {
  it('한 번뿐인 약속으로 바꾼다. 알림이 꺼져 있으면 leadMinutes 는 null 이다', () => {
    expect(toAppointment(draft({}), 'id-1')).toEqual({
      id: 'id-1',
      bosses: [LIMBO],
      members: [],
      timeKst: '21:00',
      durationMinutes: 30,
      leadMinutes: null,
      schedule: { type: 'once', dateKey: '2026-10-01' },
      exceptions: {},
    })
  })

  it('반복이면 시작 날짜의 요일과 그 리셋 주로 연다', () => {
    // 2026-09-30 은 수요일이고 그 리셋 주는 9/24(목)에서 시작한다.
    const result = toAppointment(draft({ startDateKey: '2026-09-30', endDateKey: '2026-09-30', repeats: true }), 'id-2')

    expect(result.schedule).toEqual({ type: 'weekly', weekday: 3, fromWeek: '2026-09-24', untilWeek: null })
  })

  it('알림이 켜져 있으면 고른 분을 적는다', () => {
    expect(toAppointment(draft({ alarmOn: true, leadMinutes: 75 }), 'id-3').leadMinutes).toBe(75)
  })
})

describe('formatClock', () => {
  it('분을 HH:mm 으로', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(21 * 60 + 5)).toBe('21:05')
  })
})

describe('formatLead', () => {
  it('0 은 정각이고 나머지는 시간 · 분 전이다', () => {
    expect(formatLead(0)).toBe('정각')
    expect(formatLead(10)).toBe('10분 전')
    expect(formatLead(60)).toBe('1시간 전')
    expect(formatLead(75)).toBe('1시간 15분 전')
  })
})

describe('moveItem', () => {
  it('한 칸을 다른 자리로 옮긴다', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })
})
