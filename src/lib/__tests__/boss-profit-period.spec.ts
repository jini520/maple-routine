import {
  containsInProgressWeek,
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  isPeriodRefreshable,
  getBackfillQueryDate,
  getCurrentBossProfitPeriod,
  getMinQueryableDate,
  getPeriodDateKeys,
  getWeeklyPeriodKeysInMonth,
  isEarliestNavigablePeriod,
  isLatestPeriod,
  getMaxQueryableDate,
  isPeriodQueryable,
  resolvePagePeriodState,
  resolvePeriodDataState,
  MIN_SCHEDULER_DATE,
} from '../boss/boss-profit-period'

describe('MIN_SCHEDULER_DATE', () => {
  it('사용자 재실측(2026-07-14)으로 확인된 스케줄러 API 조회 가능 최소 날짜다', () => {
    expect(MIN_SCHEDULER_DATE).toBe('2026-07-01')
  })
})

describe('getCurrentBossProfitPeriod', () => {
  describe('weekly', () => {
    it('가장 최근 KST 목요일 리셋 날짜를 periodKey로, "이번 주"를 label로 반환한다', () => {
      const now = new Date('2026-07-10T15:00:00+09:00') // KST 금요일

      const result = getCurrentBossProfitPeriod('weekly', now)

      expect(result).toEqual({ periodKey: '2026-07-09', label: '이번 주' })
    })

    it('같은 주 안에서는 (수요일이든 목요일이든) 같은 periodKey를 반환한다', () => {
      const thursday = getCurrentBossProfitPeriod('weekly', new Date('2026-07-09T00:00:00+09:00'))
      const wednesday = getCurrentBossProfitPeriod('weekly', new Date('2026-07-08T23:59:59.999+09:00'))

      expect(thursday.periodKey).toBe('2026-07-09')
      expect(wednesday.periodKey).toBe('2026-07-02')
    })
  })

  describe('monthly', () => {
    it('KST 기준 연-월을 periodKey로, "이번 달"을 label로 반환한다', () => {
      const now = new Date('2026-08-01T12:00:00+09:00')

      const result = getCurrentBossProfitPeriod('monthly', now)

      expect(result).toEqual({ periodKey: '2026-08', label: '이번 달' })
    })

    it('KST 매월 1일 00:00 경계를 기준으로 달이 바뀐다 (가정치, PRD #36 실측 확인 전)', () => {
      const justBeforeReset = getCurrentBossProfitPeriod('monthly', new Date('2026-07-31T23:59:00+09:00'))
      const justAfterReset = getCurrentBossProfitPeriod('monthly', new Date('2026-08-01T00:00:00+09:00'))

      expect(justBeforeReset.periodKey).toBe('2026-07')
      expect(justAfterReset.periodKey).toBe('2026-08')
    })
  })
})

describe('getAdjacentPeriodKey', () => {
  it('weekly는 ±7일 이동한다', () => {
    expect(getAdjacentPeriodKey('weekly', '2026-07-09', 'next')).toBe('2026-07-16')
    expect(getAdjacentPeriodKey('weekly', '2026-07-09', 'prev')).toBe('2026-07-02')
  })

  it('monthly는 ±1개월 이동하고 연도 경계를 넘긴다', () => {
    expect(getAdjacentPeriodKey('monthly', '2026-07', 'next')).toBe('2026-08')
    expect(getAdjacentPeriodKey('monthly', '2026-07', 'prev')).toBe('2026-06')
    expect(getAdjacentPeriodKey('monthly', '2026-12', 'next')).toBe('2027-01')
    expect(getAdjacentPeriodKey('monthly', '2026-01', 'prev')).toBe('2025-12')
  })
})

describe('isLatestPeriod', () => {
  const now = new Date('2026-07-10T15:00:00+09:00') // 현재 주 periodKey: 2026-07-09

  it('현재 기간이면 true를 반환한다', () => {
    expect(isLatestPeriod('weekly', '2026-07-09', now)).toBe(true)
  })

  it('과거 기간이면 false를 반환한다', () => {
    expect(isLatestPeriod('weekly', '2026-07-02', now)).toBe(false)
  })

  it('monthly도 동일하게 동작한다', () => {
    const monthlyNow = new Date('2026-08-01T12:00:00+09:00') // 현재 달 periodKey: 2026-08
    expect(isLatestPeriod('monthly', '2026-08', monthlyNow)).toBe(true)
    expect(isLatestPeriod('monthly', '2026-07', monthlyNow)).toBe(false)
  })
})

