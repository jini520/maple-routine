// 보스의 유효 기간. 시즌이 끝난 시즌 보스가 다음 챌린저스 월드에 서지 않게 하는 판정이다.
import { activeBossesInSection, activeDifficultiesOf, isBossActiveIn, withOwnDifficulty } from '../boss/bosses'
import { INITIAL_BOSS_CATALOG, parseBossCatalog, setBossCatalog } from '../boss/catalog'
import type { BossCatalog } from '../../types/boss-catalog'

/** 메이린의 기간을 넘긴 값으로 바꾼 표. 번들은 서버가 적은 시즌 끝(2026-09-16)을 들어 먼저 비운다. */
function withMeirinUntil(until: string | undefined, from?: string): BossCatalog {
  return {
    ...INITIAL_BOSS_CATALOG,
    updatedAt: '2026-10-16T00:00:00.000Z',
    bosses: INITIAL_BOSS_CATALOG.bosses.map((boss) =>
      boss.key === 'meirin'
        ? { ...boss, from: undefined, until: undefined, ...(from === undefined ? {} : { from }), ...(until === undefined ? {} : { until }) }
        : boss,
    ),
  }
}

afterEach(() => {
  setBossCatalog(INITIAL_BOSS_CATALOG)
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
    setBossCatalog(withMeirinUntil(undefined))
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
      ...withMeirinUntil(undefined),
      bosses: withMeirinUntil(undefined).bosses.map((b) => ({ ...b, from: null, until: null })),
    })
    expect(nulled?.bosses.find((b) => b.key === 'meirin')).not.toHaveProperty('until')
  })

  it('모양이 틀린 기간은 표 전체를 거절한다', () => {
    expect(parseBossCatalog(withMeirinUntil('2026-10-22T10'))).toBeNull()
    expect(parseBossCatalog(withMeirinUntil('2026-10-22', '2026-7-3'))).toBeNull()
  })
})

/** 스우 익스트림이 시작을 들게 바꾼 표. */
function withLotusExtremeFrom(from: string): BossCatalog {
  return {
    ...INITIAL_BOSS_CATALOG,
    updatedAt: '2026-10-16T00:00:00.000Z',
    bosses: INITIAL_BOSS_CATALOG.bosses.map((boss) =>
      boss.key === 'lotus'
        ? { ...boss, difficulties: boss.difficulties.map((d) => (d.difficulty === 'extreme' ? { ...d, from } : d)) }
        : boss,
    ),
  }
}

describe('난이도의 유효 기간', () => {
  it('난이도까지 받으면 그 난이도의 기간도 본다. 시작 전 기간에는 그 난이도만 안 선다', () => {
    setBossCatalog(withLotusExtremeFrom('2026-10-22T10:00'))

    expect(isBossActiveIn('lotus', '2026-10-15')).toBe(true)
    expect(isBossActiveIn('lotus', '2026-10-15', undefined, 'hard')).toBe(true)
    expect(isBossActiveIn('lotus', '2026-10-15', undefined, 'extreme')).toBe(false)
    expect(isBossActiveIn('lotus', '2026-10-22', undefined, 'extreme')).toBe(true)
  })

  // 보스 10-11 ~ 10-23 에 하드만 10-12 ~ 10-21 이면 하드는 후자, 나머지는 전자다. 겹치는 범위가 아니라 덮어쓰기다.
  it('난이도의 기간이 보스의 기간을 칸마다 덮는다. 난이도의 끝이 보스의 끝보다 뒤면 그 난이도만 더 산다', () => {
    const table: BossCatalog = {
      ...INITIAL_BOSS_CATALOG,
      updatedAt: 'x',
      bosses: INITIAL_BOSS_CATALOG.bosses.map((boss) =>
        boss.key === 'lotus'
          ? {
              ...boss,
              from: '2026-10-08',
              until: '2026-10-22',
              difficulties: boss.difficulties.map((d) =>
                d.difficulty === 'hard' ? { ...d, from: '2026-10-15', until: '2026-10-29' } : d.difficulty === 'extreme' ? { ...d, from: '2026-10-15' } : d,
              ),
            }
          : boss,
      ),
    }
    setBossCatalog(table)

    // normal: 보스 기간 그대로 10-08 ~ 10-22
    expect(isBossActiveIn('lotus', '2026-10-08', undefined, 'normal')).toBe(true)
    expect(isBossActiveIn('lotus', '2026-10-22', undefined, 'normal')).toBe(false)
    // hard: 자기 기간 10-15 ~ 10-29. 보스의 끝보다 뒤까지 산다
    expect(isBossActiveIn('lotus', '2026-10-08', undefined, 'hard')).toBe(false)
    expect(isBossActiveIn('lotus', '2026-10-22', undefined, 'hard')).toBe(true)
    expect(isBossActiveIn('lotus', '2026-10-29', undefined, 'hard')).toBe(false)
    // extreme: 시작만 들어 끝은 보스의 10-22 를 물려받는다
    expect(isBossActiveIn('lotus', '2026-10-08', undefined, 'extreme')).toBe(false)
    expect(isBossActiveIn('lotus', '2026-10-15', undefined, 'extreme')).toBe(true)
    expect(isBossActiveIn('lotus', '2026-10-22', undefined, 'extreme')).toBe(false)
    // 보스가 유효한가는 어느 난이도든 유효한가다
    expect(activeDifficultiesOf('lotus', '2026-10-22')).toEqual(['hard'])
    expect(activeBossesInSection('weekly', new Date('2026-10-23T03:00:00+09:00')).map((b) => b.key)).toContain('lotus')
  })

  it('activeDifficultiesOf 는 표 차례로 유효한 난이도만 내고, 보스가 기간 밖이면 비고, 표에 없으면 빈다', () => {
    setBossCatalog(withLotusExtremeFrom('2026-10-22T10:00'))

    expect(activeDifficultiesOf('lotus', '2026-10-15')).toEqual(['normal', 'hard'])
    expect(activeDifficultiesOf('lotus', '2026-10-22')).toEqual(['normal', 'hard', 'extreme'])
    expect(activeDifficultiesOf('nobody', '2026-10-22')).toEqual([])

    setBossCatalog(withMeirinUntil('2026-10-22'))
    expect(activeDifficultiesOf('meirin', '2026-10-22')).toEqual([])
  })

  it('withOwnDifficulty 는 그 행의 난이도를 표 차례 자리에 끼운다', () => {
    expect(withOwnDifficulty(['normal', 'hard'], 'hard')).toEqual(['normal', 'hard'])
    expect(withOwnDifficulty(['normal', 'hard'], 'extreme')).toEqual(['normal', 'hard', 'extreme'])
    expect(withOwnDifficulty(['hard'], 'normal')).toEqual(['normal', 'hard'])
  })

  it('난이도 줄의 from · until 도 파싱하고 모양이 틀리면 표를 거절한다', () => {
    const parsed = parseBossCatalog(withLotusExtremeFrom('2026-10-22T10:00'))
    expect(parsed?.bosses.find((b) => b.key === 'lotus')?.difficulties.find((d) => d.difficulty === 'extreme')).toMatchObject({ from: '2026-10-22T10:00' })
    expect(parseBossCatalog(withLotusExtremeFrom('2026-10-22T10'))).toBeNull()
  })
})

