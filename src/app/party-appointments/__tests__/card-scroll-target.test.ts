import { cardScrollY } from '../card-scroll-target'

// 헤더가 있는 화면은 스크롤 영역이 화면 맨 위(상태 표시줄 밑)부터다. 안전영역을 안 빼면 카드가 다이내믹 아일랜드 밑으로 간다.
it('카드의 자리에서 상단 안전영역과 위 여백을 뺀 자리로 스크롤한다', () => {
  expect(cardScrollY({ cardY: 900, topSafeAreaPx: 59, gapPx: 12 })).toBe(900 - 59 - 12)
})

it('맨 위 카드여도 음수로 스크롤하지 않는다', () => {
  expect(cardScrollY({ cardY: 30, topSafeAreaPx: 59, gapPx: 12 })).toBe(0)
})
