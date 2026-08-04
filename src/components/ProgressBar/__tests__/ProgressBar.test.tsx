// @vitest-environment jsdom
//
// ADR-094 2단계 — atoms 신설. 이 테스트가 지키는 것은 "보기 좋은 API"가 아니라
// **기존 호출부 9곳의 DOM 을 한 글자도 바꾸지 않는 것**이다(ADR-094 결정 4).
// 그래서 클래스 문자열을 문자 그대로 단언한다 — 여기서 무심코 클래스를 하나 더하면
// 화면 스냅샷이 깨지고, 그게 정상 동작이다.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProgressBar } from '../ProgressBar'

// ADR-061 결정 6: 결정형 진행률은 예외 없이 h-1.5 프리미티브 하나다(h-2 변형 폐기).
const TRACK_CLASS = 'h-1.5 w-full overflow-hidden rounded-full bg-track'

// 이 저장소는 전역 자동 cleanup을 켜지 않는다 — 안 지우면 앞 케이스의 노드가 남아
// queryByRole이 그것을 집는다(실제로 밟았다).
afterEach(() => {
  cleanup()
})

/** container 자체가 div라 `div > div` 는 트랙을 집는다 — 채움은 트랙의 자식이다. */
function fillOf(container: HTMLElement): Element | null | undefined {
  return container.firstElementChild?.firstElementChild
}

describe('ProgressBar', () => {
  it('트랙과 채움의 클래스가 기존 호출부와 정확히 같다', () => {
    const { container } = render(<ProgressBar percent={40} />)

    const track = container.firstElementChild
    expect(track).toHaveAttribute('class', TRACK_CLASS)
    expect(track?.firstElementChild).toHaveAttribute('class', 'h-1.5 rounded-full bg-primary')
  })

  it('채움 너비를 percent로 준다', () => {
    const { container } = render(<ProgressBar percent={40} />)

    expect(fillOf(container)).toHaveStyle({ width: '40%' })
  })

  it('tone="third"면 채움만 bg-third가 된다 — 컨텐츠 카드의 진행률', () => {
    const { container } = render(<ProgressBar percent={50} tone="third" />)

    expect(container.firstElementChild).toHaveAttribute('class', TRACK_CLASS)
    expect(fillOf(container)).toHaveAttribute('class', 'h-1.5 rounded-full bg-third')
  })

  it('animated면 채움에 transition-[width]가 붙는다 — 다운로드 진행률', () => {
    const { container } = render(<ProgressBar percent={10} animated />)

    expect(fillOf(container)).toHaveAttribute(
      'class',
      'h-1.5 rounded-full bg-primary transition-[width]',
    )
  })

  describe('접근성 값', () => {
    it('aria를 주면 role="progressbar"와 aria-* 를 함께 낸다', () => {
      render(<ProgressBar percent={50} aria={{ now: 7, max: 14 }} />)

      const bar = screen.getByRole('progressbar')
      expect(bar).toHaveAttribute('aria-valuenow', '7')
      expect(bar).toHaveAttribute('aria-valuemin', '0')
      expect(bar).toHaveAttribute('aria-valuemax', '14')
    })

    // 9곳 중 UpdatePromptModal 한 곳만 role·aria 없이 그린다. 지금 붙이면 DOM 이 바뀌므로
    // (ADR-094 결정 4) 옵션으로 두고, 접근성 보강은 별도 변경으로 다룬다.
    it('aria를 안 주면 role도 aria-*도 내지 않는다', () => {
      const { container } = render(<ProgressBar percent={50} />)

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      expect(container.firstElementChild).not.toHaveAttribute('aria-valuenow')
    })
  })

  it('fillTestId를 채움에 단다 — 진행률을 직접 집는 테스트가 있다', () => {
    render(<ProgressBar percent={30} fillTestId="update-progress-bar" />)

    expect(screen.getByTestId('update-progress-bar')).toHaveStyle({ width: '30%' })
  })
})
