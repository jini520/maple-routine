import type { DropCategory } from '../../types/drops'
import { bossDifficultyIdOf } from '../boss/bosses'
import { dropItemIdOf, dropItemPartsOf, isObtainableDrop, onlyBoxOriginOf, planClearedDrops } from '../boss/drop-item-ids'
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

describe('처치한 수익 건으로 모으기', () => {
  const id = (key: string) => findItem(key)!.id
  const kalos = (difficulty: string) => bossDifficultyIdOf('guardian_kalos', difficulty)!
  const bellona = (difficulty: string) => bossDifficultyIdOf('bellona', difficulty)!
  const drop = (dropId: string, key: string, bossDifficultyId: string, category: DropCategory = 'consumable') => ({
    id: dropId,
    itemId: id(key),
    category,
    bossDifficultyId,
  })

  // 서버 sync/push.repository.spec.ts 의 처치 난이도 묶음과 같은 세 예다. 기기와 서버의 규칙이 다르면 받기가 기기가 먼저 고친 값을
  // 되돌린다.
  it('처치한 난이도에서도 얻는 반지는 남기고, 못 얻는 반지는 지우고, 다른 경로로만 얻는 연마석은 상자용 줄로 바꾼다', () => {
    expect(
      planClearedDrops(kalos('chaos'), PERIOD, [
        drop('restraint', 'restraint_ring_lv4', kalos('normal')),
        drop('ultimatum', 'ultimatum_ring_lv4', kalos('normal')),
      ]),
    ).toEqual({ keep: [{ id: 'restraint', itemId: id('restraint_ring_lv4') }], remove: ['ultimatum'] })
    expect(planClearedDrops(bellona('hard'), PERIOD, [drop('whetstone', 'life_whetstone', bellona('normal'))])).toEqual({
      keep: [{ id: 'whetstone', itemId: id('life_whetstone_from_box') }],
      remove: [],
    })
  })

  // 감시자 칼로스 카오스는 연마석을 직접도 떨구고 상자로도 준다. 벨로나 노말은 직접만 준다.
  it('두 경로가 다 있으면 적힌 줄을 두고, 직접만 주는 난이도의 상자용 연마석은 원래 줄로 바꾼다', () => {
    expect(
      planClearedDrops(kalos('chaos'), PERIOD, [
        drop('direct', 'life_whetstone', kalos('chaos')),
        drop('boxed', 'life_whetstone_from_box', kalos('chaos')),
      ]),
    ).toEqual({
      keep: [
        { id: 'boxed', itemId: id('life_whetstone_from_box') },
        { id: 'direct', itemId: id('life_whetstone') },
      ],
      remove: [],
    })
    expect(planClearedDrops(bellona('normal'), PERIOD, [drop('boxed', 'life_whetstone_from_box', bellona('hard'))])).toEqual({
      keep: [{ id: 'boxed', itemId: id('life_whetstone') }],
      remove: [],
    })
  })

  // 드롭 시트는 상자 하나에 결과를 하나만 둔다. 같은 상자의 결과가 둘이면 하나는 먹은 것이 아니고 금액만 두 번 센다.
  it('처치한 수익 건에 있던 드롭이 먼저 남고, 같은 아이템이나 같은 상자로 옮겨 오는 드롭은 지운다', () => {
    expect(
      planClearedDrops(kalos('chaos'), PERIOD, [
        drop('moved-ring', 'restraint_ring_lv4', kalos('normal')),
        drop('moved-whetstone', 'life_whetstone', kalos('normal')),
        drop('kept-ring', 'continuous_ring_lv3', kalos('chaos')),
        drop('kept-whetstone', 'life_whetstone', kalos('chaos')),
      ]),
    ).toEqual({
      keep: [
        { id: 'kept-ring', itemId: id('continuous_ring_lv3') },
        { id: 'kept-whetstone', itemId: id('life_whetstone') },
      ],
      remove: ['moved-ring', 'moved-whetstone'],
    })
  })

  // 서버와 기기가 같은 드롭을 남기려면 둘 다 가진 값으로 차례를 정해야 한다. 드롭 시트의 차례는 기기에만 있다.
  it('옮겨 오는 드롭끼리 겹치면 난이도 차례로, 같은 수익 건 안에서는 드롭 id 차례로 앞선 것이 남는다', () => {
    expect(
      planClearedDrops(kalos('chaos'), PERIOD, [
        drop('b', 'restraint_ring_lv4', kalos('normal')),
        drop('c', 'continuous_ring_lv4', kalos('easy')),
        drop('a', 'restraint_ring_lv3', kalos('easy')),
      ]),
    ).toEqual({ keep: [{ id: 'a', itemId: id('restraint_ring_lv3') }], remove: ['c', 'b'] })
  })

  // 2026-09-17 패치는 오전 10시이고 그 주는 00:00 에 열린다. 그 열 시간에 먹은 교환권을 지우면 안 된다.
  it('드롭 표 줄의 기간은 그 기간 어느 때라도 유효했으면 든 것으로 본다', () => {
    const voucher = (periodKey: string) =>
      planClearedDrops(kalos('chaos'), periodKey, [drop('voucher', 'magical_weapon_scroll_voucher', kalos('normal'))])

    expect(voucher('2026-09-17')).toEqual({ keep: [{ id: 'voucher', itemId: id('magical_weapon_scroll_voucher') }], remove: [] })
    expect(voucher('2026-09-24')).toEqual({ keep: [], remove: ['voucher'] })
  })

  it('고정 보상으로 적힌 옛 기록은 처치한 난이도가 주지 않아도 둔다', () => {
    expect(planClearedDrops(kalos('chaos'), PERIOD, [drop('fixed', 'lingering_kalos_will_fragment', kalos('normal'), 'fixed')])).toEqual({
      keep: [{ id: 'fixed', itemId: id('lingering_kalos_will_fragment') }],
      remove: [],
    })
  })

  // 게임 데이터를 받기 전에 가리면 모든 드롭이 못 얻는 것으로 지워진다. 그런 드롭은 서버가 맞춘 결과가 받기로 온다.
  it('드롭 표에 처치한 난이도 줄이 없으면 null 이고, 아이템 표에 없는 아이템 줄의 드롭은 남기지도 지우지도 않는다', () => {
    expect(planClearedDrops('no-such-difficulty', PERIOD, [drop('ring', 'restraint_ring_lv4', kalos('normal'))])).toBeNull()
    expect(
      planClearedDrops(kalos('chaos'), PERIOD, [{ id: 'unknown', itemId: 'no-such-item', category: 'consumable', bossDifficultyId: kalos('normal') }]),
    ).toEqual({ keep: [], remove: [] })
  })
})

