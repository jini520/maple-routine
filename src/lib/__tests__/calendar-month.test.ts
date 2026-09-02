// 격자를 만드는 규칙을 **입출력으로** 못 박는다([[ADR-169]] 결정 7). 이것이 화면 안에 있으면
// «어느 규칙이 이 배치를 만들었나» 를 화면을 띄워야만 볼 수 있다([[ADR-147]] 결정 8 과 같은 태도).

import {
  HEAT_LEVELS,
  WEEKDAY_LABELS,
  buildCalendarMonth,
  formatDayLabel,
  shiftDateKey,
  getAdjacentMonthKey,
  getCurrentMonthKey,
  heatLevel,
  monthKeyOf,
  periodTotals,
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
    expect(weeks[0]?.[6]).toEqual({ dateKey: '2026-08-01', day: 1, inPeriod: true })
    expect(weeks[0]?.[0]).toEqual({ dateKey: '2026-07-26', day: 26, inPeriod: false })
  })

  it('그 달의 날짜만 inPeriod 다 — 8월은 정확히 31칸', () => {
    const inPeriod = buildCalendarMonth('2026-08')
      .flat()
      .filter((day) => day.inPeriod)

    expect(inPeriod).toHaveLength(31)
    expect(inPeriod[0]?.dateKey).toBe('2026-08-01')
    expect(inPeriod[30]?.dateKey).toBe('2026-08-31')
  })

  it('윤년 2월은 29칸, 평년은 28칸', () => {
    const leap = buildCalendarMonth('2028-02').flat().filter((day) => day.inPeriod)
    const common = buildCalendarMonth('2026-02').flat().filter((day) => day.inPeriod)

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

// ══ 주간 격자 — 목요일 리셋 주 ([[ADR-170]] 결정 10·11) ══════════════════════════
//
// **이 앱에는 「주」가 둘이다.** 월간 격자의 주는 일요일에 시작하고([[ADR-169]] 결정 8) 주간 보기의
// 주는 목요일에 시작한다 — 후자는 게임의 주이고 보스 수익 탭이 이미 그 축을 쓴다.

describe('WEEKDAY_LABELS_RESET', () => {
  it('목요일에서 시작한다', () => {
    const { WEEKDAY_LABELS_RESET } = require('../calendar-month') as typeof import('../calendar-month')

    expect(WEEKDAY_LABELS_RESET).toEqual(['목', '금', '토', '일', '월', '화', '수'])
  })

  // 회전이라 두 목록의 원소가 같다 — 한쪽만 고치면 요일 이름이 갈린다.
  it('월간 라벨을 회전한 것이다 — 새로 적지 않는다', () => {
    const { WEEKDAY_LABELS, WEEKDAY_LABELS_RESET } =
      require('../calendar-month') as typeof import('../calendar-month')

    expect([...WEEKDAY_LABELS_RESET].sort()).toEqual([...WEEKDAY_LABELS].sort())
  })
})

describe('resetWeekStartOf', () => {
  const { resetWeekStartOf } = require('../calendar-month') as typeof import('../calendar-month')

  it('목요일은 그 자신이 주의 시작이다', () => {
    expect(resetWeekStartOf('2026-08-20')).toBe('2026-08-20')
  })

  it('주 안의 어느 날을 줘도 그 주의 목요일로 내려간다', () => {
    // 2026-08-20 은 목요일이고 그 주는 8/20~8/26 이다.
    expect(resetWeekStartOf('2026-08-21')).toBe('2026-08-20')
    expect(resetWeekStartOf('2026-08-23')).toBe('2026-08-20')
    expect(resetWeekStartOf('2026-08-26')).toBe('2026-08-20')
  })

  it('목요일 하루 전은 이전 주다', () => {
    expect(resetWeekStartOf('2026-08-19')).toBe('2026-08-13')
  })

  it('달을 거슬러 올라간다', () => {
    // 2026-09-02 는 수요일이고 그 주의 목요일은 8/27 이다.
    expect(resetWeekStartOf('2026-09-02')).toBe('2026-08-27')
  })

  // **두 번째 구현이 생기는 자리다.** 보스 수익이 이미 «게임의 주» 를 계산하므로, 두 값이 갈리면
  // 같은 주가 두 화면에서 다른 날짜로 시작한다 — 그것이 목요일 주를 고른 이유를 통째로 무효화한다.
  it('보스 수익의 주간 periodKey 와 같은 답을 낸다', () => {
    const { getCurrentBossProfitPeriod } =
      require('../boss/boss-profit-period') as typeof import('../boss/boss-profit-period')
    const { getCurrentKstDateKey } = require('../scheduler/reset-clock') as typeof import('../scheduler/reset-clock')

    // KST 정오로 스무 날을 훑는다 — 리셋 경계(KST 00:00)를 넘나드는 시각은 reset-clock 의 몫이라
    // 여기서 다시 재지 않는다.
    for (let offset = 0; offset < 20; offset += 1) {
      const noonKst = new Date(Date.UTC(2026, 7, 10 + offset, 3, 0, 0))
      expect(resetWeekStartOf(getCurrentKstDateKey(noonKst))).toBe(
        getCurrentBossProfitPeriod('weekly', noonKst).periodKey,
      )
    }
  })
})

describe('buildResetWeek', () => {
  const { buildResetWeek } = require('../calendar-month') as typeof import('../calendar-month')

  it('딱 이레다 — 목요일부터 수요일까지', () => {
    const week = buildResetWeek('2026-08-20')

    expect(week).toHaveLength(7)
    expect(week[0].dateKey).toBe('2026-08-20')
    expect(week[6].dateKey).toBe('2026-08-26')
  })

  it('이레가 하루씩 이어진다', () => {
    const week = buildResetWeek('2026-08-20')

    expect(week.map((day) => day.dateKey)).toEqual([
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
    ])
  })

  // 월간 격자와 갈리는 자리 — 거기서는 앞뒤 달 칸이 `inPeriod: false` 로 흐려지는데, 주간에는
  // «앞뒤 달» 이라는 것이 없다. **이레가 전부 그 주다**([[ADR-170]] 결정 11).
  it('달을 걸쳐도 이레가 전부 그 기간에 든다', () => {
    const week = buildResetWeek('2026-08-27')

    expect(week.map((day) => day.dateKey)).toEqual([
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ])
    expect(week.every((day) => day.inPeriod)).toBe(true)
  })

  it('날짜 숫자는 달이 바뀌면 1 로 돌아간다', () => {
    expect(buildResetWeek('2026-08-27').map((day) => day.day)).toEqual([27, 28, 29, 30, 31, 1, 2])
  })
})


/**
 * 하루 단위로 옮긴 날짜 열쇠 — 수입 시트가 머리에서 날짜를 바꿀 때 쓴다([[ADR-178]] 정정 6).
 *
 * UTC 로 세는 것은 `formatDayLabel` 과 같은 이유다 — 기기 표준시로 세면 자정 언저리에서 하루가
 * 밀린다.
 */
describe('shiftDateKey', () => {
  it('하루 앞뒤로 옮긴다', () => {
    expect(shiftDateKey('2026-08-23', 1)).toBe('2026-08-24')
    expect(shiftDateKey('2026-08-23', -1)).toBe('2026-08-22')
    expect(shiftDateKey('2026-08-23', 0)).toBe('2026-08-23')
  })

  it('달 경계를 넘는다', () => {
    expect(shiftDateKey('2026-08-31', 1)).toBe('2026-09-01')
    expect(shiftDateKey('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('해 경계를 넘는다', () => {
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDateKey('2027-01-01', -1)).toBe('2026-12-31')
  })

  // 2028 은 윤년이다 — 2월이 29일까지다.
  it('윤년의 2월을 안다', () => {
    expect(shiftDateKey('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDateKey('2027-02-28', 1)).toBe('2027-03-01')
  })
})

/**
 * 보고 있는 기간의 합계 — 격자 위에 서는 세 칸이 이것을 읽는다([[ADR-184]]).
 *
 * **기준이 `monthIncomeMax` 와 같은 `inPeriod`** 다. 월간 격자는 앞뒤 달 날짜로 빈칸을 채우므로
 * (`buildCalendarMonth`) 그 칸을 세면 「8월」 합계에 7월 말·9월 초가 섞인다.
 */
describe('periodTotals — 격자가 그린 칸을 그대로 접는다', () => {
  const { buildResetWeek } = require('../calendar-month') as typeof import('../calendar-month')

  it('그 기간 칸만 더한다 — 앞뒤 달로 채운 칸은 안 든다', () => {
    const weeks = buildCalendarMonth('2026-08')
    // 8/1(토)은 첫 주의 마지막 칸이고, 7/26~7/31 이 그 앞을 채운다.
    const totals = periodTotals(weeks, {
      '2026-07-31': { incomeMeso: 500, expenseMeso: 500 },
      '2026-08-01': { incomeMeso: 100, expenseMeso: 30 },
      '2026-08-15': { incomeMeso: 200, expenseMeso: 70 },
      '2026-09-01': { incomeMeso: 900, expenseMeso: 900 },
    })

    expect(totals).toEqual({ incomeMeso: 300, expenseMeso: 100 })
  })

  it('주간 격자는 이레가 전부 든다 — 달을 걸쳐도 같다', () => {
    // 8/27(목) 주는 9/2(수)까지 간다([[ADR-170]] 정정 1 — 이레는 전부 `inPeriod` 다).
    const totals = periodTotals([buildResetWeek('2026-08-27')], {
      '2026-08-27': { incomeMeso: 10, expenseMeso: 1 },
      '2026-09-02': { incomeMeso: 20, expenseMeso: 2 },
      '2026-09-03': { incomeMeso: 999, expenseMeso: 999 },
    })

    expect(totals).toEqual({ incomeMeso: 30, expenseMeso: 3 })
  })

  it('기록이 없는 기간은 0 이다 — `undefined` 가 새어 나가면 안 된다', () => {
    expect(periodTotals(buildCalendarMonth('2026-08'), {})).toEqual({
      incomeMeso: 0,
      expenseMeso: 0,
    })
  })
})
