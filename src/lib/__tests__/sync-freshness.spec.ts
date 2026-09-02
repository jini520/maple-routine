import { SYNC_TTL_MS, isSyncFresh } from '../scheduler/sync-freshness'

const NOW = new Date('2026-08-06T12:00:00.000Z')

function agoIso(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString()
}

const MINUTE = 60 * 1000

describe('SYNC_TTL_MS', () => {
  it('10분이다', () => {
    expect(SYNC_TTL_MS).toBe(10 * 60 * 1000)
  })
})

describe('isSyncFresh', () => {
  it('추적 대상이 없으면 신선하다 — 조회할 것이 없다', () => {
    expect(isSyncFresh([], 0, NOW)).toBe(true)
  })

  it('캐시가 없는 캐릭터가 하나라도 있으면 만료다', () => {
    // 추적 3명인데 캐시는 2명분 — 새로 추가된 캐릭터가 조회 없이 빈 채로 남으면 안 된다.
    expect(isSyncFresh([agoIso(MINUTE), agoIso(MINUTE)], 3, NOW)).toBe(false)
  })

  it('전부 TTL 안이면 신선하다', () => {
    expect(isSyncFresh([agoIso(5 * MINUTE), agoIso(5 * MINUTE), agoIso(5 * MINUTE)], 3, NOW)).toBe(
      true,
    )
  })

  it('하나만 TTL 밖이면 만료다 — 판정은 가장 오래된 값 기준이다', () => {
    expect(isSyncFresh([agoIso(MINUTE), agoIso(11 * MINUTE), agoIso(MINUTE)], 3, NOW)).toBe(false)
  })

  it('경계 정확히 TTL이면 만료다', () => {
    expect(isSyncFresh([agoIso(SYNC_TTL_MS)], 1, NOW)).toBe(false)
    expect(isSyncFresh([agoIso(SYNC_TTL_MS - 1)], 1, NOW)).toBe(true)
  })

  it('미래 시각은 만료다 — 신선으로 읽으면 영영 조회하지 않는다', () => {
    expect(isSyncFresh([new Date(NOW.getTime() + 60 * MINUTE).toISOString()], 1, NOW)).toBe(false)
  })

  it('파싱되지 않는 문자열은 만료다', () => {
    expect(isSyncFresh(['not-a-date'], 1, NOW)).toBe(false)
    expect(isSyncFresh([agoIso(MINUTE), 'not-a-date'], 2, NOW)).toBe(false)
  })

  it('null 이 섞여 있으면 만료다', () => {
    expect(isSyncFresh([null], 1, NOW)).toBe(false)
    expect(isSyncFresh([agoIso(MINUTE), null], 2, NOW)).toBe(false)
  })
})
