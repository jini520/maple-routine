// 월간 보스는 **한 달에 딱 한 주에만** 선다. 그 한 주를 고르는 규칙.
import { isMonthlyRowInWeek, monthsOfWeek, resolveUndatedWeek } from '../boss/monthly-boss-week'

// 2026-09 의 목요일: 09-03 · 09-10 · 09-17 · 09-24
const 이번주 = '2026-09-10'
const NOW = new Date('2026-09-14T12:00:00+09:00') // 2주차 한복판

const 구월_전주차 = ['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24']

function 물음(overrides: Partial<Parameters<typeof isMonthlyRowInWeek>[0]> = {}): boolean {
  return isMonthlyRowInWeek({
    weeklyPeriodKey: 이번주,
    monthlyPeriodKey: '2026-09',
    isComplete: false,
    defeatedOn: null,
    now: NOW,
    weeksWithRecords: 구월_전주차,
    ...overrides,
  })
}

describe('주가 품은 달이 아니면 아예 안 선다', () => {
  it('8월 보스는 8월 날이 없는 주에 안 선다', () => {
    expect(물음({ monthlyPeriodKey: '2026-08' })).toBe(false)
  })

  it('9월 보스는 9월 날이 없는 주에 안 선다', () => {
    expect(물음({ weeklyPeriodKey: '2026-08-20', isComplete: true, defeatedOn: '2026-09-01' })).toBe(false)
  })
})

// 게임의 월간 보스는 1일 00:00 에 열린다. 8/27 주(8/27~9/2)는 8월이면서 9월이라, 그 주가 9월
// 보스의 첫 자리다. 전에는 주가 속한 달을 목요일로 정해 **그 이틀에 잡은 기록이 어느 주에도
// 없었다**(사용자 물음: 왜 사라져?).
describe('달 경계 주는 두 달을 품는다', () => {
  it('9/1 · 9/2 에 잡은 9월 보스가 8/27 주에 선다', () => {
    expect(물음({ weeklyPeriodKey: '2026-08-27', isComplete: true, defeatedOn: '2026-09-01' })).toBe(true)
    expect(물음({ weeklyPeriodKey: '2026-08-27', isComplete: true, defeatedOn: '2026-09-02' })).toBe(true)
  })

  it('그 기록은 9월 첫 주차에는 안 선다', () => {
    expect(물음({ weeklyPeriodKey: '2026-09-03', isComplete: true, defeatedOn: '2026-09-01' })).toBe(false)
  })

  // 1일부터 자리가 있어야 한다. 그 날의 이번 주가 곧 8/27 주다.
  it('9/1 에 아직 안 잡은 9월 보스도 8/27 주에 선다', () => {
    expect(
      물음({
        weeklyPeriodKey: '2026-08-27',
        now: new Date('2026-09-01T12:00:00+09:00'),
        isComplete: false,
      }),
    ).toBe(true)
  })

  // 같은 주에 월간 행이 둘 선다. 둘 다 그 주에 실제로 일어난 일이다.
  it('8월 처치와 9월 처치가 같은 주에 함께 선다', () => {
    const 경계주 = (monthlyPeriodKey: string, defeatedOn: string): boolean =>
      물음({ weeklyPeriodKey: '2026-08-27', monthlyPeriodKey, isComplete: true, defeatedOn })

    expect(경계주('2026-08', '2026-08-28')).toBe(true)
    expect(경계주('2026-09', '2026-09-01')).toBe(true)
  })
})

describe('아직 안 잡았으면 이번 주에만', () => {
  it('이번 주에는 선다', () => {
    expect(물음()).toBe(true)
  })

  // 지난 주 기록에 미완료를 남기지 않는다(사용자 지정). 그 주에 할 일이 아니었던 것으로 굳는다.
  it('지난 주에는 안 선다', () => {
    expect(물음({ weeklyPeriodKey: '2026-09-03' })).toBe(false)
  })
})

describe('잡았으면 잡은 주에만', () => {
  it('그 주 안에 잡았으면 선다', () => {
    expect(물음({ isComplete: true, defeatedOn: '2026-09-12' })).toBe(true)
  })

  it('그 주의 첫날·마지막날도 그 주다', () => {
    expect(물음({ isComplete: true, defeatedOn: '2026-09-10' })).toBe(true)
    expect(물음({ isComplete: true, defeatedOn: '2026-09-16' })).toBe(true)
  })

  // 1주차에 잡았으면 2주차부터는 안 나온다.
  it('다른 주에 잡았으면 안 선다', () => {
    expect(물음({ isComplete: true, defeatedOn: '2026-09-05' })).toBe(false)
  })

  it('1주차를 다시 열면 거기 있다', () => {
    expect(
      물음({ weeklyPeriodKey: '2026-09-03', isComplete: true, defeatedOn: '2026-09-05' }),
    ).toBe(true)
  })
})

