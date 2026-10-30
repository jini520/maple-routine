import { nextKstMidnightAfter, scheduleStaleTime } from '../freshness'
import { SYNC_TTL_MS } from '../../../lib/scheduler/sync-freshness'

// 2026-10-30 KST 14:00 = UTC 05:00
const KST_14 = new Date('2026-10-30T05:00:00.000Z')
// 2026-10-30 KST 23:55
const KST_2355 = new Date('2026-10-30T14:55:00.000Z')
// 2026-10-31 KST 00:00
const KST_MIDNIGHT = new Date('2026-10-30T15:00:00.000Z')

describe('nextKstMidnightAfter', () => {
  it('KST 자정은 UTC 15:00 이고, 자정 그 순간은 다음 자정을 낸다', () => {
    expect(nextKstMidnightAfter(KST_14.getTime())).toBe(KST_MIDNIGHT.getTime())
    expect(nextKstMidnightAfter(KST_2355.getTime())).toBe(KST_MIDNIGHT.getTime())
    expect(nextKstMidnightAfter(KST_MIDNIGHT.getTime())).toBe(KST_MIDNIGHT.getTime() + 24 * 60 * 60 * 1000)
  })
})

describe('scheduleStaleTime', () => {
  it('자정이 멀면 10분이다', () => {
    expect(scheduleStaleTime(KST_14.getTime(), ['a'], ['a'])).toBe(SYNC_TTL_MS)
  })

  it('받은 뒤 10분 안에 KST 자정이 끼면 자정까지만 신선하다', () => {
    expect(scheduleStaleTime(KST_2355.getTime(), ['a'], ['a'])).toBe(5 * 60 * 1000)
  })

  it('받은 적이 없으면 바로 만료다', () => {
    expect(scheduleStaleTime(0, ['a'], ['a'])).toBe(0)
  })

  it('추적 캐릭터 중 그 회차가 덮지 않은 캐릭터가 있으면 바로 만료다', () => {
    expect(scheduleStaleTime(KST_14.getTime(), ['a'], ['a', 'b'])).toBe(0)
    // 회차가 더 넓게 덮은 것은 상관없다.
    expect(scheduleStaleTime(KST_14.getTime(), ['a', 'b'], ['a'])).toBe(SYNC_TTL_MS)
  })

  it('추적 목록을 아직 모르면 캐릭터 조건은 보지 않는다', () => {
    expect(scheduleStaleTime(KST_14.getTime(), ['a'], null)).toBe(SYNC_TTL_MS)
  })
})