describe('containsInProgressWeek / isPeriodRefreshable', () => {
  // 2026-07-30(목)이 7월의 마지막 리셋이라 7월 5주차는 8/5까지 이어진다. 8/1에 7월은 지난 달이
  // 되지만 그 주는 여전히 진행 중이다.
  const inWindow = new Date('2026-08-02T12:00:00+09:00') // 이번 주 2026-07-30, 이번 달 2026-08
  const afterWindow = new Date('2026-08-10T12:00:00+09:00') // 이번 주 2026-08-06 — 7월은 완전히 닫혔다

  it('진행 중인 주가 그 달에서 시작했으면 지난 달이어도 true다', () => {
    expect(containsInProgressWeek('monthly', '2026-07', inWindow)).toBe(true)
  })

  it('그 주가 끝나 다음 주가 시작되면 false로 돌아온다', () => {
    expect(containsInProgressWeek('monthly', '2026-07', afterWindow)).toBe(false)
  })

  it('이번 달은 false다 — 이미 최신 기간이라 이 판정이 필요 없다', () => {
    expect(containsInProgressWeek('monthly', '2026-08', inWindow)).toBe(false)
  })

  it('weekly 탭에서는 항상 false다 — 지난 주는 언제나 완전히 닫혀 있다', () => {
    expect(containsInProgressWeek('weekly', '2026-07-30', inWindow)).toBe(false)
    expect(containsInProgressWeek('weekly', '2026-07-23', inWindow)).toBe(false)
  })

  it('isPeriodRefreshable: 최신 기간이거나 진행 중인 주를 품은 기간이면 true다', () => {
    expect(isPeriodRefreshable('monthly', '2026-08', inWindow)).toBe(true) // 최신 기간
    expect(isPeriodRefreshable('monthly', '2026-07', inWindow)).toBe(true) // 5주차가 진행 중
    expect(isPeriodRefreshable('monthly', '2026-07', afterWindow)).toBe(false) // 완전히 닫힘
    expect(isPeriodRefreshable('weekly', '2026-07-23', inWindow)).toBe(false)
  })
})

describe('isEarliestNavigablePeriod', () => {
  it('weekly: MIN_SCHEDULER_DATE(2026-07-01)가 백필 조회일인 주(2026-06-25)에서는 true다 — 더 과거로 갈 수 없다', () => {
    expect(isEarliestNavigablePeriod('weekly', '2026-06-25')).toBe(true)
  })

  it('weekly: 그보다 늦은 주(2026-07-02)에서는 false다 — 한 주 전(2026-06-25)까지는 갈 수 있다', () => {
    expect(isEarliestNavigablePeriod('weekly', '2026-07-02')).toBe(false)
  })

  it('monthly: 이번 달(2026-07)에서는 true다 — 지난 달(2026-06)은 통째로 MIN_SCHEDULER_DATE 이전이라 갈 수 없다', () => {
    expect(isEarliestNavigablePeriod('monthly', '2026-07')).toBe(true)
  })

  it('monthly: 다음 달(2026-08)에서는 false다 — 한 달 전(2026-07)까지는 갈 수 있다', () => {
    expect(isEarliestNavigablePeriod('monthly', '2026-08')).toBe(false)
  })
})

describe('getMinQueryableDate', () => {
  it('사용자 실측(2026-07-22)대로 오늘-13일을 반환한다', () => {
    const now = new Date('2026-07-22T12:00:00+09:00')

    expect(getMinQueryableDate(now)).toBe('2026-07-09')
  })
})