describe('처치한 난이도에서 얻을 수 있는 기록', () => {
  const record = (itemKey: string, boxOriginKey: string | null, ringLevel?: number) => ({
    dropRecordId: null,
    category: 'consumable' as const,
    itemKey,
    itemName: itemKey,
    boxOriginKey,
    ringLevel,
    quantity: 1,
  })

  // 히스토리가 보스 수익 화면과 같은 기록을 보여야 한다. 화면은 같은 물건의 다른 줄로 바꿔 남기는 기록을 히스토리가 숨기면 안 된다.
  it('아이템으로 가리고, 같은 물건의 다른 줄로 얻을 수 있으면 얻을 수 있다', () => {
    expect(isObtainableDrop('guardian_kalos', 'chaos', PERIOD, record('restraint_ring', 'life_boss_ring_box', 4))).toBe(true)
    expect(isObtainableDrop('guardian_kalos', 'chaos', PERIOD, record('ultimatum_ring', null, 4))).toBe(false)
    expect(isObtainableDrop('bellona', 'hard', PERIOD, record('life_whetstone', null))).toBe(true)
  })

  it('고정 기록과 key 가 없는 옛 기록은 판정하지 않고 얻을 수 있다고 본다', () => {
    expect(isObtainableDrop('guardian_kalos', 'chaos', PERIOD, { ...record('spell_trace', null), category: 'fixed' })).toBe(true)
    expect(isObtainableDrop('guardian_kalos', 'chaos', PERIOD, { ...record('x', null), itemKey: null })).toBe(true)
  })
})
