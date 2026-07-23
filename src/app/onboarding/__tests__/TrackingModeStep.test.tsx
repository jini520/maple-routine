// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrackingModeStep } from '../TrackingModeStep'

afterEach(() => {
  cleanup()
})

describe('TrackingModeStep', () => {
  it('기본 선택은 자동이다', () => {
    render(<TrackingModeStep onSubmit={vi.fn()} />)

    expect(screen.getByRole('button', { name: /자동/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /수동/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('수동 옵션을 클릭하면 aria-pressed가 바뀐다', () => {
    render(<TrackingModeStep onSubmit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /수동/ }))

    expect(screen.getByRole('button', { name: /수동/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /자동/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('기본값(자동)으로 계속하기를 누르면 auto로 onSubmit이 호출된다', () => {
    const onSubmit = vi.fn()
    render(<TrackingModeStep onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: '계속하기' }))

    expect(onSubmit).toHaveBeenCalledWith('auto')
  })

  it('수동을 선택하고 계속하기를 누르면 manual로 onSubmit이 호출된다', () => {
    const onSubmit = vi.fn()
    render(<TrackingModeStep onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: /수동/ }))
    fireEvent.click(screen.getByRole('button', { name: '계속하기' }))

    expect(onSubmit).toHaveBeenCalledWith('manual')
  })
})
