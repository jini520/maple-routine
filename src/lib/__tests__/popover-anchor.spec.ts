import { anchorPopover } from '../popover-anchor'

// ADR-068 결정 3 정정 3: 팝오버는 트리거(실패 아이콘) x에 맞춰 열려야 하는데, 그 아이콘은 금액 위에
// 붙어 있고 금액은 자릿수에 따라 폭이 변해 x를 고정값으로 알 수 없다. jsdom은 레이아웃을 계산하지
// 않아(모든 rect가 0) 렌더 테스트로는 검증할 수 없으므로 계산만 순수 함수로 떼어 검증한다.
describe('anchorPopover', () => {
  const base = { containerWidth: 343, popoverWidth: 220, edgeGap: 12, caretSize: 8 }

  it('꼬리가 트리거 중심을 가리킨다 — 트리거 x가 달라도 따라간다', () => {
    for (const anchorCenterX of [199, 264, 120]) {
      const { left, caretLeft } = anchorPopover({ ...base, anchorCenterX })
      expect(left + caretLeft + base.caretSize / 2).toBe(anchorCenterX)
    }
  })

  it('팝오버가 컨테이너 밖으로 나가지 않는다 — 좌우 여백 안쪽으로 clamp한다', () => {
    const farRight = anchorPopover({ ...base, anchorCenterX: 335 })
    expect(farRight.left + base.popoverWidth).toBeLessThanOrEqual(base.containerWidth - base.edgeGap)

    const farLeft = anchorPopover({ ...base, anchorCenterX: 6 })
    expect(farLeft.left).toBeGreaterThanOrEqual(base.edgeGap)
  })

  it('clamp된 뒤에도 꼬리는 팝오버 안에 머문다 — 둥근 모서리에 잘리지 않는다', () => {
    for (const anchorCenterX of [0, 343]) {
      const { caretLeft } = anchorPopover({ ...base, anchorCenterX })
      expect(caretLeft).toBeGreaterThanOrEqual(10)
      expect(caretLeft).toBeLessThanOrEqual(base.popoverWidth - 10 - base.caretSize)
    }
  })

  it('컨테이너가 팝오버보다 좁으면 여백을 지키는 쪽을 택한다(음수 left를 만들지 않는다)', () => {
    const narrow = anchorPopover({ ...base, containerWidth: 100, anchorCenterX: 50 })
    expect(narrow.left).toBe(base.edgeGap)
  })
})
