import { MODAL_EDGE_GAP_PX, MODAL_TOP_GAP_PX, resolveModalMaxHeight } from '../modal-metrics'

/** 갤럭시 Z 폴드 8 의 두 화면. 위 상태바 31dp · 아래 3버튼 내비 48dp. */
const 커버 = { windowHeightPx: 657, insetTopPx: 31, insetBottomPx: 48 }
const 인너 = { windowHeightPx: 616, insetTopPx: 31, insetBottomPx: 48 }

describe('모달 카드의 상한', () => {
  it('위 정렬은 상단 안전영역 + 32 부터 하단 안전영역 + 16 까지다', () => {
    // 시안 B 의 커버 카드 530dp
    expect(resolveModalMaxHeight({ ...커버, align: 'top' })).toBe(530)
    expect(resolveModalMaxHeight({ ...커버, align: 'top' })).toBe(
      657 - (31 + MODAL_TOP_GAP_PX) - (48 + MODAL_EDGE_GAP_PX),
    )
  })

  it('가운데 정렬은 위아래 안전영역에서 16 씩 띄운다', () => {
    // 시안 A 의 인너 MVP 카드 505dp
    expect(resolveModalMaxHeight({ ...인너, align: 'center' })).toBe(505)
  })

  it('테마 모달 약 704dp 는 두 기기 모두 상한에 닿는다', () => {
    expect(resolveModalMaxHeight({ ...커버, align: 'top' })).toBeLessThan(704)
    expect(resolveModalMaxHeight({ ...인너, align: 'top' })).toBeLessThan(704)
  })

  it('높은 화면에서는 테마 모달이 상한에 안 닿는다', () => {
    // Z Flip3 메인 360×880dp
    expect(
      resolveModalMaxHeight({ windowHeightPx: 880, insetTopPx: 31, insetBottomPx: 48, align: 'top' }),
    ).toBeGreaterThan(704)
  })
})
