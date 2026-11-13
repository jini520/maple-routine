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

  it('데스티니 무기 · 제네시스 무기 · 아스트라 보조무기를 빼고, 아스트라가 아닌 보조무기는 남긴다', () => {
    itemsTable.set({
      updatedAt: null,
      items: [
        { key: 'destiny_guard', name: '데스티니 가즈', kind: 'equipment', category: 'destiny_weapon' },
        { key: 'genesis_guard', name: '제네시스 가즈', kind: 'equipment', category: 'genesis_weapon' },
        { key: 'astra_orb', name: '아스트라 오브', kind: 'equipment', category: 'secondary_weapon' },
        { key: 'green_soul_ring', name: '그린 소울링', kind: 'equipment', category: 'secondary_weapon' },
      ],
    })

    expect(inventoryCatalog().map((item) => item.key)).toEqual(['green_soul_ring'])
  })

  // 레벨을 고르는 칸 없이 목록에서 레벨째 고른다. 높은 레벨부터 선다.
  it('특수스킬 반지는 레벨마다 한 줄로, 높은 레벨부터 이름 뒤에 Lv.N 을 붙여 서고 줄마다 레벨을 든다', () => {
    itemsTable.set({
      updatedAt: null,
      items: [{ key: 'risk_taker_ring', name: '리스크테이커 링', kind: 'accessory', category: 'special_skill_ring' }],
    })

    expect(inventoryCatalog().map((item) => [item.key, item.itemKey, item.name, item.ringLevel])).toEqual([
      ['risk_taker_ring@4', 'risk_taker_ring', '리스크테이커 링 Lv.4', 4],
      ['risk_taker_ring@3', 'risk_taker_ring', '리스크테이커 링 Lv.3', 3],
      ['risk_taker_ring@2', 'risk_taker_ring', '리스크테이커 링 Lv.2', 2],
      ['risk_taker_ring@1', 'risk_taker_ring', '리스크테이커 링 Lv.1', 1],
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

  it('운영 아이템 표에서 종류를 가리지 않고 친 글자로 찾고, 찾은 아이템은 제 종류를 든다', () => {
    const 찾은것 = catalogMatches(inventoryCatalog(), '1에르')
    const 반지 = catalogMatches(inventoryCatalog(), '리스크테이커4')

    expect(찾은것.find((item) => item.name === '1단계 소울 에테르')?.kind).toBe('consumable')
    expect(반지.map((item) => [item.name, item.kind])).toEqual([['리스크테이커 링 Lv.4', 'equipment']])
  })
})
