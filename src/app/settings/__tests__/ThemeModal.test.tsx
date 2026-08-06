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

  // 적용은 즉시지만 닫기는 따라오지 않는다 — 모달이 남아야 그 자리에서 갈아입혀 본다
  // ([[ADR-104]] 결정 7).
  it('테마를 선택하면 selectTheme 만 호출하고 모달은 열려 있다', async () => {
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
    expect(onClose).not.toHaveBeenCalled()
  })

  it('연달아 고르면 그때마다 적용되고 모달은 그대로 남는다', async () => {
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
    await user.click(screen.getByRole('button', { name: '머쉬맘' }))

    expect(selectTheme).toHaveBeenNthCalledWith(1, '레테')
    expect(selectTheme).toHaveBeenNthCalledWith(2, '머쉬맘')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('완료를 누르면 닫힌다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mockedUseThemeStore.mockReturnValue({
      theme: '렌',
      restoreFromStorage: vi.fn(),
      selectTheme: vi.fn(),
    })

    render(<ThemeModal onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: '완료' }))

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
