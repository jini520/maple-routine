import { itemsTable } from '../../../lib/item-catalog'
import type { ItemsTable } from '../../../types/game-data'
import { catalogMatches, inventoryCatalog } from '../catalog'

const 표 = itemsTable.get()

/** 줄마다 key · 이름 · 묶음 종류 · 묶음 key 로 세운 아이템 표. 줄 id 는 key 를 그대로 쓴다. */
function 아이템표(rows: [key: string, name: string, type: string, group: string][], extra: Partial<ItemsTable> = {}): ItemsTable {
  const groups = [...new Map(rows.map(([, , type, group]) => [group, type]))]
  return {
    updatedAt: null,
    items: rows.map(([key, name, , group]) => ({
      id: key,
      key,
      name,
      groupId: group,
      isDrop: false,
      isValuable: false,
      isEquipment: false,
    })),
    itemGroups: groups.map(([group, type], sortOrder) => ({ id: group, key: group, name: group, type, sortOrder })),
    ringLevelItems: [],
    sameItemLinks: [],
    ...extra,
  }
}

afterEach(() => {
  itemsTable.set(표)
})

describe('inventoryCatalog', () => {
  it('아이템 표에서 상자 묶음을 빼고, 장신구는 장비로 세운다', () => {
    itemsTable.set(
      아이템표([
        ['longing_eternel_armor_box', '갈망의 에테르넬 방어구 상자', 'consumable', 'box'],
        ['daybreak_pendant', '데이브레이크 펜던트', 'accessory', 'dawn_boss_set'],
        ['arcane_umbra_guards', '아케인셰이드 가즈', 'equipment', 'arcane_weapon'],
        ['soul_ether_1', '1단계 소울 에테르', 'consumable', 'boss_loot'],
      ]),
    )

    expect(inventoryCatalog().map((item) => [item.key, item.kind])).toEqual([
      ['daybreak_pendant', 'equipment'],
      ['arcane_umbra_guards', 'equipment'],
      ['soul_ether_1', 'consumable'],
    ])
  })

  it('데스티니 무기 · 제네시스 무기 · 아스트라 보조무기를 빼고, 아스트라가 아닌 보조무기는 남긴다', () => {
    itemsTable.set(
      아이템표([
        ['destiny_guard', '데스티니 가즈', 'equipment', 'destiny_weapon'],
        ['genesis_guard', '제네시스 가즈', 'equipment', 'genesis_weapon'],
        ['astra_orb', '아스트라 오브', 'equipment', 'secondary_weapon'],
        ['green_soul_ring', '그린 소울링', 'equipment', 'secondary_weapon'],
      ]),
    )

    expect(inventoryCatalog().map((item) => item.key)).toEqual(['green_soul_ring'])
  })

  // 레벨을 고르는 칸 없이 목록에서 레벨째 고른다. 높은 레벨부터 선다.
  it('특수스킬 반지는 레벨마다 한 줄로, 높은 레벨부터 이름 뒤에 Lv.N 을 붙여 서고 줄마다 레벨을 든다', () => {
    itemsTable.set(
      아이템표([
        ['risk_taker_ring', '리스크테이커 링', 'accessory', 'special_skill_ring'],
      ]),
    )

    expect(inventoryCatalog().map((item) => [item.key, item.itemKey, item.name, item.ringLevel])).toEqual([
      ['risk_taker_ring@4', 'risk_taker_ring', '리스크테이커 링 Lv.4', 4],
      ['risk_taker_ring@3', 'risk_taker_ring', '리스크테이커 링 Lv.3', 3],
      ['risk_taker_ring@2', 'risk_taker_ring', '리스크테이커 링 Lv.2', 2],
      ['risk_taker_ring@1', 'risk_taker_ring', '리스크테이커 링 Lv.1', 1],
    ])
  })

  // 서버 분류 트리에 종류가 늘어도 앱이 모르는 종류는 어느 탭에도 세울 수 없어 뺀다.
  it('가계부 아이템 종류로 옮길 수 없는 종류의 아이템은 뺀다', () => {
    itemsTable.set(
      아이템표([
        ['pet_food', '펫 먹이', 'pet', 'pet_food'],
      ]),
    )

    expect(inventoryCatalog()).toEqual([])
  })

  // 기록은 원래 반지 · 원래 아이템의 key 를 적는다. 레벨 줄과 같은 물건의 다른 줄이 함께 서면 같은 물건이 목록에 둘로 보인다.
  it('특수스킬 반지의 레벨 줄과 같은 물건의 다른 줄은 목록에 세우지 않는다', () => {
    itemsTable.set(
      아이템표(
        [
          ['risk_taker_ring', '리스크테이커 링', 'accessory', 'special_skill_ring'],
          ['risk_taker_ring_lv4', '리스크테이커 링 4레벨', 'accessory', 'special_skill_ring'],
          ['life_whetstone', '생명의 연마석', 'consumable', 'boss_enhancement_material'],
          ['life_whetstone_from_box', '생명의 연마석', 'consumable', 'boss_enhancement_material'],
        ],
        {
          ringLevelItems: [{ itemId: 'risk_taker_ring_lv4', ringItemId: 'risk_taker_ring', ringLevel: 4 }],
          sameItemLinks: [{ itemId: 'life_whetstone_from_box', originalItemId: 'life_whetstone' }],
        },
      ),
    )

    expect(inventoryCatalog().map((item) => item.itemKey)).toEqual([
      'risk_taker_ring',
      'risk_taker_ring',
      'risk_taker_ring',
      'risk_taker_ring',
      'life_whetstone',
    ])
  })

  it('운영 아이템 표에서 종류를 가리지 않고 친 글자로 찾고, 찾은 아이템은 제 종류를 든다', () => {
    const 찾은것 = catalogMatches(inventoryCatalog(), '1에르')
    const 반지 = catalogMatches(inventoryCatalog(), '리스크테이커4')

    expect(찾은것.find((item) => item.name === '1단계 소울 에테르')?.kind).toBe('consumable')
    expect(반지.map((item) => [item.name, item.kind])).toEqual([['리스크테이커 링 Lv.4', 'equipment']])
  })
})
