// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AnimatedMeso } from '../AnimatedMeso'
import { clearCountUpMemory } from '../../../../lib/use-count-up'

afterEach(() => {
  cleanup()
  clearCountUpMemory()
})

describe('AnimatedMeso', () => {
  it('천 단위 구분 기호가 붙은 숫자만 낸다 — 단위도 요소도 만들지 않는다', () => {
    const { container } = render(
      <span data-testid="money">
        <AnimatedMeso identity="a" value={1_284_500_000} /> 메소
      </span>,
    )
    // 요소가 늘지 않아야 호출부의 absolute 배지 기준·textContent 규약이 그대로 유지된다.
    expect(container.querySelector('[data-testid="money"]')?.children).toHaveLength(0)
    expect(container.textContent).toBe('1,284,500,000 메소')
  })

  it('숫자와 단위 사이의 실제 공백 문자가 살아 있다 (ADR-046)', () => {
    const { container } = render(
      <span>
        <AnimatedMeso identity="a" value={0} /> 메소
      </span>,
    )
    expect(container.textContent).toBe('0 메소')
  })
})
