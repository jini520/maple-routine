// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeModal } from '../ThemeModal'
import { useThemeStore } from '../../../features/theme/store'

vi.mock('../../../features/theme/store', () => ({
  useThemeStore: vi.fn(),
}))

const mockedUseThemeStore = vi.mocked(useThemeStore)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ThemeModal', () => {
  it('현재 테마와 선택지를 보여준다', () => {
    mockedUseThemeStore.mockReturnValue({
      theme: '렌',
      restoreFromStorage: vi.fn(),
      selectTheme: vi.fn(),
    })

    render(<ThemeModal onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: '렌' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '레테' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('테마를 선택하면 selectTheme 호출 후 모달이 닫힌다', async () => {
    const user = userEvent.setup()
    const selectTheme = vi.fn()
    const onClose = vi.fn()
    mockedUseThemeStore.mockReturnValue({
      theme: '렌',
      restoreFromStorage: vi.fn(),
      selectTheme,
    })

    render(<ThemeModal onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: '레테' }))

    expect(selectTheme).toHaveBeenCalledWith('레테')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('오버레이 클릭 시 onClose가 호출된다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mockedUseThemeStore.mockReturnValue({ theme: '렌', restoreFromStorage: vi.fn(), selectTheme: vi.fn() })

    render(<ThemeModal onClose={onClose} />)
    await user.click(screen.getByTestId('theme-modal-overlay'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
