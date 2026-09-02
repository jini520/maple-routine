import {
  HUNTING_LEVEL_BELOW,
  HUNTING_REGIONS,
  findHuntingGround,
  findHuntingRegion,
  huntingGroundsFor,
  huntingRegionsForLevel,
  levelGapOf,
  monsterLevelRangeOf,
} from '../cashbook/hunting-grounds'

describe('monsterLevelRangeOf', () => {
  /**
   * **지역의 범위는 사냥터에 등장하는 몬스터 레벨이 정한다**(사용자 지정
   * 2026-08-28). 참조표가 적어 둔 `minLevel`·`maxLevel` 은 **추천 레벨**이라 이것과 다르다.
   */
  it('그 지역 사냥터의 몬스터 레벨을 훑어 낸다', () => {
    expect(monsterLevelRangeOf(findHuntingRegion('tallahart')!)).toEqual({ min: 290, max: 294 })
  })

  it('추천 레벨과 **다를 수 있다**. 리버스 시티는 209 까지라 적혀 있지만 몬스터가 213 까지다', () => {
    const reverseCity = findHuntingRegion('reverseCity')!
    expect([reverseCity.minLevel, reverseCity.maxLevel]).toEqual([205, 209])
    expect(monsterLevelRangeOf(reverseCity)).toEqual({ min: 205, max: 213 })
  })
})

describe('huntingRegionsForLevel', () => {
  const 이름들 = (level: number | null): string[] =>
    huntingRegionsForLevel(level).map((each) => each.name)

  it('캐릭터 레벨을 모르면 **전부** 선다. 고르개가 `선택 안함` 인 상태다', () => {
    expect(huntingRegionsForLevel(null)).toHaveLength(HUNTING_REGIONS.length)
  })

  /**
   * **캐릭터 레벨보다 높은 지역에는 못 간다**(사용자 지정 2026-08-28). 창이 위아래 ±20 이 아니라
   * 아래로 20 ~ 갈 수 있는 데까지 인 이유다. 갈 수 없는 자리를 목록에 세우면 고를 수 있는 것처럼
   * 보인다.
   */
  describe('위쪽. 갈 수 있는 데까지', () => {
    it('lv.277 은 도원경까지다. 아르테리아는 못 간다', () => {
      const names = 이름들(277)
      // 도원경 몬스터 275-279 → 275 ≤ 277 이라 들어갈 수 있다.
      expect(names).toContain('도원경')
      // 아르테리아 몬스터 280-284 → 280 > 277 이라 못 간다.
      expect(names).not.toContain('아르테리아')
      expect(names).not.toContain('탈라하트')
    })

    it('경계는 **포함**이다. 그 지역 최저 몬스터와 레벨이 같으면 간다', () => {
      expect(이름들(295)).toContain('기어드락') // 기어드락 최저 295
      expect(이름들(294)).not.toContain('기어드락')
    })
  })

  /**
   * 아래로는 20 이다. 그보다 낮은 지역은 페널티가 커져 갈 이유가 없다.
   */
  describe('아래쪽. 20 까지', () => {
    it('lv.277 에게 고통의 미궁(255-259)은 서고 문브릿지(250-254)는 안 선다', () => {
      const names = 이름들(277)
      expect(names).toContain('고통의 미궁') // 최고 259 ≥ 257
      expect(names).not.toContain('문브릿지') // 최고 254 < 257
    })

    it('재는 것은 그 지역의 **가장 높은** 몬스터다. 한 맵이라도 걸리면 선다', () => {
      // 리버스 시티는 몬스터가 205-213 이다. lv.230 의 바닥은 210 이라 `숨겨진 M타워`(213)가
      // 걸려 지역이 선다. 추천 레벨(205-209)로 재면 통째로 빠지던 자리다.
      expect(이름들(230)).toContain('리버스 시티')
      expect(이름들(234)).not.toContain('리버스 시티') // 바닥 214 > 213
    })

    it('창 폭은 20 이다', () => {
      expect(HUNTING_LEVEL_BELOW).toBe(20)
    })
  })

  it('lv.213 은 리버스 시티에서 가장 잘 잡는다. 그 지역이 목록에 선다', () => {
    // 사용자가 든 예시다(2026-08-28): 추천 레벨은 205-209 지만 몬스터가 213 까지라
    // 213 짜리 캐릭터에게 효율이 가장 좋다.
    expect(이름들(213)).toEqual(['소멸의 여로', '리버스 시티', '츄츄 아일랜드'])
  })

  it('차례는 참조표에 적힌 그대로다. 이름순으로 정렬하지 않는다', () => {
    const 순서 = HUNTING_REGIONS.map((each) => each.name)
    const 골라낸것 = 이름들(260)
    expect(골라낸것).toEqual(순서.filter((name) => 골라낸것.includes(name)))
  })

  it('레벨이 아주 낮으면 갈 수 있는 데가 없어 빈 목록이다', () => {
    expect(huntingRegionsForLevel(10)).toEqual([])
  })
})

