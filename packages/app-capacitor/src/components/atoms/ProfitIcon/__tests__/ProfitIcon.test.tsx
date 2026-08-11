// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProfitIcon } from '../ProfitIcon'

afterEach(() => {
  cleanup()
})

describe('ProfitIcon (ADR-066)', () => {
  // 커스텀 SVG를 lucide 아이콘 옆에 세우는 이상, 규격이 맞는지가 이 컴포넌트의 계약이다
  // (ADR-066 결정 3) — 하나라도 어긋나면 같은 줄의 lucide 아이콘과 굵기·크기가 달라진다.
  it('lucide 규격(24 그리드 · currentColor 선 · 라운드 캡/조인)으로 그린다', () => {
    render(<ProfitIcon />)

    const icon = screen.getByTestId('profit-icon')
    expect(icon).toHaveAttribute('viewBox', '0 0 24 24')
    expect(icon).toHaveAttribute('fill', 'none')
    expect(icon).toHaveAttribute('stroke', 'currentColor')
    expect(icon).toHaveAttribute('stroke-linecap', 'round')
    expect(icon).toHaveAttribute('stroke-linejoin', 'round')
  })

  it('strokeWidth 기본값은 lucide와 같은 2이고, 호출부가 덮어쓸 수 있다', () => {
    const { rerender } = render(<ProfitIcon />)
    expect(screen.getByTestId('profit-icon')).toHaveAttribute('stroke-width', '2')

    rerender(<ProfitIcon strokeWidth={1.5} />)
    expect(screen.getByTestId('profit-icon')).toHaveAttribute('stroke-width', '1.5')
  })

  it('크기는 className이 정한다 — 호출부의 h-5 w-5가 그대로 붙는다', () => {
    render(<ProfitIcon className="h-5 w-5" />)

    expect(screen.getByTestId('profit-icon')).toHaveClass('h-5', 'w-5')
  })

  it('className을 안 주면 lucide와 같은 24×24로 떨어진다 — 인라인 SVG 기본값(300×150) 방지', () => {
    render(<ProfitIcon />)

    const icon = screen.getByTestId('profit-icon')
    expect(icon).toHaveAttribute('width', '24')
    expect(icon).toHaveAttribute('height', '24')
  })

  it('겹침을 clipPath·mask로 만들지 않는다 — 한 문서에 여러 번 렌더되면 id가 중복된다(ADR-066 결정 4)', () => {
    const { container } = render(
      <>
        <ProfitIcon />
        <ProfitIcon />
      </>,
    )

    expect(container.querySelectorAll('clipPath')).toHaveLength(0)
    expect(container.querySelectorAll('mask')).toHaveLength(0)
  })
})