describe('isPeriodQueryable', () => {
  const now = new Date('2026-07-22T12:00:00+09:00') // getMinQueryableDate: 2026-07-09

  it('weekly: 롤링 윈도우 안(조회일이 2026-07-09 이상)이면 true다', () => {
    // periodKey 2026-07-09(이번 주 리셋)의 조회일은 2026-07-15
    expect(isPeriodQueryable('weekly', '2026-07-09', now)).toBe(true)
  })

  it('weekly: 롤링 윈도우를 벗어나면(조회일이 2026-07-09 미만) false다 — 오늘-14일(2026-07-08)은 조회 불가', () => {
    // periodKey 2026-07-02의 조회일은 2026-07-08 — 오늘(2026-07-22) 기준 정확히 14일 전
    expect(isPeriodQueryable('weekly', '2026-07-02', now)).toBe(false)
  })

  it('weekly: MIN_SCHEDULER_DATE 이전이면 롤링 윈도우 안이어도 false다', () => {
    // MIN_SCHEDULER_DATE(2026-07-01) 이전은 롤링 윈도우와 무관하게 항상 불가
    const recentNow = new Date('2026-07-05T12:00:00+09:00') // getMinQueryableDate: 2026-06-22(롤링 윈도우는 더 이르지만)
    expect(isPeriodQueryable('weekly', '2026-06-18', recentNow)).toBe(false) // 조회일 2026-06-24 < MIN_SCHEDULER_DATE
  })

  // 상한이 생겼다. 이 테스트는 전에 "조회일이 아직 안 지났어도 날짜
  // 비교상 통과"를 그대로 기록하고 있었는데, 그게 바로 버그였다. 현재 달의 조회일(그 달
  // 마지막 날)은 미래이고 실제로 호출하면 400 OPENAPI00004다(실측).
  it('monthly: 그 달의 마지막 날이 아직 오지 않았으면 false다 (상한)', () => {
    expect(isPeriodQueryable('monthly', '2026-07', now)).toBe(false) // 조회일 2026-07-31 > 오늘-1일(2026-07-21)
  })

  it('monthly: 지난 달은 조회일이 하한·상한 사이라 true다', () => {
    // now 2026-08-05 → 롤링 하한 2026-07-23 · 상한 2026-08-04. 2026-07의 조회일 2026-07-31은 그 사이다.
    // (2026-06은 MIN_SCHEDULER_DATE(2026-07-01)에 막히므로 예시로 쓸 수 없다)
    expect(isPeriodQueryable('monthly', '2026-07', new Date('2026-08-05T12:00:00+09:00'))).toBe(true)
  })

  it('오늘·미래 조회일은 상한에 막힌다 — 실측 400 OPENAPI00004', () => {
    // now 2026-07-22 → 이번 주(2026-07-16)의 조회일은 2026-07-22 = 오늘
    expect(isPeriodQueryable('weekly', '2026-07-16', now)).toBe(false)
    expect(getMaxQueryableDate(now)).toBe('2026-07-21')
  })

  it('오늘-1일은 상한 안이다 — 새벽엔 OPENAPI00009지만 집계가 끝나면 조회된다(정정 2)', () => {
    // 조회일이 정확히 오늘-1일(2026-07-21)인 주 = periodKey 2026-07-15? weekly는 목요일이므로
    // 조회일 오늘-1일을 만들려면 periodKey = 2026-07-15 - 6 = 2026-07-15가 아니다. 대신 상한
    // 경계값 자체를 확인한다.
    expect(getMaxQueryableDate(now)).toBe('2026-07-21')
    expect(isPeriodQueryable('weekly', '2026-07-09', now)).toBe(true) // 조회일 2026-07-15 <= 2026-07-21
  })

  it('monthly: 그 달의 마지막 날이 롤링 윈도우 밖이면 false다', () => {
    expect(isPeriodQueryable('monthly', '2026-06', now)).toBe(false) // 조회일 2026-06-30 < 2026-07-09
  })
})

