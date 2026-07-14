import { describe, expect, it } from 'vitest'
import {
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  getBackfillQueryDate,
  getCurrentBossProfitPeriod,
  getWeeklyPeriodKeysInMonth,
  isLatestPeriod,
} from '../boss-profit-period'

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
