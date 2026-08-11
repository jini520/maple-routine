// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LoadingState } from '../LoadingState'

afterEach(() => {
  cleanup()
})

describe('LoadingState', () => {
  it('대기 문구를 보여준다', () => {
    render(<LoadingState message="불러오고 있어요" />)

    expect(screen.getByText('불러오고 있어요')).toBeInTheDocument()
  })

  it('보조기술에 진행 중임을 알린다', () => {
    render(<LoadingState message="불러오고 있어요" />)

    const state = screen.getByTestId('loading-state')
    expect(state).toHaveAttribute('role', 'status')
    expect(state).toHaveAttribute('aria-busy', 'true')
  })

  // ADR-061 결정 2 — 로딩이 끝나면 그 자리를 채울 카드와 같은 껍데기(실선 surface)여야
  // 결과가 들어와도 배경이 바뀌지 않는다.
  it('셸 승계 카드 껍데기를 두른다', () => {
    render(<LoadingState message="불러오고 있어요" />)

    expect(screen.getByTestId('loading-state')).toHaveClass('border', 'border-border', 'bg-surface')
  })

  // ADR-061 결정 3 — 점선은 빈 상태(EmptyState)의 어법이라 로딩이 쓰면 구분되지 않는다.
  it('점선 테두리를 쓰지 않는다', () => {
    render(<LoadingState message="불러오고 있어요" />)

    expect(screen.getByTestId('loading-state')).not.toHaveClass('border-dashed')
  })

  it('기본(inline)은 24px 스피너를 쓴다', () => {
    render(<LoadingState message="불러오고 있어요" />)

    expect(screen.getByTestId('maple-sweep-spinner')).toHaveAttribute('width', '24')
  })

  it('page 변형은 32px 스피너로 커진다', () => {
    render(<LoadingState message="불러오고 있어요" size="page" />)

    expect(screen.getByTestId('maple-sweep-spinner')).toHaveAttribute('width', '32')
  })
})
