// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeHeaderBackdrop } from '../ThemeHeaderBackdrop'
import { useThemeStore } from '../../../features/theme/store'

afterEach(() => {
  cleanup()
})

function withTheme(theme: '혼테일' | '렌'): void {
  useThemeStore.setState({ theme })
}

/**
 * 헤더 배경 조각([[ADR-088]] 결정 5-1) — 배경을 가진 테마에서만 나온다.
 *
 * 조각이 하는 일은 "헤더 자리의 배경을 그리는 것"과 "그 밑으로 스크롤된 카드를 가리는 것" 둘
 * 다여서, 배색은 CSS 가 맡고(`.theme-backdrop` 과 선언 공유) 여기서는 존재 여부만 정한다.
 */
describe('ThemeHeaderBackdrop', () => {
  it('배경이 있는 테마에서는 조각을 렌더한다', () => {
    withTheme('혼테일')

    render(<ThemeHeaderBackdrop />)

    expect(screen.getByTestId('theme-header-backdrop')).toBeInTheDocument()
  })

  it('배경이 없는 테마에서는 아무것도 렌더하지 않는다 — 헤더 DOM 이 늘지 않는다', () => {
    withTheme('렌')

    const { container } = render(<ThemeHeaderBackdrop />)

    expect(container).toBeEmptyDOMElement()
  })

  // 헤더 콘텐츠를 가로채면 안 된다 — 드롭다운·버튼이 그 위에 있다.
  it('스크린 리더에서 숨기고 포인터 이벤트를 받지 않는다', () => {
    withTheme('혼테일')

    render(<ThemeHeaderBackdrop />)

    const backdrop = screen.getByTestId('theme-header-backdrop')
    expect(backdrop).toHaveAttribute('aria-hidden', 'true')
    expect(backdrop.className).toContain('theme-header-backdrop')
  })
})
