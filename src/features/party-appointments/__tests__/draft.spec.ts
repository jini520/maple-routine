import {
  canSave,
  durationOf,
  endsNextDay,
  formatClock,
  formatLead,
  RESET_WEEKDAYS,
  dateInWeek,
  initialDraft,
  nextOccurrenceDateKey,
  moveItem,
  shiftMinutes,
  toAppointment,
  withStart,
  type AppointmentDraft,
} from '../draft'

const LIMBO = { bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }

function draft(overrides: Partial<AppointmentDraft>): AppointmentDraft {
  return {
    startDateKey: '2026-10-01',
    startMinutes: 21 * 60,
    endMinutes: 21 * 60 + 30,
    bosses: [LIMBO],
    alarmOn: false,
    leadMinutes: 10,
    repeats: false,
    ...overrides,
  }
}

describe('initialDraft', () => {
  it('시작은 지금에서 가장 가까운 다음 정각이고 종료는 그 30분 뒤다', () => {
    // KST 2026-10-01 21:04
    const result = initialDraft(new Date('2026-10-01T12:04:00Z'))

    expect(result).toMatchObject({
      startDateKey: '2026-10-01',
      startMinutes: 22 * 60,
      endMinutes: 22 * 60 + 30,
      bosses: [],
      alarmOn: false,
      leadMinutes: 10,
      repeats: false,
    })
  })

  it('지금이 정각이면 그 시각이다', () => {
    // KST 2026-10-01 21:00
    expect(initialDraft(new Date('2026-10-01T12:00:00Z')).startMinutes).toBe(21 * 60)
  })

  // 한 번 · 반복은 ＋ 의 갈래에서 고른다. 시트에는 그것을 바꾸는 칸이 없다.
  it('반복 갈래로 열면 반복 약속이다', () => {
    expect(initialDraft(new Date('2026-10-01T12:04:00Z'), true).repeats).toBe(true)
    expect(initialDraft(new Date('2026-10-01T12:04:00Z'), false).repeats).toBe(false)
  })

  it('23시대에 열면 다음 날 00:00 이다', () => {
    // KST 2026-10-01 23:10
    const result = initialDraft(new Date('2026-10-01T14:10:00Z'))

    expect(result).toMatchObject({ startDateKey: '2026-10-02', startMinutes: 0, endMinutes: 30 })
  })
})

// 시작 시각을 바꾸면 종료는 늘 시작 + 30분으로 다시 선다(사용자 결정).
describe('withStart', () => {
  it('종료를 시작 + 30분으로 옮긴다', () => {
    const result = withStart(draft({ endMinutes: 23 * 60 }), '2026-10-02', 19 * 60)

    expect(result).toMatchObject({ startDateKey: '2026-10-02', startMinutes: 19 * 60, endMinutes: 19 * 60 + 30 })
  })

  it('시작이 23:30 이후면 종료가 자정을 넘는다', () => {
    const result = withStart(draft({}), '2026-10-01', 23 * 60 + 45)

    expect(result.endMinutes).toBe(15)
    expect(endsNextDay(result)).toBe(true)
  })
})

describe('shiftMinutes', () => {
  it('하루를 넘으면 날짜를 옮긴다', () => {
    expect(shiftMinutes('2026-10-01', 23 * 60 + 30, 60)).toEqual({ dateKey: '2026-10-02', minutes: 30 })
    expect(shiftMinutes('2026-10-01', 10, -20)).toEqual({ dateKey: '2026-09-30', minutes: 23 * 60 + 50 })
  })
})

describe('durationOf', () => {
  it('같은 날 끝나면 시작부터 종료까지의 분이다', () => {
    expect(durationOf(draft({}))).toBe(30)
  })

  it('종료가 시작보다 이르면 다음 날로 센다', () => {
    expect(durationOf(draft({ startMinutes: 23 * 60 + 30, endMinutes: 30 }))).toBe(60)
    expect(durationOf(draft({ startMinutes: 22 * 60 }))).toBe(23 * 60 + 30)
  })

  it('종료가 시작과 같으면 0 이다', () => {
    expect(durationOf(draft({ endMinutes: 21 * 60 }))).toBe(0)
  })
})

describe('endsNextDay', () => {
  it('종료가 시작보다 이를 때만 다음 날이다', () => {
    expect(endsNextDay(draft({ startMinutes: 23 * 60 + 30, endMinutes: 30 }))).toBe(true)
    expect(endsNextDay(draft({}))).toBe(false)
    expect(endsNextDay(draft({ endMinutes: 21 * 60 }))).toBe(false)
  })
})

describe('canSave', () => {
  it('보스가 있고 종료가 시작보다 늦으면 저장할 수 있다', () => {
    expect(canSave(draft({}))).toBe(true)
  })

  it('보스가 없으면 못 한다', () => {
    expect(canSave(draft({ bosses: [] }))).toBe(false)
  })

  it('종료가 시작과 같으면 못 한다. 이른 종료는 다음 날이라 된다', () => {
    expect(canSave(draft({ endMinutes: 21 * 60 }))).toBe(false)
    expect(canSave(draft({ endMinutes: 20 * 60 }))).toBe(true)
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
    const result = toAppointment(draft({ startDateKey: '2026-09-30', repeats: true }), 'id-2')

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

// 반복 약속은 날짜가 아니라 요일을 고른다. 시트는 요일에서 첫 회차 날짜를 낸다.
describe('nextOccurrenceDateKey', () => {
  // KST 2026-10-02(금) 21:04
  const now = new Date('2026-10-02T12:04:00Z')

  it('이번 주 그 요일이 아직이면 이번 주다', () => {
    expect(nextOccurrenceDateKey(3, 21 * 60, now)).toBe('2026-10-07')
  })

  it('이번 주에 이미 지났으면 다음 주다', () => {
    expect(nextOccurrenceDateKey(4, 21 * 60, now)).toBe('2026-10-08')
  })

  it('오늘이고 시작이 아직이면 오늘이다', () => {
    expect(nextOccurrenceDateKey(5, 22 * 60, now)).toBe('2026-10-02')
  })

  it('오늘이고 시작이 지났으면 다음 주다', () => {
    expect(nextOccurrenceDateKey(5, 21 * 60, now)).toBe('2026-10-09')
  })
})

describe('dateInWeek', () => {
  it('리셋 주(목요일 시작) 안의 그 요일 날짜다', () => {
    expect(dateInWeek('2026-10-01', 4)).toBe('2026-10-01')
    expect(dateInWeek('2026-10-01', 0)).toBe('2026-10-04')
    expect(dateInWeek('2026-10-01', 3)).toBe('2026-10-07')
  })
})

describe('RESET_WEEKDAYS', () => {
  it('목요일부터 수요일까지다', () => {
    expect(RESET_WEEKDAYS).toEqual([4, 5, 6, 0, 1, 2, 3])
  })
})