describe('formatBossProfitPeriodLabel', () => {
  describe('weekly', () => {
    const now = new Date('2026-07-10T15:00:00+09:00') // 현재 주 periodKey: 2026-07-09

    it('현재 주는 "이번 주"로 표기한다', () => {
      expect(formatBossProfitPeriodLabel('weekly', '2026-07-09', now)).toEqual({
        primary: '이번 주',
        secondary: '7월 9일 ~ 7월 15일',
      })
    })

    it('한 주 전은 "지난 주"로 표기한다', () => {
      expect(formatBossProfitPeriodLabel('weekly', '2026-07-02', now)).toEqual({
        primary: '지난 주',
        secondary: '7월 2일 ~ 7월 8일',
      })
    })

    it('두 주 이상 전은 "OO월 N주차"로 표기한다', () => {
      expect(formatBossProfitPeriodLabel('weekly', '2026-06-25', now)).toEqual({
        primary: '6월 4주차',
        secondary: '6월 25일 ~ 7월 1일',
      })
      expect(formatBossProfitPeriodLabel('weekly', '2026-06-18', now)).toEqual({
        primary: '6월 3주차',
        secondary: '6월 18일 ~ 6월 24일',
      })
    })
  })

  describe('monthly', () => {
    const now = new Date('2026-08-01T12:00:00+09:00') // 현재 달 periodKey: 2026-08

    it('현재 달은 "이번 달"로 표기한다', () => {
      expect(formatBossProfitPeriodLabel('monthly', '2026-08', now)).toEqual({
        primary: '이번 달',
        secondary: '2026년 8월',
      })
    })

    it('한 달 전은 "지난 달"로 표기한다', () => {
      expect(formatBossProfitPeriodLabel('monthly', '2026-07', now)).toEqual({
        primary: '지난 달',
        secondary: '2026년 7월',
      })
    })

    it('두 달 이상 전은 "OOOO년 O월"로 표기한다', () => {
      expect(formatBossProfitPeriodLabel('monthly', '2026-06', now)).toEqual({
        primary: '2026년 6월',
        secondary: '2026년 6월',
      })
    })
  })
})

describe('getWeeklyPeriodKeysInMonth', () => {
  it('그 달에 속한 모든 목요일 날짜를 오름차순으로 반환한다', () => {
    expect(getWeeklyPeriodKeysInMonth('2026-07')).toEqual([
      '2026-07-02',
      '2026-07-09',
      '2026-07-16',
      '2026-07-23',
      '2026-07-30',
    ])
  })

  it('월 경계에 걸친 주는 리셋 목요일이 속한 달에서만 집계된다', () => {
    // 2026-06-25(목)~2026-07-01(수) 주는 목요일이 6월에 속하므로 6월 목록에 포함되고 7월 목록에는 없다
    const june = getWeeklyPeriodKeysInMonth('2026-06')
    const july = getWeeklyPeriodKeysInMonth('2026-07')

    expect(june).toContain('2026-06-25')
    expect(july).not.toContain('2026-06-25')
    expect(july[0]).toBe('2026-07-02')
  })
})

describe('getBackfillQueryDate', () => {
  it('weekly는 periodKey(리셋 목요일)+6일을 반환한다', () => {
    expect(getBackfillQueryDate('weekly', '2026-06-04')).toBe('2026-06-10')
  })

  it('monthly는 그 달의 마지막 날을 반환한다', () => {
    expect(getBackfillQueryDate('monthly', '2026-06')).toBe('2026-06-30') // 30일
    expect(getBackfillQueryDate('monthly', '2026-07')).toBe('2026-07-31') // 31일
    expect(getBackfillQueryDate('monthly', '2024-02')).toBe('2024-02-29') // 윤년 2월
    expect(getBackfillQueryDate('monthly', '2026-02')).toBe('2026-02-28') // 평년 2월
  })
})

