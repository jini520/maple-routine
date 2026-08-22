// 격자를 만드는 규칙을 **입출력으로** 못 박는다([[ADR-169]] 결정 7). 이것이 화면 안에 있으면
// «어느 규칙이 이 배치를 만들었나» 를 화면을 띄워야만 볼 수 있다([[ADR-147]] 결정 8 과 같은 태도).

import {
  HEAT_LEVELS,
  WEEKDAY_LABELS,
  buildCalendarMonth,
  formatDayLabel,
  formatMonthLabel,
  getAdjacentMonthKey,
  getCurrentMonthKey,
  heatLevel,
  monthKeyOf,
} from '../calendar-month'

describe('getCurrentMonthKey — KST 기준', () => {
  it('지금이 속한 달을 YYYY-MM 으로 준다', () => {
    expect(getCurrentMonthKey(new Date('2026-08-23T05:00:00Z'))).toBe('2026-08')
  })

  // 기기 로컬 타임존이 아니라 KST 다 — UTC 로 8/31 15:00 은 KST 로 이미 9/1 이다.
  it('UTC 로는 아직 8월이어도 KST 로 9월이면 9월이다', () => {
    expect(getCurrentMonthKey(new Date('2026-08-31T15:00:00Z'))).toBe('2026-09')
  })

  it('KST 로 아직 8월이면 8월이다 — 경계 1분 전', () => {
    expect(getCurrentMonthKey(new Date('2026-08-31T14:59:00Z'))).toBe('2026-08')
  })
})

describe('monthKeyOf', () => {
  it('날짜 키에서 달을 떼어낸다', () => {
    expect(monthKeyOf('2026-08-23')).toBe('2026-08')
    expect(monthKeyOf('2026-01-01')).toBe('2026-01')
  })
})

describe('getAdjacentMonthKey — 해를 넘긴다', () => {
  it('한 달 뒤·앞', () => {
    expect(getAdjacentMonthKey('2026-08', 1)).toBe('2026-09')
    expect(getAdjacentMonthKey('2026-08', -1)).toBe('2026-07')
  })

  it('12월 다음은 이듬해 1월', () => {
    expect(getAdjacentMonthKey('2026-12', 1)).toBe('2027-01')
  })

  it('1월 앞은 지난해 12월', () => {
    expect(getAdjacentMonthKey('2026-01', -1)).toBe('2025-12')
  })
})

describe('formatMonthLabel', () => {
  it('«2026년 8월» — 0 을 채우지 않는다', () => {
    expect(formatMonthLabel('2026-08')).toBe('2026년 8월')
    expect(formatMonthLabel('2026-12')).toBe('2026년 12월')
  })
})

describe('formatDayLabel', () => {
  it('«8월 23일 (일)» — 요일까지 붙는다', () => {
    expect(formatDayLabel('2026-08-23')).toBe('8월 23일 (일)')
  })

  it('요일은 실제 달력과 맞는다', () => {
    expect(formatDayLabel('2026-08-27')).toBe('8월 27일 (목)')
    expect(formatDayLabel('2026-01-01')).toBe('1월 1일 (목)')
  })
})

describe('WEEKDAY_LABELS', () => {
  // [[ADR-169]] 결정 8 — 게임의 목요일 리셋과 무관하다. 이 격자는 한국 달력이다.
  it('일요일에서 시작하는 일곱', () => {
    expect(WEEKDAY_LABELS).toEqual(['일', '월', '화', '수', '목', '금', '토'])
  })
})

