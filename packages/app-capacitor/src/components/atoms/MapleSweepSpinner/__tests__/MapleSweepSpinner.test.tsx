// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MapleSweepSpinner } from '../MapleSweepSpinner'

afterEach(() => {
  cleanup()
})

describe('MapleSweepSpinner', () => {
  it('장식용 아이콘이라 스크린리더에서 숨겨진다', () => {
    render(<MapleSweepSpinner />)

    expect(screen.getByTestId('maple-sweep-spinner')).toHaveAttribute('aria-hidden', 'true')
  })

  it('size prop으로 지정한 너비만큼 렌더링된다', () => {
    render(<MapleSweepSpinner size={24} />)

    expect(screen.getByTestId('maple-sweep-spinner')).toHaveAttribute('width', '24')
  })

  it('motion-reduce 환경에서 애니메이션을 멈추는 클래스를 포함한다', () => {
    render(<MapleSweepSpinner />)

    const band = screen.getByTestId('maple-sweep-spinner').querySelector('rect')
    expect(band).toHaveClass('motion-reduce:animate-none')
  })

  // Chrome은 <clipPath>의 직접 자식으로 <g>(그룹) 래퍼를 지원하지 않는다 — 넣으면 에러도 경고도
  // 없이 빈 클립이 돼 잎이 통째로 사라진다(MapleWaveProgress에서 겪은 트랩). 회귀 방지용.
  it('clipPath의 직접 자식은 도형 요소(path)뿐이다', () => {
    render(<MapleSweepSpinner />)

    const clipPath = screen.getByTestId('maple-sweep-spinner').querySelector('clipPath')
    expect(clipPath).not.toBeNull()
    const childTags = Array.from(clipPath!.children).map((child) => child.tagName.toLowerCase())
    expect(childTags).toEqual(['path'])
  })

  // 같은 화면에 두 개가 놓여도 clipPath/gradient id가 충돌하면 안 된다(useId 기반).
  it('여러 개를 렌더해도 clipPath id가 서로 다르다', () => {
    render(
      <>
        <MapleSweepSpinner />
        <MapleSweepSpinner />
      </>,
    )

    const [first, second] = screen.getAllByTestId('maple-sweep-spinner')
    const firstId = first.querySelector('clipPath')?.getAttribute('id')
    const secondId = second.querySelector('clipPath')?.getAttribute('id')
    expect(firstId).not.toBeUndefined()
    expect(firstId).not.toEqual(secondId)
  })
})
