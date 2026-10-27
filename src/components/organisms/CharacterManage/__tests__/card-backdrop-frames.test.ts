import { backdropFrames, CARD_GAP, UPPER_CARD_TAIL } from '../card-backdrop-frames'

// 두 카드의 경계는 구분자 칸을 따라간다. 머리글 높이를 빼먹으면 위 카드가 마지막 행을 덜 덮는다.
describe('backdropFrames', () => {
  it('위 카드는 머리글과 구분자 위치를 지나 꼬리만큼 내려오고, 아래 카드는 그 아래 여백 뒤에서 시작한다', () => {
    const frames = backdropFrames(40, 300)

    expect(frames.upperHeight).toBe(40 + 300 + UPPER_CARD_TAIL)
    expect(frames.lowerTop - frames.upperHeight).toBe(CARD_GAP)
  })
})