describe('buildCalendarMonth — 격자', () => {
  it('모든 주가 정확히 일곱 칸이다', () => {
    for (const monthKey of ['2026-08', '2026-02', '2027-02', '2026-11']) {
      for (const week of buildCalendarMonth(monthKey)) {
        expect(week).toHaveLength(7)
      }
    }
  })

  // 결정 7 — 빈 View 로 두면 6주째가 통째로 비는 달에서 격자 높이가 달라진다.
  it('달 경계의 빈칸을 앞뒤 달 날짜로 채운다 — 빈 칸이 없다', () => {
    for (const week of buildCalendarMonth('2026-08')) {
      for (const day of week) {
        expect(day.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  it('첫 칸은 일요일, 마지막 칸은 토요일이다', () => {
    const weeks = buildCalendarMonth('2026-08')
    const first = weeks[0]?.[0]
    const last = weeks[weeks.length - 1]?.[6]

    expect(formatDayLabel(first?.dateKey ?? '')).toContain('(일)')
    expect(formatDayLabel(last?.dateKey ?? '')).toContain('(토)')
  })

  it('2026-08 은 6주다 — 1일이 토요일이라 첫 주가 앞달로 여섯 칸 채워진다', () => {
    const weeks = buildCalendarMonth('2026-08')

    expect(weeks).toHaveLength(6)
    expect(weeks[0]?.[6]).toEqual({ dateKey: '2026-08-01', day: 1, inMonth: true })
    expect(weeks[0]?.[0]).toEqual({ dateKey: '2026-07-26', day: 26, inMonth: false })
  })

  it('그 달의 날짜만 inMonth 다 — 8월은 정확히 31칸', () => {
    const inMonth = buildCalendarMonth('2026-08')
      .flat()
      .filter((day) => day.inMonth)

    expect(inMonth).toHaveLength(31)
    expect(inMonth[0]?.dateKey).toBe('2026-08-01')
    expect(inMonth[30]?.dateKey).toBe('2026-08-31')
  })

  it('윤년 2월은 29칸, 평년은 28칸', () => {
    const leap = buildCalendarMonth('2028-02').flat().filter((day) => day.inMonth)
    const common = buildCalendarMonth('2026-02').flat().filter((day) => day.inMonth)

    expect(leap).toHaveLength(29)
    expect(common).toHaveLength(28)
  })

  // 날짜 키가 하루씩 이어져야 한다 — 달 경계에서 건너뛰거나 겹치면 표식이 엉뚱한 칸에 붙는다.
  it('칸이 하루씩 끊김 없이 이어진다', () => {
    const days = buildCalendarMonth('2026-12').flat()

    for (let index = 1; index < days.length; index += 1) {
      const previous = Date.parse(`${days[index - 1]?.dateKey}T00:00:00Z`)
      const current = Date.parse(`${days[index]?.dateKey}T00:00:00Z`)
      expect(current - previous).toBe(24 * 60 * 60 * 1000)
    }
  })

  it('day 는 dateKey 의 일(日)과 같다', () => {
    for (const day of buildCalendarMonth('2027-01').flat()) {
      expect(day.day).toBe(Number(day.dateKey.slice(8)))
    }
  })
})

// [[ADR-169]] 정정 1 — 칸이 표식에서 **금액 두 줄 + 열지도**로 바뀌었다.
describe('heatLevel — 그 달 안에서 상대적이다', () => {
  it('가장 큰 날이 최고 단계다', () => {
    expect(heatLevel(100, 100)).toBe(HEAT_LEVELS)
  })

  it('비율이 단계를 정한다', () => {
    expect(heatLevel(25, 100)).toBe(1)
    expect(heatLevel(50, 100)).toBe(2)
    expect(heatLevel(75, 100)).toBe(3)
  })

  // 1 메소라도 있으면 칠해져야 «적은 날» 과 «안 적은 날» 이 갈린다.
  it('아주 작은 값도 0 이 아니라 1 이다', () => {
    expect(heatLevel(1, 1_000_000_000)).toBe(1)
  })

  it('0 과 음수는 안 칠한다', () => {
    expect(heatLevel(0, 100)).toBe(0)
    expect(heatLevel(-5, 100)).toBe(0)
  })

  // 기록이 하나도 없는 달 — 나누기가 0 으로 떨어지면 NaN 이 칸마다 실린다.
  it('그 달이 통째로 비어 있어도 0 이다', () => {
    expect(heatLevel(0, 0)).toBe(0)
    expect(heatLevel(10, 0)).toBe(0)
  })

  it('단계는 상한을 넘지 않는다', () => {
    expect(heatLevel(500, 100)).toBe(HEAT_LEVELS)
  })
})
