import { describe, expect, it } from 'vitest'
import { getCurrentBossProfitPeriod } from '../boss-profit-period'

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
