// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MapleSpinner } from '../MapleSpinner'

afterEach(() => {
  cleanup()
})

describe('MapleSpinner', () => {
  it('장식용 아이콘이라 스크린리더에서 숨겨진다', () => {
    render(<MapleSpinner />)

    expect(screen.getByTestId('maple-spinner')).toHaveAttribute('aria-hidden', 'true')
  })

  it('size prop으로 지정한 너비만큼 렌더링된다', () => {
    render(<MapleSpinner size={40} />)

    expect(screen.getByTestId('maple-spinner')).toHaveAttribute('width', '40')
  })

  it('motion-reduce 환경에서 애니메이션을 멈추는 클래스를 포함한다', () => {
    render(<MapleSpinner />)

    const path = screen.getByTestId('maple-spinner').querySelector('path')
    expect(path).toHaveClass('motion-reduce:animate-none')
  })
})
