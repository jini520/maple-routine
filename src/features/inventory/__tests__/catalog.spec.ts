import { itemsTable } from '../../../lib/item-catalog'
import { catalogMatches, inventoryCatalog } from '../catalog'

const 표 = itemsTable.get()

afterEach(() => {
  itemsTable.set(표)
})

describe('inventoryCatalog', () => {
  it('아이템 표에서 상자 묶음을 빼고, 장신구는 장비로 세운다', () => {
    itemsTable.set({
      updatedAt: null,
      items: [
        { key: 'longing_eternel_armor_box', name: '갈망의 에테르넬 방어구 상자', kind: 'consumable', category: 'box' },
        { key: 'daybreak_pendant', name: '데이브레이크 펜던트', kind: 'accessory', category: 'dawn_boss_set' },
        { key: 'arcane_umbra_guards', name: '아케인셰이드 가즈', kind: 'equipment', category: 'arcane_weapon' },
        { key: 'soul_ether_1', name: '1단계 소울 에테르', kind: 'consumable', category: 'boss_loot' },
      ],
    })

    expect(inventoryCatalog().map((item) => [item.key, item.kind])).toEqual([
      ['daybreak_pendant', 'equipment'],
      ['arcane_umbra_guards', 'equipment'],
      ['soul_ether_1', 'consumable'],
    ])
  })

  // 서버 분류 트리에 종류가 늘어도 앱이 모르는 종류는 어느 탭에도 세울 수 없어 뺀다.
  it('가계부 아이템 종류로 옮길 수 없는 종류의 아이템은 뺀다', () => {
    itemsTable.set({
      updatedAt: null,
      items: [{ key: 'pet_food', name: '펫 먹이', kind: 'pet', category: 'pet_food' }],
    })

    expect(inventoryCatalog()).toEqual([])
  })

  it('운영 아이템 표에서 고른 종류의 아이템을 친 글자로 찾는다', () => {
    const 찾은것 = catalogMatches(inventoryCatalog(), 'consumable', '1에르')

    expect(찾은것.map((item) => item.name)).toContain('1단계 소울 에테르')
    expect(catalogMatches(inventoryCatalog(), 'equipment', '1에르').map((item) => item.name)).not.toContain(
      '1단계 소울 에테르',
    )
  })
})
