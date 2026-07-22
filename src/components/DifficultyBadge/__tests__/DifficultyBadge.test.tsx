// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DifficultyBadge } from '../DifficultyBadge'

afterEach(() => {
  cleanup()
})

describe('DifficultyBadge', () => {
  it('난이도 문자열을 그대로 뱃지 텍스트로 렌더링한다', () => {
    render(<DifficultyBadge difficulty="카오스" />)

    expect(screen.getByText('카오스')).toBeInTheDocument()
  })

  it('난이도마다 서로 다른 배경 스타일을 적용한다', () => {
    render(<DifficultyBadge difficulty="익스트림" />)

    const badge = screen.getByText('익스트림')
    expect(badge.getAttribute('style')).toContain('linear-gradient')
  })
})
