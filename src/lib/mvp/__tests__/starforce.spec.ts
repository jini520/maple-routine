import type { MvpGradeEntry } from '../history'
import { starforceMvpDiscountOf } from '../starforce'

const HISTORIES = new Map<string, MvpGradeEntry[]>([
  ['A', [{ startDate: '2026-06-11', grade: 'silver' }]],
  ['B', [{ startDate: '2026-06-11', grade: 'gold' }, { startDate: '2026-08-06', grade: 'diamond' }]],
])

// 강화 줄은 그 캐릭터의 메이플 ID 를 든다. 다른 ID 의 등급을 빌려 오지 않는다.
describe('스타포스 줄의 MVP 할인', () => {
  it('그 줄의 메이플 ID 의 그 날 등급이다', () => {
    expect(starforceMvpDiscountOf(HISTORIES, 'A', '2026-08-10')).toBe(3)
    expect(starforceMvpDiscountOf(HISTORIES, 'B', '2026-07-01')).toBe(5)
    expect(starforceMvpDiscountOf(HISTORIES, 'B', '2026-08-10')).toBe(10)
  })

  it('그 ID 에 등급 이력이 없거나 그 날 등급이 없으면 할인이 없다', () => {
    expect(starforceMvpDiscountOf(HISTORIES, 'C', '2026-08-10')).toBe(0)
    expect(starforceMvpDiscountOf(HISTORIES, 'B', '2026-06-01')).toBe(0)
  })
})
