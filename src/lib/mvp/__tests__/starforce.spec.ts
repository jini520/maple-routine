import type { MvpGradeEntry } from '../history'
import type { CharacterAccountSighting } from '../membership'
import { starforceMvpDiscountResolver } from '../starforce'

const HISTORIES = new Map<string, MvpGradeEntry[]>([
  ['A', [{ startDate: '2026-06-11', grade: 'silver' }]],
  ['B', [{ startDate: '2026-06-11', grade: 'gold' }, { startDate: '2026-08-06', grade: 'diamond' }]],
])
const SIGHTINGS: CharacterAccountSighting[] = [
  { ocid: 'x', name: '루디', accountId: 'A', firstSeenOn: '2026-07-01', lastSeenOn: '2026-09-22' },
  { ocid: 'z', name: '추적밖', accountId: 'C', firstSeenOn: '2026-07-01', lastSeenOn: '2026-09-22' },
]

describe('스타포스 줄의 MVP 할인', () => {
  const discountOf = starforceMvpDiscountResolver(HISTORIES, SIGHTINGS)

  it('소속을 알면 그 ID 의 그 날 등급이다', () => {
    expect(discountOf('루디', '2026-08-10')).toBe(3)
  })

  it('소속 ID 에 등급 이력이 없으면 할인이 없다', () => {
    expect(discountOf('추적밖', '2026-08-10')).toBe(0)
  })

  it('소속을 모르면 그 날 등급을 가진 ID 가운데 가장 높은 등급이다', () => {
    expect(discountOf('모르는캐릭터', '2026-07-01')).toBe(5) // 실버 · 골드 중 골드
    expect(discountOf('모르는캐릭터', '2026-08-10')).toBe(10) // 다이아
  })

  it('처음 본 날보다 앞선 줄은 소속을 모르는 줄이다', () => {
    expect(discountOf('루디', '2026-06-20')).toBe(5)
  })

  it('그 날 등급을 가진 ID 가 없으면 할인이 없다', () => {
    expect(discountOf('모르는캐릭터', '2026-06-01')).toBe(0)
  })
})
