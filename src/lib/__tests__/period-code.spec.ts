import { getWeeklyPeriodKeysInMonth } from '../boss/boss-profit-period'
import { dailyPeriodCodeOf, periodCodeOf, periodKeyOfCode } from '../boss/period-code'

describe('기간 값과 기간 key', () => {
  // 주차는 그 해의 첫 목요일에 시작한 주가 1주차다. 1월 1일이 목요일이 아니면 그 며칠은 전 해의 마지막 주차에 든다.
  it('주는 시작한 목요일의 해에 속하고, 해마다 52주나 53주다', () => {
    expect(periodCodeOf('2026-01-01')).toBe('W202601')
    expect(periodCodeOf('2026-11-19')).toBe('W202647')
    expect(periodCodeOf('2026-12-31')).toBe('W202653')
    expect(periodCodeOf('2027-01-07')).toBe('W202701')
    expect(periodCodeOf('2025-12-25')).toBe('W202552')
  })

  // 주간 시작일과 월간 시작일이 같은 날에도 두 값은 다르다. 첫 글자가 주기를 말해서 주기 칸을 두지 않는다.
  it('같은 날 시작한 주와 달의 값이 다르다', () => {
    expect(periodCodeOf('2026-10-01')).toBe('W202640')
    expect(periodCodeOf('2026-10')).toBe('M202610')
  })

  // 기록 표는 값을 적고 화면은 key 로 그린다. 한 바퀴 돌아 다른 key 가 나오면 기록이 다른 주에 선다.
  it('2026 ~ 2028 의 모든 주간 key 와 월간 key 가 값을 거쳐 그대로 돌아온다', () => {
    const months = ['2026', '2027', '2028'].flatMap((year) =>
      Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`),
    )
    const keys = [...months, ...months.flatMap(getWeeklyPeriodKeysInMonth)]

    expect(keys.filter((key) => periodKeyOfCode(periodCodeOf(key)!) !== key)).toEqual([])
  })

  // 일간 공유 컨텐츠의 진행은 그날 날짜로 기간을 가른다. 일간 key 와 주간 key 는 꼴이 같아 일간 값은 따로 구하고, 요일을 보지 않는다.
  it('일간 값은 요일과 상관없이 그날 날짜를 적고 그 날짜로 돌아온다', () => {
    expect(dailyPeriodCodeOf('2026-11-18')).toBe('D20261118')
    expect(periodKeyOfCode('D20261118')).toBe('2026-11-18')
    expect(dailyPeriodCodeOf('2026-11')).toBeNull()
  })

  it('목요일이 아닌 주간 key 와 꼴이 다른 값은 null 이다', () => {
    expect(periodCodeOf('2026-11-18')).toBeNull()
    expect(periodKeyOfCode('2026-11-19')).toBeNull()
    expect(periodKeyOfCode('X202647')).toBeNull()
  })
})
