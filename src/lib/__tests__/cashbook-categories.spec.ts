import bundled from '../../__fixtures__/game-data/cashbook-categories.json'
import { getItemIconUrlByFile } from '../assets/asset-lookup'
import {
  cashbookCategoriesTable,
  countsQuantity,
  hasTariff,
  incomeCategories,
  incomeCategoryKeyOfName,
  incomePickerCategories,
  itemKindNameOf,
  parseCashbookCategories,
  spendCategories,
  spendCategoryKeyOfName,
  spendCategoryNameOf,
} from '../cashbook/categories'

const original = cashbookCategoriesTable.get()
afterEach(() => cashbookCategoriesTable.set(original))

/** 번들에서 갈래 하나를 바꾼 표. */
function withCategories(categories: unknown[]): void {
  const parsed = parseCashbookCategories({ ...bundled, categories })
  if (parsed === null) throw new Error('계약을 어겼다')
  cashbookCategoriesTable.set(parsed)
}

// 갈래 · 아이템 종류의 이름과 단위는 서버 표가 든다. 기록은 key 를 들고, 앱 코드는 key 로 폼을 가른다.
describe('가계부 갈래 표', () => {
  it('갈래 카드 그림을 모두 찾는다', () => {
    for (const each of [...spendCategories(), ...incomeCategories()]) {
      expect(getItemIconUrlByFile(each.icon)).not.toBeNull()
    }
  })

  it('수입 · 지출 구분이 틀리거나 같은 쪽에 같은 key 가 둘이면 표 전체를 버린다', () => {
    const spend = bundled.categories.find((each) => each.entryType === 'spend')!
    expect(parseCashbookCategories({ ...bundled, categories: [{ ...spend, entryType: 'transfer' }] })).toBeNull()
    expect(parseCashbookCategories({ ...bundled, categories: [spend, spend] })).toBeNull()
    // 수입과 지출의 기타는 key 가 같아도 따로다.
    expect(parseCashbookCategories(bundled)).not.toBeNull()
  })

  it('서버가 더한 갈래는 차례대로 서지만 앱이 폼을 모르면 못 고른다', () => {
    const spend = bundled.categories.filter((each) => each.entryType === 'spend')
    withCategories([
      ...spend.slice(0, 1),
      { ...spend[0], key: 'hexa_skill', name: '헥사 스킬 강화' },
      ...spend.slice(1),
      ...bundled.categories.filter((each) => each.entryType === 'income'),
    ])

    const list = spendCategories()
    expect(list.map((each) => each.key).slice(0, 3)).toEqual(['content', 'hexa_skill', 'event_bm'])
    expect(list.find((each) => each.key === 'hexa_skill')?.known).toBe(false)
    expect(list.filter((each) => each.key !== 'hexa_skill').every((each) => each.known)).toBe(true)
    expect(spendCategoryNameOf('hexa_skill')).toBe('헥사 스킬 강화')
    expect(spendCategoryNameOf('nobody')).toBe('nobody')
  })

  it('이름은 서버 값을 따르고, 옛 기록의 이름에서 key 를 찾는 이관은 그때의 이름을 쓴다', () => {
    withCategories(
      bundled.categories.map((each) =>
        each.entryType === 'spend' && each.key === 'symbol' ? { ...each, name: '심볼' } : each,
      ),
    )

    expect(spendCategoryNameOf('symbol')).toBe('심볼')
    expect(spendCategoryKeyOfName('심볼 강화')).toBe('symbol')
    expect(spendCategoryKeyOfName('심볼')).toBeNull()
    expect(incomeCategoryKeyOfName('솔 에르다 조각')).toBe('sol_erda_fragment')
  })

  it('수량과 관세는 아이템 종류 표의 단위 · 관세 칸을 따른다', () => {
    expect([countsQuantity('equipment'), hasTariff('equipment')]).toEqual([false, true])
    expect([countsQuantity('consumable'), hasTariff('consumable')]).toEqual([true, false])

    const parsed = parseCashbookCategories({
      ...bundled,
      itemKinds: bundled.itemKinds.map((each) =>
        each.key === 'consumable' ? { ...each, name: '소모품', unit: null, hasTariff: true } : each,
      ),
    })
    cashbookCategoriesTable.set(parsed!)

    expect([countsQuantity('consumable'), hasTariff('consumable')]).toEqual([false, true])
    expect(itemKindNameOf('consumable')).toBe('소모품')
  })

  /**
   * 조각 정산은 사냥 전리품 판매의 조각 칸으로 옮겼다. 그 갈래 줄은 서버 관리 화면에서 더하고, 그 전에 조각 카드를
   * 숨기면 조각 정산을 적을 곳이 사라진다.
   */
  it('사냥 전리품 판매 갈래가 서버 표에 있을 때만 고르는 시트에서 솔 에르다 조각 카드를 뺀다', () => {
    expect(incomePickerCategories().map((each) => each.key)).toContain('sol_erda_fragment')

    const fragment = bundled.categories.find((each) => each.key === 'sol_erda_fragment')!
    withCategories([
      ...bundled.categories,
      { ...fragment, key: 'hunt_loot_sale', name: '사냥 전리품 판매', cardTitle: '사냥 전리품 판매' },
    ])

    const keys = incomePickerCategories().map((each) => each.key)
    expect(keys).toContain('hunt_loot_sale')
    expect(keys).not.toContain('sol_erda_fragment')
    expect(incomePickerCategories().find((each) => each.key === 'hunt_loot_sale')?.known).toBe(true)
  })
})
