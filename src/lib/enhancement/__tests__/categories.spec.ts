// 강화 지출의 갈래 표. 줄 신원과 그림 열쇠는 key 를 쓰고 줄 제목은 글자를 쓴다.
import { ENHANCEMENT_CATEGORIES, enhancementCategoryNameOf } from '../categories'

it('갈래는 다섯이고 차례는 큐브 · 스타포스 · 잠재능력 · 에디셔널 잠재능력 · 소울 잠재능력이다', () => {
  expect(ENHANCEMENT_CATEGORIES.map((category) => [category.key, category.name])).toEqual([
    ['cube_reset', '큐브 재설정'],
    ['starforce', '스타포스'],
    ['potential', '잠재능력'],
    ['additional_potential', '에디셔널 잠재능력'],
    ['soul_potential', '소울 잠재능력'],
  ])
})

it('key 로 보이는 글자를 찾는다', () => {
  expect(enhancementCategoryNameOf('additional_potential')).toBe('에디셔널 잠재능력')
})
