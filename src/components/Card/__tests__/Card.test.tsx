// @vitest-environment jsdom
//
// ADR-094 2단계 — atoms 신설. ProgressBar·Button 과 같은 원칙으로, 기존 호출부 21곳의
// DOM 을 바꾸지 않는 것이 이 테스트의 목적이다(ADR-094 결정 4).
//
// 코어가 4토큰뿐이라 얇아 보이지만, 그 4개가 `design-system.md` 「기본 컴포넌트」절의 카드
// 정의 그대로다. 특히 `rounded-[14px]` 를 한곳에 모으는 것이 요점 — 디자인 원칙 2가
// "컴포넌트 성격별로 라운딩을 다르게"(카드 14px · 버튼 pill · 인풋 10px)라고 못박았으므로,
// 21곳에 흩어진 채로는 카드 라운딩이 조용히 어긋날 수 있다.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Card } from '../Card'

afterEach(() => {
  cleanup()
})

const CARD = 'rounded-[14px] border border-border bg-surface'

describe('Card', () => {
  it('코어 클래스가 디자인 시스템의 카드 정의와 같다', () => {
    const { container } = render(<Card />)

    expect(container.firstElementChild).toHaveAttribute('class', CARD)
  })

  it('className은 코어 뒤에 이어 붙는다 — 여백·간격은 호출부가 소유한다', () => {
    const { container } = render(<Card className="p-6 space-y-2" />)

    expect(container.firstElementChild).toHaveAttribute('class', `${CARD} p-6 space-y-2`)
  })

  it('미디어 카드도 같은 코어 위에 얹는다 — 높이·클리핑만 호출부가 더한다', () => {
    const { container } = render(<Card className="media-scope relative h-20 overflow-hidden" />)

    expect(container.firstElementChild).toHaveAttribute(
      'class',
      `${CARD} media-scope relative h-20 overflow-hidden`,
    )
  })

  it('children과 나머지 div 속성을 그대로 전달한다', () => {
    render(
      <Card data-testid="boss-card" aria-label="보스 카드">
        <span>내용</span>
      </Card>,
    )

    const card = screen.getByTestId('boss-card')
    expect(card).toHaveAttribute('aria-label', '보스 카드')
    expect(card).toHaveTextContent('내용')
  })
})
