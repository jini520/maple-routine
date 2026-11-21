import { bossDifficultyIdOf } from '../boss/bosses'
import { dropItemIdOf, dropItemPartsOf, onlyBoxOriginOf } from '../boss/drop-item-ids'
import { findItem, findItemById } from '../item-catalog'

const PERIOD = '2026-11-19'
const keyOf = (id: string | null) => (id === null ? null : findItemById(id)?.key)

describe('드롭 칸 셋의 아이템 줄 id', () => {
  // 레벨이 다른 반지는 시세도 다르고 인벤토리에서도 따로 세는 다른 물건이라 아이템 줄이 따로다.
  it('레벨이 있는 반지는 레벨 줄이고, 표에 없는 레벨은 null 이다', () => {
    expect(keyOf(dropItemIdOf({ itemKey: 'restraint_ring', ringLevel: 4, boxOriginKey: 'white_boss_ring_box' }))).toBe(
      'restraint_ring_lv4',
    )
    expect(dropItemIdOf({ itemKey: 'restraint_ring', ringLevel: 9, boxOriginKey: 'white_boss_ring_box' })).toBeNull()
  })

  // 상자를 적지 않으므로 직접 떨군 연마석과 상자에서 나온 연마석을 가를 것이 아이템 줄뿐이다.
  it('상자에서 나온 연마석은 상자용 줄이고, 직접 떨군 연마석은 원래 줄이다', () => {
    expect(keyOf(dropItemIdOf({ itemKey: 'life_whetstone', ringLevel: null, boxOriginKey: 'life_boss_ring_box' }))).toBe(
      'life_whetstone_from_box',
    )
    expect(keyOf(dropItemIdOf({ itemKey: 'life_whetstone', ringLevel: null, boxOriginKey: null }))).toBe('life_whetstone')
  })

  it('표에 없는 아이템 key 는 null 이다', () => {
    expect(dropItemIdOf({ itemKey: 'other_ring', ringLevel: null, boxOriginKey: null })).toBeNull()
  })
})

describe('아이템 줄 id 를 칸 셋으로', () => {
  const kalosChaos = bossDifficultyIdOf('guardian_kalos', 'chaos')!

  // 직접도 떨구고 상자로도 주는 난이도라 아이템 줄로만 두 드롭이 갈린다.
  it('상자용 연마석은 그 난이도가 주는 상자로, 원래 연마석은 보스가 직접 떨군 것으로 되짚는다', () => {
    expect(dropItemPartsOf(findItem('life_whetstone_from_box')!.id, kalosChaos, PERIOD)).toEqual({
      itemKey: 'life_whetstone',
      ringLevel: null,
      boxOriginKey: 'life_boss_ring_box',
    })
    expect(dropItemPartsOf(findItem('life_whetstone')!.id, kalosChaos, PERIOD)).toEqual({
      itemKey: 'life_whetstone',
      ringLevel: null,
      boxOriginKey: null,
    })
  })

  // 반지 레벨 줄은 상자에서만 나온다. 상자는 난이도마다 달라 같은 레벨 줄도 난이도에 따라 다른 상자로 되짚는다.
  it('반지 레벨 줄은 원래 반지와 레벨, 그 난이도가 주는 반지 상자로 되짚는다', () => {
    const levelFour = findItem('restraint_ring_lv4')!.id

    expect(dropItemPartsOf(levelFour, kalosChaos, PERIOD)).toEqual({
      itemKey: 'restraint_ring',
      ringLevel: 4,
      boxOriginKey: 'life_boss_ring_box',
    })
    expect(dropItemPartsOf(levelFour, bossDifficultyIdOf('guardian_kalos', 'normal')!, PERIOD)?.boxOriginKey).toBe(
      'white_boss_ring_box',
    )
  })

  // 칸 셋으로 적은 기록이 줄 id 를 거쳐 다른 칸 셋으로 돌아오면 같은 드롭이 다른 물건으로 보인다.
  it('칸 셋을 줄 id 로 바꿨다가 되짚으면 그대로다', () => {
    const drops = [
      { itemKey: 'restraint_ring', ringLevel: 3, boxOriginKey: 'life_boss_ring_box' },
      { itemKey: 'life_whetstone', ringLevel: null, boxOriginKey: 'life_boss_ring_box' },
      { itemKey: 'life_whetstone', ringLevel: null, boxOriginKey: null },
    ]

    expect(drops.map((drop) => dropItemPartsOf(dropItemIdOf(drop)!, kalosChaos, PERIOD))).toEqual(drops)
  })
})

// 1.0.13 앱은 상자에서 나온 연마석도 상자 칸 없이 올렸다. 상자로만 주는 난이도의 연마석은 상자 줄이 맞다.
describe('상자로만 주는 아이템', () => {
  it('직접 주지 않고 상자로만 주면 그 상자이고, 직접도 주면 null 이다', () => {
    expect(onlyBoxOriginOf('life_whetstone', bossDifficultyIdOf('kaling', 'hard')!, PERIOD)).toBe('life_boss_ring_box')
    expect(onlyBoxOriginOf('life_whetstone', bossDifficultyIdOf('guardian_kalos', 'chaos')!, PERIOD)).toBeNull()
  })
})
