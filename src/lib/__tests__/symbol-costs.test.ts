// 심볼 강화 비용 표를 읽는 쪽. 표의 모양은 `data/__tests__/symbol-costs.spec.ts` 가 붙든다.
import {
  SYMBOL_COSTS_FROM,
  findSymbol,
  symbolLevelsOf,
  symbolMenu,
  symbolRecordName,
  symbolUpgradeCost,
} from '../cashbook/symbol-costs'

function 심볼(key: string) {
  const found = findSymbol(key)
  if (found === null) throw new Error(`표에 없는 심볼: ${key}`)
  return found.symbol
}

/** 목록을 `묶음: 심볼 key…` 로 접는다. */
function 접기(menu: ReturnType<typeof symbolMenu>): string[] {
  return menu.map((section) => `${section.name}: ${section.symbols.map((each) => each.key).join(' ')}`)
}

describe('symbolUpgradeCost: 여러 단계를 한 번에 올린 비용', () => {
  it('강화 전 레벨의 단계부터 강화 후 바로 앞 단계까지 더한다', () => {
    // 3→4 1,160,000 · 4→5 1,580,000 · 5→6 2,140,000 · 6→7 2,820,000
    expect(symbolUpgradeCost(심볼('road_of_vanishing'), 3, 7)).toBe(7_700_000)
  })

  it('한 단계면 그 칸 하나다', () => {
    expect(symbolUpgradeCost(심볼('cernium'), 1, 2)).toBe(36_500_000)
    expect(symbolUpgradeCost(심볼('geardrak'), 10, 11)).toBe(4_708_000_000)
  })

  it('1 에서 최고 레벨까지는 표 한 줄의 합이다', () => {
    const 여로 = 심볼('road_of_vanishing')
    expect(symbolUpgradeCost(여로, 1, 20)).toBe(여로.costs.reduce((sum, cost) => sum + cost, 0))
  })

  it('두 레벨이 같으면 0 이다. 아직 안 올렸다', () => {
    expect(symbolUpgradeCost(심볼('arcana'), 5, 5)).toBe(0)
  })
})

describe('findSymbol: 기록의 key 로 심볼을 되짚는다', () => {
  it('묶음과 함께 돌려준다. 최고 레벨과 기본 범위는 묶음이 든다', () => {
    const found = findSymbol('cernium')

    expect(found?.symbol.name).toBe('세르니움')
    expect(found?.group.maxLevel).toBe(11)
    expect(found?.group.defaultRange).toEqual([5, 8])
    expect(findSymbol('road_of_vanishing')?.group.defaultRange).toEqual([7, 12])
  })

  it('없는 key 와 빈 key 는 `null` 이다', () => {
    expect(findSymbol('reverse_city')).toBeNull()
    expect(findSymbol(null)).toBeNull()
  })

  it('표는 2026-09-17 부터다. 날짜 고르개의 첫날이 이 값이다', () => {
    expect(SYMBOL_COSTS_FROM).toBe('2026-09-17')
  })
})

describe('symbolMenu: 드롭다운 목록', () => {
  it('캐릭터가 없으면 열넷 전부를 묶음 셋으로 낸다', () => {
    expect(접기(symbolMenu(null))).toEqual([
      '아케인 심볼: road_of_vanishing chew_chew lacheln arcana morass esfera',
      '어센틱 심볼: cernium arcs odium dowonkyung arteria carcion',
      '그랜드 어센틱 심볼: tallahart geardrak',
    ])
  })

  it('착용 레벨이 캐릭터 레벨 이하인 심볼만 낸다. 빈 묶음은 안 선다', () => {
    expect(접기(symbolMenu({ level: 225, symbolLevels: null }))).toEqual([
      '아케인 심볼: road_of_vanishing chew_chew lacheln arcana',
    ])
    expect(접기(symbolMenu({ level: 290, symbolLevels: null }))).toEqual([
      '아케인 심볼: road_of_vanishing chew_chew lacheln arcana morass esfera',
      '어센틱 심볼: cernium arcs odium dowonkyung arteria carcion',
      '그랜드 어센틱 심볼: tallahart',
    ])
  })

  it('캐릭터 레벨을 모르면 거르지 않는다', () => {
    expect(symbolMenu({ level: null, symbolLevels: null }).flatMap((section) => section.symbols)).toHaveLength(14)
  })

  it('만렙인 심볼은 맨 끝 `만렙` 묶음으로 간다. 차례는 표의 차례다', () => {
    const menu = symbolMenu({
      level: 270,
      symbolLevels: { cernium: 11, road_of_vanishing: 20, chew_chew: 19 },
    })

    expect(접기(menu)).toEqual([
      '아케인 심볼: chew_chew lacheln arcana morass esfera',
      '어센틱 심볼: arcs odium',
      '만렙: road_of_vanishing cernium',
    ])
  })

  it('만렙 묶음도 캐릭터 레벨로 거른 뒤의 것이다', () => {
    expect(접기(symbolMenu({ level: 200, symbolLevels: { road_of_vanishing: 20, cernium: 11 } }))).toEqual([
      '만렙: road_of_vanishing',
    ])
  })
})

describe('symbolLevelsOf: 넥슨 응답에서 심볼 key 별 레벨', () => {
  it('이름의 공백을 지우고 표의 이름으로 끝나는지로 맞춘다', () => {
    expect(
      symbolLevelsOf([
        { symbol_name: '아케인심볼 : 소멸의 여로', symbol_level: 20 },
        { symbol_name: '아케인심볼 : 츄츄 아일랜드', symbol_level: 13 },
        { symbol_name: '어센틱심볼 : 세르니움', symbol_level: 11 },
        { symbol_name: '그랜드 어센틱심볼 : 탈라하트', symbol_level: 3 },
      ]),
    ).toEqual({ road_of_vanishing: 20, chew_chew: 13, cernium: 11, tallahart: 3 })
  })

  it('표에 없는 이름과 레벨이 빈 줄은 버린다', () => {
    expect(
      symbolLevelsOf([
        { symbol_name: '아케인심볼 : 어딘가', symbol_level: 5 },
        { symbol_name: '어센틱심볼 : 오디움', symbol_level: null },
        { symbol_name: null, symbol_level: 3 },
      ]),
    ).toEqual({})
  })
})

describe('symbolRecordName: 기록 이름', () => {
  it('지역 이름과 레벨 범위다(사용자 지정)', () => {
    expect(symbolRecordName('소멸의 여로', 3, 7)).toBe('소멸의 여로 Lv.3 → 7')
  })
})
