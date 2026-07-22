// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toast } from '../Toast'
import type { ToastItem } from '../../../features/toast/store'

afterEach(() => {
  cleanup()
})

function makeToast(overrides: Partial<ToastItem> = {}): ToastItem {
  return {
    id: 'toast-1',
    variant: 'success',
    message: '저장했어요',
    duration: 2000,
    ...overrides,
  }
}

describe('Toast', () => {
  it('메시지를 표시한다', () => {
    render(<Toast toast={makeToast()} onDismiss={vi.fn()} />)
    expect(screen.getByText('저장했어요')).toBeInTheDocument()
  })

  it('닫기 버튼을 누르면 onDismiss가 호출된다', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<Toast toast={makeToast()} onDismiss={onDismiss} />)

    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('action이 있으면 액션 버튼이 렌더되고, 누르면 action.onClick과 onDismiss가 모두 호출된다', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    const onClick = vi.fn()
    render(
      <Toast
        toast={makeToast({ variant: 'error', duration: null, action: { label: '다시 시도', onClick } })}
        onDismiss={onDismiss}
      />,
    )

    const actionButton = screen.getByRole('button', { name: '다시 시도' })
    await user.click(actionButton)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('action이 없으면 액션 버튼을 렌더하지 않는다', () => {
    render(<Toast toast={makeToast()} onDismiss={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('error 변형은 role="alert"·aria-live="assertive"를 갖는다', () => {
    render(<Toast toast={makeToast({ variant: 'error', duration: null })} onDismiss={vi.fn()} />)
    const toast = screen.getByRole('alert')
    expect(toast).toHaveAttribute('aria-live', 'assertive')
  })

  it('success/info 변형은 role="status"·aria-live="polite"를 갖는다', () => {
    render(<Toast toast={makeToast({ variant: 'info' })} onDismiss={vi.fn()} />)
    const toast = screen.getByRole('status')
    expect(toast).toHaveAttribute('aria-live', 'polite')
  })

  it('duration이 있으면 자동 소멸 타이머 바를 렌더한다', () => {
    const { container } = render(<Toast toast={makeToast({ duration: 2000 })} onDismiss={vi.fn()} />)
    expect(container.querySelector('[data-testid="toast-timer"]')).toBeInTheDocument()
  })

  it('duration이 null이면 타이머 바를 렌더하지 않는다', () => {
    const { container } = render(
      <Toast toast={makeToast({ variant: 'error', duration: null })} onDismiss={vi.fn()} />,
    )
    expect(container.querySelector('[data-testid="toast-timer"]')).not.toBeInTheDocument()
  })

  it('임계값을 넘겨 좌우로 끌면(swipe) onDismiss가 호출된다', () => {
    const onDismiss = vi.fn()
    render(<Toast toast={makeToast()} onDismiss={onDismiss} />)
    const toast = screen.getByRole('status')

    fireEvent.pointerDown(toast, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(toast, { clientX: 120, pointerId: 1 })
    fireEvent.pointerUp(toast, { clientX: 120, pointerId: 1 })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('임계값 미만으로 끌면 onDismiss가 호출되지 않는다', () => {
    const onDismiss = vi.fn()
    render(<Toast toast={makeToast()} onDismiss={onDismiss} />)
    const toast = screen.getByRole('status')

    fireEvent.pointerDown(toast, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(toast, { clientX: 20, pointerId: 1 })
    fireEvent.pointerUp(toast, { clientX: 20, pointerId: 1 })

    expect(onDismiss).not.toHaveBeenCalled()
  })
})
