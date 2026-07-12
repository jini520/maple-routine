// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeSelector } from '../ThemeSelector'

afterEach(() => {
  cleanup()
})

describe('ThemeSelector', () => {
  it('현재 테마가 렌이면 렌 버튼은 눌린 상태, 레테 버튼은 눌리지 않은 상태다', () => {
    render(<ThemeSelector theme="렌" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '렌' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '레테' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('레테 버튼을 클릭하면 onSelect가 레테로 호출된다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ThemeSelector theme="렌" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: '레테' }))

    expect(onSelect).toHaveBeenCalledWith('레테')
  })
})
