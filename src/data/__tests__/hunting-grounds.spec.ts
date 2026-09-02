import huntingGrounds from '../hunting-grounds.json'

const REGIONS = huntingGrounds.regions
const GROUNDS = REGIONS.flatMap((region) => region.grounds)

describe('사냥터 참조표 정합성', () => {
  it('지역 21개 · 사냥터 408개. 사용자가 준 그대로다', () => {
    expect(REGIONS).toHaveLength(21)
    expect(GROUNDS).toHaveLength(408)
  })

  it('묶음은 둘이고 차례는 아케인 리버 다음 그란디스다', () => {
    const groups = [...new Set(REGIONS.map((region) => region.group))]
    expect(groups).toEqual(['아케인 리버', '그란디스'])
  })

  it('묶음이 포스 종류를 정한다. 섞이지 않는다', () => {
    for (const region of REGIONS) {
      expect(region.forceType).toBe(region.group === '아케인 리버' ? 'arcane' : 'authentic')
    }
  })

  it('**사냥터 이름은 전역 유일**하다. 기록이 지역을 안 적는 근거다', () => {
    const names = GROUNDS.map((ground) => ground.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('지역 슬러그도 유일하다', () => {
    const slugs = REGIONS.map((region) => region.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('지역 레벨 범위는 뒤집혀 있지 않다', () => {
    for (const region of REGIONS) {
      expect(region.minLevel).toBeLessThanOrEqual(region.maxLevel)
    }
  })

  it('빈 지역이 없다', () => {
    for (const region of REGIONS) {
      expect(region.grounds.length).toBeGreaterThan(0)
    }
  })

  it('사냥터의 수치 셋은 전부 양의 정수다', () => {
    for (const ground of GROUNDS) {
      expect(Number.isInteger(ground.force)).toBe(true)
      expect(ground.force).toBeGreaterThan(0)
      expect(Number.isInteger(ground.mobs)).toBe(true)
      expect(ground.mobs).toBeGreaterThan(0)
    }
  })

  it('몬스터 레벨은 **하나 아니면 둘**이고 오름차순이다', () => {
    for (const ground of GROUNDS) {
      expect(ground.levels.length).toBeGreaterThanOrEqual(1)
      expect(ground.levels.length).toBeLessThanOrEqual(2)
      expect([...ground.levels].sort((a, b) => a - b)).toEqual(ground.levels)
      for (const level of ground.levels) {
        expect(Number.isInteger(level)).toBe(true)
        expect(level).toBeGreaterThan(0)
      }
    }
  })

  it('레벨이 둘인 맵은 52개다. `lv.200-201` 과 `lv.217,219` 를 접지 않았다는 뜻이다', () => {
    expect(GROUNDS.filter((ground) => ground.levels.length === 2)).toHaveLength(52)
  })

  /**
   * `minLevel`·`maxLevel` 은 **추천 캐릭터 레벨**이고 그 안의 몬스터 레벨과 다를 수 있다
   * 목록을 거르는 근거는 몬스터 쪽이다(`lib/cashbook/hunting-grounds.ts`).
   */
  it('앞의 둘은 **정정된 범위**다. 상한 290 은 오기였다 (사용자 정정 2026-08-28)', () => {
    const byName = (name: string) => REGIONS.find((region) => region.name === name)
    expect(byName('소멸의 여로')).toMatchObject({ minLevel: 200, maxLevel: 209 })
    expect(byName('리버스 시티')).toMatchObject({ minLevel: 205, maxLevel: 209 })
  })

  it('`세 갈래길 1` 은 **30마리**다. 15 는 오기였다 (사용자 정정 2026-08-28)', () => {
    // 바로 옆 `세 갈래길 2` 가 30마리인데 `1` 만 15 로 적혀 있었다. 원문을 옮길 때 섞인 값이고,
    // 사용자가 30 으로 확정했다(앱이 추정해 고친 것이 아니다).
    const 소멸의여로 = REGIONS.find((region) => region.name === '소멸의 여로')!
    const 셋 = 소멸의여로.grounds.filter((ground) => ground.name.startsWith('세 갈래길'))
    expect(셋.map((ground) => ground.mobs)).toEqual([30, 30])
  })

  it('마릿수는 **22~40** 이다. 효율 조각이 안 겹치는 근거이자 문서가 든 예시다', () => {
    const counts = GROUNDS.map((ground) => ground.mobs)
    expect(Math.min(...counts)).toBe(22)
    expect(Math.max(...counts)).toBe(40)
  })

  it('추천 레벨과 몬스터 레벨은 **다를 수 있다**. 리버스 시티가 그렇다', () => {
    const reverseCity = REGIONS.find((region) => region.name === '리버스 시티')!
    const levels = reverseCity.grounds.flatMap((ground) => ground.levels)
    // 추천은 209 까지인데 `숨겨진 M타워`·`숨겨진 지하열차` 몬스터가 213 까지 있다.
    expect(reverseCity.maxLevel).toBe(209)
    expect(Math.max(...levels)).toBe(213)
  })

  /**
   * 효율 조각 다섯은 **맵의 마릿수에서 나온다**. 두 조각이 같은 %로
   * 반올림되면 세그먼트가 어느 것을 고른 것인지 못 가린다. 마릿수가 아주 커지면(≥ 200) 실제로
   * 겹치므로, 데이터가 그 방향으로 자라면 여기서 먼저 걸린다.
   */
  it('어느 맵에서도 효율 조각 다섯이 **안 겹친다**', () => {
    for (const ground of GROUNDS) {
      const labels = [0, 1, 2, 3, 4].map((missed) =>
        Math.round(((ground.mobs - missed) / ground.mobs) * 100),
      )
      expect(new Set(labels).size).toBe(5)
    }
  })

  it('사용자가 예시로 준 줄이 그대로 있다', () => {
    const tallahart = REGIONS.find((region) => region.name === '탈라하트')
    expect(tallahart?.grounds).toContainEqual({
      name: '밤의 길 3',
      force: 700,
      mobs: 40,
      levels: [294],
    })
  })
})
