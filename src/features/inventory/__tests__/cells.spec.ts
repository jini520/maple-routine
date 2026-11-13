import type { BossDropRecord } from '../../../storage/boss-drops'
import { SOL_ERDA_FRAGMENT_ITEM_KEY, type InventoryItem } from '../../../storage/inventory'
import { buildInventoryCells, inventoryMenuOf } from '../cells'

function drop(id: string, itemKey: string, category: BossDropRecord['category'], ocid = 'ocid-a'): BossDropRecord {
  return { dropRecordId: id, ocid, itemKey, category, quantity: 1, priceState: null, ringLevel: null } as BossDropRecord
}

function item(id: string, itemKey: string, itemKindKey: string, remaining: number, accountId = 'maple-a'): InventoryItem {
  return { id, accountId, worldKey: 'scania', itemKey, itemKindKey, quantity: remaining, used: 0, remaining, ringLevel: null }
}

const faceOf = (accountId: string): string | null => ({ 'maple-a': 'ocid-a', 'maple-b': 'ocid-b' })[accountId] ?? null

describe('buildInventoryCells', () => {
  it('보스 드롭은 드롭 하나가 칸 하나이고 드롭을 가진 캐릭터의 얼굴이 선다', () => {
    const cells = buildInventoryCells({
      pendingDrops: [drop('d1', 'stone', 'consumable', 'ocid-a'), drop('d2', 'stone', 'consumable', 'ocid-b')],
      huntFragments: 0,
      items: [],
      faceOf,
    })

    expect(cells.map((cell) => [cell.kind, cell.faceOcid])).toEqual([
      ['drop', 'ocid-a'],
      ['drop', 'ocid-b'],
    ])
  })

  it('넣은 아이템은 메이플 ID · 월드마다 칸이 따로 서고 그 주인의 대표 얼굴이 선다', () => {
    const cells = buildInventoryCells({
      pendingDrops: [],
      huntFragments: 0,
      items: [item('i1', 'stone', 'consumable', 1, 'maple-a'), item('i2', 'stone', 'consumable', 1, 'maple-b')],
      faceOf,
    })

    expect(cells.map((cell) => [cell.kind, cell.count, cell.faceOcid])).toEqual([
      ['item', 1, 'ocid-a'],
      ['item', 1, 'ocid-b'],
    ])
  })

  // 반지 상자의 결과는 드롭 기록에 상자의 종류(소비)로 남는다. 그대로 쓰면 반지가 소비 칸에 서고 수량이 붙는다.
  it('아이템 목록에 있는 아이템은 목록의 종류로 서서 반지 상자의 반지가 장비 칸이고, 반지는 드롭 · 넣은 줄의 레벨을 든다', () => {
    const cells = buildInventoryCells({
      pendingDrops: [{ ...drop('d1', 'weapon_puff_l_ring', 'consumable'), ringLevel: 4 }, drop('d2', 'stone', 'consumable')],
      huntFragments: 0,
      items: [{ ...item('i1', 'risk_taker_ring', 'equipment', 1), ringLevel: 2 }],
      faceOf,
    })

    expect(cells.map((cell) => [cell.itemKey, cell.itemKindKey, cell.ringLevel])).toEqual([
      ['weapon_puff_l_ring', 'equipment', 4],
      ['risk_taker_ring', 'equipment', 2],
      ['stone', 'consumable', null],
    ])
  })

  it('남은 개수가 0 인 넣은 아이템과 보유가 0 인 사냥 조각은 서지 않는다', () => {
    const cells = buildInventoryCells({ pendingDrops: [], huntFragments: 0, items: [item('i1', 'stone', 'consumable', 0)], faceOf })

    expect(cells).toEqual([])
  })

  it('사냥 조각은 한 칸이고 얼굴이 없으며, 기타 조각은 주인마다 칸이다. 칸 안에 경로를 적는다', () => {
    const cells = buildInventoryCells({
      pendingDrops: [],
      huntFragments: 1240,
      items: [item('f1', SOL_ERDA_FRAGMENT_ITEM_KEY, 'etc', 30)],
      faceOf,
    })

    expect(cells.map((cell) => [cell.kind, cell.count, cell.tag, cell.faceOcid])).toEqual([
      ['hunt', 1240, '사냥', null],
      ['item', 30, '기타', 'ocid-a'],
    ])
  })

  it('종류는 장비 · 소비 · 기타 · 캐시 차례이고, 같은 종류 안에서는 같은 아이템 칸이 붙어 선다', () => {
    const cells = buildInventoryCells({
      pendingDrops: [drop('d1', 'stone', 'consumable'), drop('d2', 'belt', 'equipment')],
      huntFragments: 0,
      items: [item('i1', 'cube', 'cash', 2), item('i2', 'scroll', 'consumable', 1), item('i3', 'stone', 'consumable', 1)],
      faceOf,
    })

    expect(cells.map((cell) => `${cell.itemKindKey}:${cell.itemKey}`)).toEqual([
      'equipment:belt',
      'consumable:stone',
      'consumable:stone',
      'consumable:scroll',
      'cash:cube',
    ])
  })
})

describe('inventoryMenuOf', () => {
  it('보스 드롭은 판매 · 기록 안함, 사냥 조각은 판매, 넣은 아이템은 판매 · 수정 · 삭제다', () => {
    expect(inventoryMenuOf({ kind: 'drop', itemKindKey: 'equipment' })).toEqual(['판매', '기록 안함'])
    expect(inventoryMenuOf({ kind: 'hunt', itemKindKey: 'etc' })).toEqual(['판매'])
    expect(inventoryMenuOf({ kind: 'item', itemKindKey: 'consumable' })).toEqual(['판매', '수정', '삭제'])
  })

  it('넣은 장비는 늘 하나라 고칠 개수가 없어 판매 · 삭제만 선다', () => {
    expect(inventoryMenuOf({ kind: 'item', itemKindKey: 'equipment' })).toEqual(['판매', '삭제'])
  })
})
