import { cashbookCategoriesTable } from '../cashbook/categories'
import {
  cashbookCategoryIdOf,
  cashbookCategoryIdsOf,
  itemTargetIdOf,
  itemTargetIdsOf,
  itemTargetKeyOf,
  itemTargetTypeOf,
  type CashbookItemTargetType,
} from '../cashbook/entry-ids'
import { hexaMatrixTable } from '../cashbook/hexa-matrix'
import { huntingGroundsTable } from '../cashbook/hunting-grounds'
import { spendCatalogTable } from '../cashbook/spend-catalog'
import { symbolCostsTable } from '../cashbook/symbol-costs'
import { itemsTable } from '../item-catalog'

describe('가계부 분류의 줄 id', () => {
  // 기타는 수입과 지출에 다 있어 key 만으로는 어느 분류인지 모른다. 종류를 함께 봐야 다른 쪽 기록으로 옮겨 가지 않는다.
  it('수입 · 지출과 key 로 찾고, 수입 · 지출의 줄 id 가 겹치지 않는다', () => {
    const rows = cashbookCategoriesTable.get().cashbookCategories
    expect(rows.every((row) => cashbookCategoryIdOf(row.entryType, row.key) === row.id)).toBe(true)
    expect(cashbookCategoryIdOf('income', 'etc')).not.toBe(cashbookCategoryIdOf('spend', 'etc'))
    const income = cashbookCategoryIdsOf('income')
    expect(cashbookCategoryIdsOf('spend').filter((id) => income.includes(id))).toEqual([])
  })
})

describe('품목이 가리키는 표', () => {
  it('분류마다 표가 하나이고, 헥사 매트릭스는 활성화 칸으로 코어와 스탯을 가르며, 솔 에르다 조각 · 기타는 대상이 없다', () => {
    expect(itemTargetTypeOf('income', 'hunting', null)).toBe('hunting_ground')
    expect(itemTargetTypeOf('income', 'hunt_loot_sale', null)).toBe('item')
    expect(itemTargetTypeOf('spend', 'item_purchase', null)).toBe('item')
    expect(itemTargetTypeOf('spend', 'scroll', null)).toBe('spend_item')
    expect(itemTargetTypeOf('spend', 'symbol', null)).toBe('symbol')
    expect(itemTargetTypeOf('spend', 'hexa_matrix', null)).toBe('hexa_core')
    expect(itemTargetTypeOf('spend', 'hexa_matrix', false)).toBe('hexa_stat')
    expect(itemTargetTypeOf('income', 'sol_erda_fragment', null)).toBeNull()
    expect(itemTargetTypeOf('spend', 'etc', null)).toBeNull()
  })
})

describe('품목 key 와 줄 id', () => {
  // 기록 표는 줄 id 를 적고 화면은 key 로 그린다. 한 바퀴 돌아 다른 key 가 나오면 기록이 다른 물건으로 선다.
  it('사냥터 · 지출 항목 · 심볼 · 헥사 스탯 · 아이템의 모든 key 가 줄 id 를 거쳐 그대로 돌아온다', () => {
    const tables: Array<[CashbookItemTargetType, readonly { key: string }[]]> = [
      ['hunting_ground', huntingGroundsTable.get().huntingGrounds],
      ['spend_item', spendCatalogTable.get().spendItems],
      ['symbol', symbolCostsTable.get().symbols],
      ['hexa_stat', hexaMatrixTable.get().hexaStats],
      ['item', itemsTable.get().items.filter((item) => !itemsTable.get().ringLevelItems.some((ring) => ring.itemId === item.id))],
    ]
    for (const [type, rows] of tables) {
      const lost = rows.filter((row) => itemTargetKeyOf(type, itemTargetIdOf(type, row.key)!)?.key !== row.key)
      expect([type, lost]).toEqual([type, []])
    }
  })

  // 같은 반지도 레벨마다 시세가 다르고 인벤토리에서도 따로 센다. 그래서 레벨 줄을 적고 읽을 때 반지와 레벨로 되돌린다.
  it('레벨이 있는 반지는 레벨 줄이고 원래 반지와 레벨로 돌아오며, 표에 없는 레벨은 null 이다', () => {
    const id = itemTargetIdOf('item', 'restraint_ring', { ringLevel: 4 })
    expect(id).not.toBe(itemTargetIdOf('item', 'restraint_ring'))
    expect(itemTargetKeyOf('item', id!)).toEqual({ key: 'restraint_ring', ringLevel: 4 })
    expect(itemTargetIdOf('item', 'restraint_ring', { ringLevel: 9 })).toBeNull()
  })

  it('표에 없는 key 와 줄 id 는 null 이다', () => {
    expect(itemTargetIdOf('spend_item', 'no_such_item')).toBeNull()
    expect(itemTargetKeyOf('symbol', 'no-such-id')).toBeNull()
  })
})

describe('헥사 코어의 줄 id', () => {
  // 같은 이름의 코어가 직업마다 다른 줄이다. 그 캐릭터 직업의 줄을 적어야 서버에서 그 직업의 그림으로 선다.
  it('그 직업의 코어를 찾고, 이름이 같은 다른 직업의 코어와 줄이 다르며, 이름으로 되돌아온다', () => {
    const hero = itemTargetIdOf('hexa_core', '블리츠 실드 VI/블리츠 버스트', { job: '히어로' })
    const paladin = itemTargetIdOf('hexa_core', '블리츠 실드 VI/블리츠 버스트', { job: '팔라딘' })
    expect(hero).not.toBeNull()
    expect(hero).not.toBe(paladin)
    expect(itemTargetKeyOf('hexa_core', hero!)).toEqual({ key: '블리츠 실드 VI/블리츠 버스트', ringLevel: null })
    expect(itemTargetIdsOf('hexa_core', '블리츠 실드 VI/블리츠 버스트')).toHaveLength(3)
  })

  // 모든 직업이 같이 쓰는 코어는 `전직업` 줄 하나다. 직업을 모르는 캐릭터도 그 코어는 찾는다.
  it('전직업 코어는 직업을 몰라도 찾고, 그 직업에 없는 코어는 null 이다. 이름의 앞뒤 공백은 보지 않는다', () => {
    expect(itemTargetIdOf('hexa_core', ' 솔 야누스 ', { job: null })).toBe(itemTargetIdOf('hexa_core', '솔 야누스', { job: '히어로' }))
    expect(itemTargetIdOf('hexa_core', '스피릿 칼리버', { job: null })).toBeNull()
    expect(itemTargetIdOf('hexa_core', '스피릿 칼리버', { job: '팔라딘' })).toBeNull()
  })
})
