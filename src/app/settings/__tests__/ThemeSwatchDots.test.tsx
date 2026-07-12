// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeSwatchDots } from '../ThemeSwatchDots'

afterEach(() => {
  cleanup()
})

describe('ThemeSwatchDots', () => {
  it('테마의 대표 색상 3개(primary/secondary/error)를 점으로 렌더링한다', () => {
    render(<ThemeSwatchDots theme="렌" />)

    const dots = screen.getAllByTestId('theme-swatch-dot')
    expect(dots).toHaveLength(3)
    expect(dots[0]).toHaveStyle({ backgroundColor: '#DC171D' })
    expect(dots[1]).toHaveStyle({ backgroundColor: '#437B71' })
    expect(dots[2]).toHaveStyle({ backgroundColor: '#B91C1C' })
  })

  it('레테 테마면 레테의 색상 값을 쓴다', () => {
    render(<ThemeSwatchDots theme="레테" />)

    const dots = screen.getAllByTestId('theme-swatch-dot')
    expect(dots[0]).toHaveStyle({ backgroundColor: '#9975B3' })
  })
})
