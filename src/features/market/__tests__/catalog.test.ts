import { byPriceDesc, initialWorldKey, marketItemFace, openWorlds } from '../catalog'

describe('marketItemFace', () => {
  it('이름과 그림은 게임 데이터의 아이템 표에서 찾고, 반지는 이름 뒤에 레벨을 붙인다', () => {
    expect(marketItemFace('restraint_ring', 4)).toEqual({ name: '리스트레인트 링 4레벨', iconAssetId: expect.any(String) })
    expect(marketItemFace('magic_eyepatch', null)).toMatchObject({ name: '마력이 깃든 안대' })
  })

  it('앱이 모르는 아이템은 이름 자리에 아이템 key 이고 그림이 없다', () => {
    expect(marketItemFace('brand_new_item', null)).toEqual({ name: 'brand_new_item', iconAssetId: null })
  })
})

describe('byPriceDesc', () => {
  it('기준가가 높은 시세부터 세우고, 같으면 보이는 이름의 가나다 차례다', () => {
    const 줄 = (itemKey: string, price: number) => ({ itemKey, ringLevel: null, price })
    const sorted = [줄('life_whetstone', 7), 줄('magic_eyepatch', 26), 줄('restraint_ring', 33), 줄('faith_whetstone', 26)].sort(byPriceDesc)

    // 마력이 깃든 안대 · 신념의 연마석이 26 으로 같아 이름 차례다.
    expect(sorted.map((entry) => entry.itemKey)).toEqual(['restraint_ring', 'magic_eyepatch', 'faith_whetstone', 'life_whetstone'])
  })
})

describe('월드 고르개', () => {
  it('지금 열린 월드만 게임 데이터 차례로 넣고, 닫힌 이벤트 월드는 뺀다', () => {
    const keys = openWorlds('2026-11-16').map((world) => world.key)

    expect(keys).toHaveLength(18)
    expect(keys.slice(0, 2)).toEqual(['scania', 'bera'])
    expect(keys).not.toContain('special')
    // 열려 있던 날에는 이벤트 월드도 고를 수 있다.
    expect(openWorlds('2025-12-01').map((world) => world.key)).toContain('special')
  })

  it('처음 값은 대표 캐릭터의 월드이고, 대표 캐릭터가 없거나 고르개에 없는 월드면 첫 월드다', () => {
    const open = openWorlds('2026-11-16')

    expect(initialWorldKey(open, 'eos')).toBe('eos')
    expect(initialWorldKey(open, null)).toBe('scania')
    expect(initialWorldKey(open, 'special')).toBe('scania')
    expect(initialWorldKey([], 'eos')).toBeNull()
  })
})
