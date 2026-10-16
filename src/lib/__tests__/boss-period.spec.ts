// 보스의 유효 기간. 시즌이 끝난 시즌 보스가 다음 챌린저스 월드에 서지 않게 하는 판정이다.
import { activeBossesInSection, isBossActiveIn } from '../boss/bosses'
import { BUNDLED_BOSS_CATALOG, parseBossCatalog, setBossCatalog } from '../boss/catalog'
import type { BossCatalog } from '../../types/boss-catalog'

function withMeirinUntil(until: string | undefined, from?: string): BossCatalog {
  return {
    ...BUNDLED_BOSS_CATALOG,
    updatedAt: '2026-10-16T00:00:00.000Z',
    bosses: BUNDLED_BOSS_CATALOG.bosses.map((boss) =>
      boss.key === 'meirin' ? { ...boss, ...(from === undefined ? {} : { from }), ...(until === undefined ? {} : { until }) } : boss,
    ),
  }
}

afterEach(() => {
  setBossCatalog(BUNDLED_BOSS_CATALOG)
})

describe('isBossActiveIn', () => {
  it('기간이 없는 보스는 언제나 유효하고, 표에 없는 key 도 유효하다', () => {
    expect(isBossActiveIn('lotus', '2026-10-15')).toBe(true)
    expect(isBossActiveIn('nobody', '2026-10-15')).toBe(true)
    expect(isBossActiveIn(null, '2026-10-15')).toBe(true)
  })

  // 2026-10-15 와 2026-10-22 가 목요일이다. 시즌이 10-21(수)에 끝나면 10-15 주는 서고 10-22 주는 안 선다.
  it('끝이 있으면 그 기간의 첫날이 끝 앞일 때만 유효하다. 지난 기간은 그대로 선다', () => {
    setBossCatalog(withMeirinUntil('2026-10-22'))

    expect(isBossActiveIn('meirin', '2026-10-15')).toBe(true)
    expect(isBossActiveIn('meirin', '2026-10-08')).toBe(true)
    expect(isBossActiveIn('meirin', '2026-10-22')).toBe(false)
    expect(isBossActiveIn('meirin', '2026-10-29')).toBe(false)
  })

  it('끝이 주 가운데면 그 날을 품은 주까지 선다', () => {
    setBossCatalog(withMeirinUntil('2026-10-25'))

    expect(isBossActiveIn('meirin', '2026-10-22')).toBe(true)
    expect(isBossActiveIn('meirin', '2026-10-29')).toBe(false)
  })

  it('시작이 있으면 그 전 기간에는 안 선다', () => {
    setBossCatalog(withMeirinUntil(undefined, '2026-10-22'))

    expect(isBossActiveIn('meirin', '2026-10-15')).toBe(false)
    expect(isBossActiveIn('meirin', '2026-10-22')).toBe(true)
  })
})

describe('activeBossesInSection', () => {
  it('지금 기간에 유효한 보스만 세운다', () => {
    const now = new Date('2026-10-23T03:00:00+09:00')
    expect(activeBossesInSection('eventWeekly', now).map((b) => b.key)).toEqual(['meirin'])

    setBossCatalog(withMeirinUntil('2026-10-22'))
    expect(activeBossesInSection('eventWeekly', now)).toEqual([])
    expect(activeBossesInSection('weekly', now)).toHaveLength(24)
  })
})

describe('parseBossCatalog: 유효 기간', () => {
  it('from · until 을 받고 null 은 없는 것으로 읽는다', () => {
    const parsed = parseBossCatalog(withMeirinUntil('2026-10-22T10:00', '2026-07-03'))
    const meirin = parsed?.bosses.find((b) => b.key === 'meirin')
    expect(meirin).toMatchObject({ from: '2026-07-03', until: '2026-10-22T10:00' })

    const nulled = parseBossCatalog({
      ...BUNDLED_BOSS_CATALOG,
      bosses: BUNDLED_BOSS_CATALOG.bosses.map((b) => ({ ...b, from: null, until: null })),
    })
    expect(nulled?.bosses.find((b) => b.key === 'meirin')).not.toHaveProperty('until')
  })

  it('모양이 틀린 기간은 표 전체를 거절한다', () => {
    expect(parseBossCatalog(withMeirinUntil('2026-10-22T10'))).toBeNull()
    expect(parseBossCatalog(withMeirinUntil('2026-10-22', '2026-7-3'))).toBeNull()
  })
})
