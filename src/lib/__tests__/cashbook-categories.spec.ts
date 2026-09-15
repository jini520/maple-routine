import { getItemIconUrlByFile } from '../assets/asset-lookup'
import {
  INCOME_CATEGORIES,
  SPEND_CATEGORIES,
  SPEND_FORMS,
  SPEND_ITEM_KINDS,
  countsQuantity,
  incomeCategoryKeyOfName,
  incomeCategoryNameOf,
  spendCategoryKeyOfName,
  spendCategoryNameOf,
  spendFormOf,
  spendItemKindKeyOfName,
  spendItemKindNameOf,
} from '../cashbook/categories'

// 가계부의 고정 목록 넷. 기록은 key 를 들고, 이름은 이 표에서 찾는다.
describe('가계부 갈래 표', () => {
  // 차례가 곧 화면이다. 두 시트의 갈래 카드가 이 차례로 선다.
  it('지출 갈래 여섯. 선택 목록 넷 다음 직접 입력 둘이다', () => {
    expect(SPEND_CATEGORIES.map((each) => [each.key, each.name])).toEqual([
      ['content', '컨텐츠'],
      ['event_bm', '이벤트·BM'],
      ['buff', '버프'],
      ['scroll', '주문서'],
      ['item_purchase', '아이템 구매'],
      ['etc', '기타'],
    ])
  })

  // 사냥이 앞인 것은 손이 가장 많이 가서이고, 기타는 안전망이라 끝이다. 솔 에르다 조각은 사냥에서
  // 보관한 조각을 판 날에 정산하는 갈래라 사냥 바로 뒤다(사용자 지정).
  it('수익 갈래 넷. 사냥이 기본이다', () => {
    expect(INCOME_CATEGORIES.map((each) => [each.key, each.name])).toEqual([
      ['hunting', '사냥'],
      ['sol_erda_fragment', '솔 에르다 조각'],
      ['item_sale', '아이템 판매'],
      ['etc', '기타'],
    ])
  })

  it('솔 에르다 조각 카드는 사냥 폼의 조각 그림을 쓴다', () => {
    expect(INCOME_CATEGORIES.find((each) => each.key === 'sol_erda_fragment')?.icon).toBe(
      'sol_erda_fragment.webp',
    )
  })

  it('아이템 구매 종류 셋은 게임 인벤토리 탭 이름이다', () => {
    expect(SPEND_ITEM_KINDS.map((each) => [each.key, each.name])).toEqual([
      ['equipment', '장비'],
      ['consumable', '소비'],
      ['etc', '기타'],
    ])
  })

  // 하루 목록의 줄 이름에 들어가는 짧은 이름(사용자 지정).
  it('에픽던전 리워드 형태 둘과 짧은 이름', () => {
    expect(SPEND_FORMS).toEqual([
      { key: 'exp', name: '경험치', shortName: 'EXP' },
      { key: 'sol_erda', name: '솔 에르다', shortName: '솔' },
    ])
    expect(spendFormOf('sol_erda')?.shortName).toBe('솔')
    expect(spendFormOf('unknown')).toBeNull()
  })

  it('갈래 카드 그림을 모두 찾는다', () => {
    for (const each of [...SPEND_CATEGORIES, ...INCOME_CATEGORIES]) {
      expect(getItemIconUrlByFile(each.icon)).not.toBeNull()
    }
  })

  it('key 와 이름을 서로 찾는다. 모르는 이름은 null 이다', () => {
    expect(spendCategoryNameOf('event_bm')).toBe('이벤트·BM')
    expect(spendCategoryKeyOfName('주문서')).toBe('scroll')
    expect(spendCategoryKeyOfName('상점·편의')).toBeNull()
    expect(incomeCategoryNameOf('item_sale')).toBe('아이템 판매')
    expect(incomeCategoryKeyOfName('사냥')).toBe('hunting')
    expect(spendItemKindNameOf('consumable')).toBe('소비')
    expect(spendItemKindKeyOfName('장비')).toBe('equipment')
  })

  // 장비는 하나를 사고 관세가 붙는다. 소비 · 기타는 여럿을 사고 관세가 없다.
  it('수량과 관세는 장비가 아닐 때 선다', () => {
    expect(countsQuantity('equipment')).toBe(false)
    expect(countsQuantity('consumable')).toBe(true)
    expect(countsQuantity('etc')).toBe(true)
  })
})
