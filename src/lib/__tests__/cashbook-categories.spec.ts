import { getItemIconUrlByFile } from '../assets/asset-lookup'
import {
  INCOME_CATEGORIES,
  SPEND_CATEGORIES,
} from '../cashbook/categories'

// 가계부의 고정 목록 넷. 기록은 key 를 들고, 이름은 이 표에서 찾는다.
describe('가계부 갈래 표', () => {
  // 차례가 곧 화면이다. 두 시트의 갈래 카드가 이 차례로 선다.
  it('지출 갈래 일곱. 선택 목록 넷, 심볼 강화, 직접 입력 둘이다', () => {
    expect(SPEND_CATEGORIES.map((each) => [each.key, each.name])).toEqual([
      ['content', '컨텐츠'],
      ['event_bm', '이벤트·BM'],
      ['buff', '버프'],
      ['scroll', '주문서'],
      ['symbol', '심볼 강화'],
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

  it('갈래 카드 그림을 모두 찾는다', () => {
    for (const each of [...SPEND_CATEGORIES, ...INCOME_CATEGORIES]) {
      expect(getItemIconUrlByFile(each.icon)).not.toBeNull()
    }
  })

})