// 결정 2(+정정 1·2): 기간 상태를 여섯 가지로 나눈다. 판정에 필요한 입력을 전부 인자로
// 받는 순수 함수라 store·화면이 같은 값을 공유할 수 있다(전에는 화면은 isPeriodQueryable,
// 백필은 target별로 따로 판정해 월간 탭에서 두 문구가 동시에 뜨는 경로가 있었다. 이슈 #78 E).
describe('resolvePeriodDataState', () => {
  const base = {
    isCurrentPeriod: false,
    hasRecords: false,
    isChecked: false,
    isQueryable: true,
    lastOutcome: null,
  } as const

  it('기록이 있으면 recorded — 조회 가능성과 무관하다', () => {
    expect(resolvePeriodDataState({ ...base, hasRecords: true })).toBe('recorded')
    expect(resolvePeriodDataState({ ...base, hasRecords: true, isQueryable: false })).toBe('recorded')
  })

  it('확인 기록이 있고 기록이 없으면 confirmedEmpty — 시간이 지나도 격하되지 않는다(결정 3)', () => {
    expect(resolvePeriodDataState({ ...base, isChecked: true })).toBe('confirmedEmpty')
    // 롤링 윈도우를 벗어난 뒤에도 "0건 확정"이 유지된다. 전에는 여기서 조회 불가로 바뀌었다
    expect(resolvePeriodDataState({ ...base, isChecked: true, isQueryable: false })).toBe('confirmedEmpty')
  })

  it('조회 구간 밖이면 outOfRange', () => {
    expect(resolvePeriodDataState({ ...base, isQueryable: false })).toBe('outOfRange')
  })

  it('이번 시도가 집계 전이었으면 notCollected', () => {
    expect(resolvePeriodDataState({ ...base, lastOutcome: 'notCollected' })).toBe('notCollected')
  })

  it('이번 시도가 그 외 실패였으면 failed', () => {
    expect(resolvePeriodDataState({ ...base, lastOutcome: 'failed' })).toBe('failed')
  })

  it('조회 가능한데 확인도 시도도 없으면 notChecked — 조회 버튼을 주는 상태(정정 1)', () => {
    expect(resolvePeriodDataState(base)).toBe('notChecked')
  })

  it('현재 기간은 실시간 동기화가 원천이라 recorded/confirmedEmpty뿐이다', () => {
    // 현재 기간의 조회일은 미래라 isQueryable이 false지만, 백필이 아니라 실시간 동기화로 보므로
    // "조회 불가"가 아니다. 처치가 0건이면 그것이 확정된 사실이다.
    expect(resolvePeriodDataState({ ...base, isCurrentPeriod: true, isQueryable: false })).toBe(
      'confirmedEmpty',
    )
    expect(
      resolvePeriodDataState({ ...base, isCurrentPeriod: true, isQueryable: false, hasRecords: true }),
    ).toBe('recorded')
  })
})

describe('resolvePagePeriodState', () => {
  it('기록이 하나라도 있으면 recorded — 화면의 주인은 보여줄 기록이다', () => {
    expect(resolvePagePeriodState(['outOfRange', 'recorded', 'failed'])).toBe('recorded')
  })

  it('행동이 있는 상태(failed·notChecked)가 없는 상태보다 앞선다', () => {
    expect(resolvePagePeriodState(['outOfRange', 'failed'])).toBe('failed')
    expect(resolvePagePeriodState(['confirmedEmpty', 'notChecked'])).toBe('notChecked')
    expect(resolvePagePeriodState(['notCollected', 'failed'])).toBe('failed')
  })

  it('전원이 확정했을 때만 confirmedEmpty다 — 불확실을 확정으로 위장하지 않는다', () => {
    expect(resolvePagePeriodState(['confirmedEmpty', 'confirmedEmpty'])).toBe('confirmedEmpty')
    expect(resolvePagePeriodState(['confirmedEmpty', 'outOfRange'])).toBe('outOfRange')
  })

  it('캐릭터가 없으면 confirmedEmpty (보여줄 것도 모를 것도 없다)', () => {
    expect(resolvePagePeriodState([])).toBe('confirmedEmpty')
  })
})

// 처치 날짜를 캐려면 **그 기간의 날짜들** 이 필요하다. 한 날짜만 보는
// `getBackfillQueryDate` 로는 일간 해상도가 안 나온다.
describe('getPeriodDateKeys', () => {
  it('주간은 리셋 목요일부터 이레다', () => {
    expect(getPeriodDateKeys('weekly', '2026-08-20')).toEqual([
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
    ])
  })

  it('주가 달을 넘어도 날짜가 이어진다', () => {
    expect(getPeriodDateKeys('weekly', '2026-07-30')).toEqual([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ])
  })

  it('월간은 1일부터 그 달 마지막 날까지다', () => {
    const days = getPeriodDateKeys('monthly', '2026-02')
    expect(days[0]).toBe('2026-02-01')
    expect(days[days.length - 1]).toBe('2026-02-28')
    expect(days).toHaveLength(28)
  })

  it('31일 달도 끝을 맞춘다', () => {
    const days = getPeriodDateKeys('monthly', '2026-08')
    expect(days).toHaveLength(31)
    expect(days[30]).toBe('2026-08-31')
  })
})