// `defeated_on` 은 그 달 앞 2주 안에 앱을 열었을 때만 채워진다. 못 채운 기록을 어느 주에도
// 안 놓으면 그 금액이 주간 화면에서 통째로 사라진다.
describe('잡은 날을 모르면 기록이 있는 가장 빠른 주차 (정정 3)', () => {
  it('그 주차에 선다', () => {
    const 주차 = resolveUndatedWeek('2026-09', NOW, 구월_전주차)

    expect(주차).toBe('2026-09-03')
    expect(물음({ isComplete: true, defeatedOn: null, weeklyPeriodKey: 주차 })).toBe(true)
  })

  it('다른 주차에는 안 선다', () => {
    const 다른주 = '2026-09-10'

    expect(물음({ isComplete: true, defeatedOn: null, weeklyPeriodKey: 다른주 })).toBe(false)
  })

  // 기록이 없는 주는 이전 기간 게이트에 막혀 열리지 않는다. 금액을 못 가는 자리에 두면 안 된다.
  it('앞 주차에 기록이 없으면 건너뛰고 있는 것 중 가장 빠른 주차로 간다', () => {
    expect(resolveUndatedWeek('2026-09', NOW, ['2026-09-17', '2026-09-10'])).toBe('2026-09-10')
  })

  // 그 달에 주간 기록이 하나도 없으면 어느 주도 안 열린다. 그때만 옛 규칙이 받는다.
  it('그 달에 기록이 하나도 없으면 오늘을 안 넘는 마지막 주차로 떨어진다', () => {
    expect(resolveUndatedWeek('2026-09', NOW, [])).toBe('2026-09-10')
  })

  it('그 달 밖의 주차는 안 센다', () => {
    expect(resolveUndatedWeek('2026-09', NOW, ['2026-08-27'])).toBe('2026-09-10')
  })
})

// 지난달에 이미 쌓인 기록이 이 규칙의 첫 손님이다. 그 기록들은 날짜가 없을 수 있다.
describe('지난달에 이미 쌓인 기록', () => {
  const 지금 = new Date('2026-09-25T12:00:00+09:00')

  it('날짜를 알면 그 주에 그대로 선다', () => {
    expect(
      isMonthlyRowInWeek({
        weeklyPeriodKey: '2026-08-13',
        monthlyPeriodKey: '2026-08',
        isComplete: true,
        defeatedOn: '2026-08-15',
        now: 지금,
        // 날짜를 알면 이 목록을 안 본다.
        weeksWithRecords: [],
      }),
    ).toBe(true)
  })

  // 실제 데이터가 이 경우였다. 8월 기록 6건이 전부 날짜가 없었고, 주간 기록은 08-20 과 08-27
  // 에만 있었다. 08-06·08-13 은 기록이 없어 열리지 않으므로 08-20 이 답이다. 원장도 그쪽을
  // 가리킨다. 네 캐릭터가 8/23 에 이미 완료였고 그 날은 08-20 주 안이다.
  it('날짜를 모르면 기록이 있는 가장 빠른 주차에 선다', () => {
    const 물음 = (week: string): boolean =>
      isMonthlyRowInWeek({
        weeklyPeriodKey: week,
        monthlyPeriodKey: '2026-08',
        isComplete: true,
        defeatedOn: null,
        now: 지금,
        weeksWithRecords: ['2026-08-20', '2026-08-27'],
      })

    expect(물음('2026-08-20')).toBe(true)
    expect(물음('2026-08-06')).toBe(false)
    expect(물음('2026-08-13')).toBe(false)
    expect(물음('2026-08-27')).toBe(false)
  })

  // 지난달의 미완료는 애초에 없다. 안 잡은 것은 기록 자체가 안 남는다.
  it('지난달 주에는 미완료가 안 선다', () => {
    expect(
      isMonthlyRowInWeek({
        weeklyPeriodKey: '2026-08-06',
        monthlyPeriodKey: '2026-08',
        isComplete: false,
        defeatedOn: null,
        now: 지금,
        weeksWithRecords: [],
      }),
    ).toBe(false)
  })
})

describe('resolveUndatedWeek', () => {
  // 날짜를 못 캤다는 것 자체가 그 처치가 조회 창보다 앞, 곧 그 달의 앞쪽이었다는 뜻이다.
  // 뒤쪽 주에 놓으면 체계적으로 틀린 쪽으로 민다.
  it('기록이 있는 주차 중 가장 빠른 것을 고른다', () => {
    expect(resolveUndatedWeek('2026-08', NOW, ['2026-08-27', '2026-08-20'])).toBe('2026-08-20')
    expect(resolveUndatedWeek('2026-08', NOW, ['2026-08-06'])).toBe('2026-08-06')
  })

  // 기록이 없는 주는 이전 기간 게이트에 막혀 열리지도 않는다.
  it('기록이 없는 앞 주차는 건너뛴다', () => {
    expect(resolveUndatedWeek('2026-08', NOW, ['2026-08-13'])).toBe('2026-08-13')
  })

  // 아직 오지 않은 주에 과거의 처치를 놓지 않는다. 그 주는 `예정` 으로 선다.
  it('기록이 하나도 없으면 이번 주를 안 넘는 마지막 주차다', () => {
    expect(resolveUndatedWeek('2026-09', new Date('2026-09-05T12:00:00+09:00'), [])).toBe('2026-09-03')
    expect(resolveUndatedWeek('2026-09', new Date('2026-09-20T12:00:00+09:00'), [])).toBe('2026-09-17')
  })

  // 기록이 있으면 언제 보든 같은 답이다. `now` 는 폴백에서만 쓰인다.
  it('기록이 있으면 언제 보든 흔들리지 않는다', () => {
    const 답 = ['2026-09-05', '2026-10-20', '2026-12-01'].map((d) =>
      resolveUndatedWeek('2026-08', new Date(`${d}T12:00:00+09:00`), ['2026-08-20', '2026-08-27']),
    )

    expect(new Set(답)).toEqual(new Set(['2026-08-20']))
  })
})

describe('monthsOfWeek', () => {
  it('달을 걸친 주는 둘, 그 밖은 하나다', () => {
    expect(monthsOfWeek('2026-08-27')).toEqual(['2026-08', '2026-09'])
    expect(monthsOfWeek('2026-09-10')).toEqual(['2026-09'])
  })

  // 마지막 날이 1일인 주도 둘이다(목요일이 그 달 말일 직전).
  it('마지막 하루만 다음 달이어도 둘이다', () => {
    expect(monthsOfWeek('2026-06-25')).toEqual(['2026-06', '2026-07'])
  })
})
