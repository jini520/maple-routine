// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PartySizeStepper } from '../PartySizeStepper'

afterEach(cleanup)

describe('PartySizeStepper', () => {
  it('값을 그리고 −/+ 로 1씩 바꾼다', async () => {
    const onChange = vi.fn()
    render(<PartySizeStepper label="스우" value={3} max={6} onChange={onChange} />)

    expect(screen.getByText('3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '스우 파티원 수 증가' }))
    expect(onChange).toHaveBeenCalledWith(4)

    await userEvent.click(screen.getByRole('button', { name: '스우 파티원 수 감소' }))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('1에서는 −가, 상한에서는 +가 비활성이다', () => {
    const { rerender } = render(<PartySizeStepper label="스우" value={1} max={6} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '스우 파티원 수 감소' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '스우 파티원 수 증가' })).toBeEnabled()

    rerender(<PartySizeStepper label="스우" value={6} max={6} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '스우 파티원 수 감소' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '스우 파티원 수 증가' })).toBeDisabled()
  })

  // 상한은 (보스, 난이도)마다 다르다 — 스우는 하드 6인, 익스트림 2인(boss-crystal-prices.json).
  it('상한이 낮아지면 그 값에서 +가 막힌다', () => {
    render(<PartySizeStepper label="스우" value={2} max={2} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: '스우 파티원 수 증가' })).toBeDisabled()
  })

  it('기본 크기(default)는 단위 "인"을 함께 그린다', () => {
    render(<PartySizeStepper label="스우" value={3} max={6} onChange={vi.fn()} />)

    expect(screen.getByText('인')).toBeInTheDocument()
  })

  // 관리 페이지 행은 좁아서 단위 없이 숫자만 — 기존 표시를 바꾸지 않는다.
  it('compact 는 단위를 그리지 않는다', () => {
    render(<PartySizeStepper label="스우" value={3} max={6} onChange={vi.fn()} size="compact" />)

    expect(screen.queryByText('인')).not.toBeInTheDocument()
  })

  it('값이 자릿수를 넘어가도 −/+ 가 움직이지 않게 tabular-nums 로 그린다', () => {
    render(<PartySizeStepper label="스우" value={6} max={6} onChange={vi.fn()} />)

    expect(screen.getByText('6')).toHaveClass('tabular-nums')
  })
})
