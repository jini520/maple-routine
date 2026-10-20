import { getItemIconUrlByFile } from '../assets/asset-lookup'
import {
  INCOME_CATEGORIES,
  SPEND_CATEGORIES,
} from '../cashbook/categories'

// 가계부의 고정 목록 넷. 기록은 key 를 들고, 이름은 이 표에서 찾는다.
describe('가계부 갈래 표', () => {
  it('갈래 카드 그림을 모두 찾는다', () => {
    for (const each of [...SPEND_CATEGORIES, ...INCOME_CATEGORIES]) {
      expect(getItemIconUrlByFile(each.icon)).not.toBeNull()
    }
  })

})