/**
 * 사냥터 차례. **레벨 차이가 적은 순, 같으면 마릿수가 많은 순**(사용자 지정 2026-08-28).
 *
 * 참조표에 적힌 순서를 그대로 쓰면 지금 내가 갈 만한 곳 이 목록 한가운데 묻힌다. 고르는 사람이
 * 실제로 재는 두 값이 이 둘이라 그대로 차례로 삼는다.
 */
describe('huntingGroundsFor', () => {
  const 오디움 = findHuntingRegion('odium')!

  it('레벨 차이가 적은 것이 먼저, 같으면 마릿수가 많은 것이 먼저다', () => {
    expect(huntingGroundsFor(오디움, 274).map((each) => each.name)).toEqual([
      // 차이 0. 둘 다 39마리라 참조표 순서를 지킨다
      '잠긴 문 뒤 실험실 3',
      '잠긴 문 뒤 실험실 4',
      // 차이 0.5. 레벨이 둘인 맵(273·274)이라 차이도 둘의 평균이다
      '잠긴 문 뒤 실험실 2',
      '잠긴 문 뒤 실험실 1', // 차이 1
      // 차이 2. 39·39·34 순으로 마릿수가 가른다(참조표에서는 34 가 먼저였다)
      '볕 드는 실험실 2',
      '볕 드는 실험실 3',
      '볕 드는 실험실 1',
      // 차이 3
      '점령당한 골목 3',
      '점령당한 골목 4',
      '점령당한 골목 1',
      '점령당한 골목 2',
      // 차이 4. 39·39·37·34·34
      '성문으로 가는 길 4',
      '성문으로 가는 길 5',
      '성문으로 가는 길 3',
      '성문으로 가는 길 1',
      '성문으로 가는 길 2',
    ])
  })

  it('캐릭터를 안 고르면 **마릿수 많은 순**이다. 차이가 다 **모름** 이라 동률이다', () => {
    const 차례 = huntingGroundsFor(오디움, null)
    expect(차례.map((each) => each.mobs)).toEqual([...차례.map((each) => each.mobs)].sort((a, b) => b - a))
    // 동률(같은 마릿수)끼리는 참조표 순서를 지킨다. 39마리 일곱이 그 순서다.
    expect(차례.slice(0, 2).map((each) => each.name)).toEqual([
      '성문으로 가는 길 4',
      '성문으로 가는 길 5',
    ])
  })

  it('참조표를 **안 건드린다**. 정렬이 원본 배열을 뒤집으면 다음 호출이 달라진다', () => {
    const 원본 = 오디움.grounds.map((each) => each.name)
    huntingGroundsFor(오디움, 274)
    expect(오디움.grounds.map((each) => each.name)).toEqual(원본)
  })

  it('빠뜨리는 사냥터가 없다. 거르는 것이 아니라 **줄 세우는** 것이다', () => {
    for (const region of HUNTING_REGIONS) {
      expect(huntingGroundsFor(region, 260)).toHaveLength(region.grounds.length)
    }
  })
})

describe('levelGapOf', () => {
  it('레벨이 하나면 그냥 차이다', () => {
    expect(levelGapOf({ name: '', force: 0, mobs: 0, levels: [270] }, 274)).toBe(4)
  })

  /**
   * 레벨이 둘이면 **레벨마다 재서 평균**낸다. 가 메소에 쓰는 그 방식이다.
   * 평균 레벨로 접는 것과는 캐릭터가 두 레벨 **사이**에 있을 때 갈린다(217·219 와 218).
   */
  it('레벨이 둘이면 레벨마다 재서 평균낸다', () => {
    expect(levelGapOf({ name: '', force: 0, mobs: 0, levels: [273, 274] }, 274)).toBe(0.5)
    expect(levelGapOf({ name: '', force: 0, mobs: 0, levels: [217, 219] }, 218)).toBe(1)
  })
})

describe('findHuntingRegion', () => {
  it('슬러그로 찾는다', () => {
    expect(findHuntingRegion('tallahart')?.name).toBe('탈라하트')
  })

  it('없으면 `null` 이다. 던지지 않는다', () => {
    expect(findHuntingRegion('없는지역')).toBeNull()
  })
})

describe('findHuntingGround', () => {
  it('이름 하나로 **사냥터와 지역이 함께** 나온다. 기록이 지역을 안 적는 이유다', () => {
    const found = findHuntingGround('밤의 길 3')
    expect(found?.region.name).toBe('탈라하트')
    expect(found?.ground).toEqual({ name: '밤의 길 3', force: 700, mobs: 40, levels: [294] })
  })

  it('옛 기록의 자유 입력 글자는 안 잡힌다. `null` 이고, 그때는 계산기가 안 선다', () => {
    expect(findHuntingGround('아무 데나 적은 글자')).toBeNull()
    expect(findHuntingGround('')).toBeNull()
  })
})
