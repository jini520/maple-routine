import type { MvpGradeEntry } from '../history'
import type { CharacterAccountSighting } from '../membership'
import { autoFeePercent } from '../fees'

const HISTORIES = new Map<string, MvpGradeEntry[]>([
  ['A', [{ startDate: '2026-06-11', grade: 'bronze' }, { startDate: '2026-08-06', grade: 'silver' }]],
  ['B', [{ startDate: '2026-06-11', grade: 'gold' }]],
])
const SIGHTINGS: CharacterAccountSighting[] = [
  { ocid: 'a1', name: '에이', accountId: 'A', firstSeenOn: '2026-09-01', lastSeenOn: '2026-09-22' },
  { ocid: 'c1', name: '씨', accountId: 'C', firstSeenOn: '2026-09-01', lastSeenOn: '2026-09-22' },
]
const context = { histories: HISTORIES, sightings: SIGHTINGS }

describe('자동 수수료 요율', () => {
  it('그 캐릭터가 속한 ID 의 그 날 등급 요율이다', () => {
    expect(autoFeePercent(context, 'a1', '2026-07-01')).toBe(5) // 브론즈
    expect(autoFeePercent(context, 'a1', '2026-08-10')).toBe(3) // 실버
  })

  // 기록은 앱에서 적은 것이라 소속은 그 뒤에 봤어도 캐릭터의 ID 다.
  it('처음 본 날보다 앞선 기록도 ocid 의 소속을 쓴다', () => {
    expect(autoFeePercent(context, 'a1', '2026-06-20')).toBe(5)
  })

  it('소속 ID 에 등급이 없거나 첫 기록보다 앞이면 일반 요율이다', () => {
    expect(autoFeePercent(context, 'c1', '2026-08-10')).toBe(5)
    expect(autoFeePercent(context, 'a1', '2026-06-01')).toBe(5)
  })

  it('소속을 모르면 그 날 등급을 가진 ID 가운데 가장 높은 등급이다', () => {
    expect(autoFeePercent(context, 'unknown', '2026-07-01')).toBe(3) // 브론즈 · 골드 중 골드
    expect(autoFeePercent(context, null, '2026-07-01')).toBe(3)
    expect(autoFeePercent(context, null, '2026-06-01')).toBe(5)
  })
})
