// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DisconnectConfirm } from '../DisconnectConfirm'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('DisconnectConfirm', () => {
  it('isOpen이 false면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <DisconnectConfirm isOpen={false} isDisconnecting={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('확인 버튼 클릭 시 onConfirm이 호출된다', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<DisconnectConfirm isOpen={true} isDisconnecting={false} onConfirm={onConfirm} onCancel={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '연결 해제' }))

    expect(onConfirm).toHaveBeenCalled()
  })

  it('취소 버튼 클릭 시 onCancel이 호출된다', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<DisconnectConfirm isOpen={true} isDisconnecting={false} onConfirm={vi.fn()} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(onCancel).toHaveBeenCalled()
  })

  it('오버레이 바깥 클릭 시 onCancel이 호출된다', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<DisconnectConfirm isOpen={true} isDisconnecting={false} onConfirm={vi.fn()} onCancel={onCancel} />)

    await user.click(screen.getByTestId('disconnect-confirm-overlay'))

    expect(onCancel).toHaveBeenCalled()
  })

  it('isDisconnecting이 true면 확인 버튼이 비활성화된다', () => {
    render(<DisconnectConfirm isOpen={true} isDisconnecting={true} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('button', { name: '해제하는 중...' })).toBeDisabled()
  })

  it('isOpen이 true면 뒷 페이지 스크롤을 막고, false가 되면 복원한다', () => {
    const { rerender } = render(
      <DisconnectConfirm isOpen={true} isDisconnecting={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(document.body.style.overflow).toBe('hidden')

    rerender(<DisconnectConfirm isOpen={false} isDisconnecting={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(document.body.style.overflow).toBe('')
  })
})
