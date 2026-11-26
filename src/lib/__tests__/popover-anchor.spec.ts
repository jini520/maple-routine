import { anchorPopover, centerBubble } from '../popover-anchor'

// 팝오버는 트리거(실패 아이콘) x에 맞춰 열려야 하는데, 그 아이콘은 금액 위에
// 붙어 있고 금액은 자릿수에 따라 폭이 변해 x를 고정값으로 알 수 없다. jsdom은 레이아웃을 계산하지
// 않아(모든 rect가 0) 렌더 테스트로는 검증할 수 없으므로 계산만 순수 함수로 떼어 검증한다.
describe('anchorPopover', () => {
  const base = { containerWidth: 343, popoverWidth: 220, edgeGap: 12, caretSize: 8 }

  it('꼬리가 트리거 중심을 가리킨다. 트리거 x가 달라도 따라간다', () => {
    for (const anchorCenterX of [199, 264, 120]) {
      const { left, caretLeft } = anchorPopover({ ...base, anchorCenterX })
      expect(left + caretLeft + base.caretSize / 2).toBe(anchorCenterX)
    }
  })

  it('팝오버가 컨테이너 밖으로 나가지 않는다. 좌우 여백 안쪽으로 clamp한다', () => {
    const farRight = anchorPopover({ ...base, anchorCenterX: 335 })
    expect(farRight.left + base.popoverWidth).toBeLessThanOrEqual(base.containerWidth - base.edgeGap)

    const farLeft = anchorPopover({ ...base, anchorCenterX: 6 })
    expect(farLeft.left).toBeGreaterThanOrEqual(base.edgeGap)
  })

  it('clamp된 뒤에도 꼬리는 팝오버 안에 머문다. 둥근 모서리에 잘리지 않는다', () => {
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

// 차트 말풍선은 고른 막대 · 점 위에 가운데로 서고, 차트 끝에서는 밀린다. 밀려도 꼬리는 막대 · 점을 가리켜야 어느 값인지 보인다.
describe('centerBubble', () => {
  const base = { containerWidth: 312, bubbleWidth: 120, caretSize: 12 }
  const caretCenter = (input: Parameters<typeof centerBubble>[0]): number => {
    const { left, caretLeft } = centerBubble(input)
    return left + caretLeft + input.caretSize / 2
  }

  it('자리가 있으면 앵커 가운데에 서고 꼬리도 가운데다', () => {
    const { left, caretLeft } = centerBubble({ ...base, anchorCenterX: 156 })
    expect(left).toBe(96)
    expect(caretLeft).toBe(54)
  })

  it('끝에서 밀려도 꼬리는 앵커를 가리킨다', () => {
    for (const anchorCenterX of [20, 60, 250, 295]) {
      const { left } = centerBubble({ ...base, anchorCenterX })
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left + base.bubbleWidth).toBeLessThanOrEqual(base.containerWidth)
      expect(caretCenter({ ...base, anchorCenterX })).toBe(anchorCenterX)
    }
  })

  it('밖으로 나갈 수 있으면 차트 끝의 점까지 꼬리가 닿는다', () => {
    expect(caretCenter({ ...base, anchorCenterX: 0, edgeGap: -14, caretInset: 8 })).toBe(0)
    expect(caretCenter({ ...base, anchorCenterX: 312, edgeGap: -14, caretInset: 8 })).toBe(312)
  })

  it('꼬리는 둥근 모서리 안쪽에서 멈춘다', () => {
    expect(centerBubble({ ...base, anchorCenterX: 0 }).caretLeft).toBe(10)
    expect(centerBubble({ ...base, anchorCenterX: 0, caretInset: 18 }).caretLeft).toBe(18)
  })
})
