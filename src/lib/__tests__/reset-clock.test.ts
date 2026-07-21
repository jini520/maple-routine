import { describe, expect, it } from 'vitest'
import { getCurrentKstDateKey, getMostRecentWeeklyResetKst } from '../reset-clock'

describe('getMostRecentWeeklyResetKst', () => {
  it('정확히 KST 목요일 00:00 시점이면 같은 시각을 반환한다', () => {
    const now = new Date('2026-07-09T00:00:00+09:00')

    const result = getMostRecentWeeklyResetKst(now)

    expect(result.toISOString()).toBe('2026-07-08T15:00:00.000Z')
  })

  it('KST 목요일 00:00 직전(수요일 23:59:59.999)이면 그 전 주 목요일을 반환한다', () => {
    const now = new Date('2026-07-08T23:59:59.999+09:00')

    const result = getMostRecentWeeklyResetKst(now)

    expect(result.toISOString()).toBe('2026-07-01T15:00:00.000Z')
  })

  it('KST 금요일이면 같은 주 목요일 00:00을 반환한다', () => {
    const now = new Date('2026-07-10T15:00:00+09:00')

    const result = getMostRecentWeeklyResetKst(now)

    expect(result.toISOString()).toBe('2026-07-08T15:00:00.000Z')
  })

  it('월 경계를 넘어서도 정확히 계산한다 (2026-08-01 토요일 -> 2026-07-30 목요일)', () => {
    const now = new Date('2026-08-01T12:00:00+09:00')

    const result = getMostRecentWeeklyResetKst(now)

    expect(result.toISOString()).toBe('2026-07-29T15:00:00.000Z')
  })

  it('연 경계를 넘어서도 정확히 계산한다 (2026-01-02 금요일 -> 2026-01-01 목요일)', () => {
    const now = new Date('2026-01-02T10:00:00+09:00')

    const result = getMostRecentWeeklyResetKst(now)

    expect(result.toISOString()).toBe('2025-12-31T15:00:00.000Z')
  })

  it('기기 로컬 타임존과 무관하게 항상 같은 절대 시각을 기준으로 계산한다', () => {
    // "2026-07-10T15:00:00Z"는 "2026-07-11T00:00:00+09:00"과 동일한 절대 시각이다 —
    // 어떤 표기로 Date를 구성하든(UTC 문자열이든 KST 오프셋 문자열이든) 결과가 같아야
    // 로컬 타임존에 의존하지 않는다는 뜻이다.
    const asUtcString = new Date('2026-07-10T15:00:00Z')
    const asKstOffsetString = new Date('2026-07-11T00:00:00+09:00')

    expect(asUtcString.getTime()).toBe(asKstOffsetString.getTime())
    expect(getMostRecentWeeklyResetKst(asUtcString).toISOString()).toBe(
      getMostRecentWeeklyResetKst(asKstOffsetString).toISOString(),
    )
    expect(getMostRecentWeeklyResetKst(asUtcString).toISOString()).toBe('2026-07-08T15:00:00.000Z')
  })
})

describe('getCurrentKstDateKey', () => {
  it('KST 기준 오늘 날짜를 YYYY-MM-DD로 반환한다', () => {
    const now = new Date('2026-07-21T10:00:00+09:00')
    expect(getCurrentKstDateKey(now)).toBe('2026-07-21')
  })

  it('UTC 자정 직후라도 KST로 환산하면 다음 날일 수 있다 (UTC 15:00 -> KST 다음날 00:00)', () => {
    const now = new Date('2026-07-20T15:00:00Z')
    expect(getCurrentKstDateKey(now)).toBe('2026-07-21')
  })

  it('KST 자정 직전(23:59:59)이면 아직 전날 날짜다', () => {
    const now = new Date('2026-07-21T23:59:59+09:00')
    expect(getCurrentKstDateKey(now)).toBe('2026-07-21')
  })

  it('월/연 경계를 넘어서도 정확히 계산한다', () => {
    expect(getCurrentKstDateKey(new Date('2026-01-01T00:00:00+09:00'))).toBe('2026-01-01')
    expect(getCurrentKstDateKey(new Date('2025-12-31T23:59:59+09:00'))).toBe('2025-12-31')
  })

  it('기기 로컬 타임존과 무관하게 항상 같은 절대 시각을 기준으로 계산한다', () => {
    const asUtcString = new Date('2026-07-10T15:00:00Z')
    const asKstOffsetString = new Date('2026-07-11T00:00:00+09:00')
    expect(getCurrentKstDateKey(asUtcString)).toBe(getCurrentKstDateKey(asKstOffsetString))
    expect(getCurrentKstDateKey(asUtcString)).toBe('2026-07-11')
  })
})
