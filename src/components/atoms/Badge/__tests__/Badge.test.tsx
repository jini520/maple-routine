// @vitest-environment jsdom
//
// 기존 호출부 6곳의 DOM 을 바꾸지 않는 것이 이 테스트의 목적이다(ADR-094 결정 4).
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Badge } from '../Badge'

afterEach(() => {
  cleanup()
})

describe('Badge', () => {
  it('primary 톤의 클래스가 기존 호출부와 정확히 같다', () => {
    render(<Badge tone="primary">3</Badge>)

    expect(screen.getByText('3')).toHaveAttribute(
      'class',
      'rounded-full bg-primary-tint text-primary-ink px-2.5 py-1 text-xs font-semibold',
    )
  })

  it('third 톤은 배경·글자 토큰만 바뀐다', () => {
    render(<Badge tone="third">7</Badge>)

    expect(screen.getByText('7')).toHaveAttribute(
      'class',
      'rounded-full bg-third-tint text-third-ink px-2.5 py-1 text-xs font-semibold',
    )
  })

  it('className은 코어 뒤에 이어 붙는다 — 레이아웃은 호출부가 소유한다', () => {
    render(
      <Badge tone="primary" className="ml-auto tabular-nums">
        12
      </Badge>,
    )

    expect(screen.getByText('12')).toHaveClass('ml-auto', 'tabular-nums', 'bg-primary-tint')
  })

  it('span 속성을 그대로 전달한다', () => {
    render(
      <Badge tone="third" data-testid="count" aria-label="완료 수">
        5
      </Badge>,
    )

    expect(screen.getByTestId('count')).toHaveAttribute('aria-label', '완료 수')
  })
})
