// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from '../Modal'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('Modal', () => {
  it('children을 렌더링한다', () => {
    render(
      <Modal onClose={vi.fn()}>
        <p>모달 내용</p>
      </Modal>,
    )

    expect(screen.getByText('모달 내용')).toBeInTheDocument()
  })

  it('오버레이(바깥 영역) 클릭 시 onClose가 호출된다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} testId="test-modal-overlay">
        <p>모달 내용</p>
      </Modal>,
    )

    await user.click(screen.getByTestId('test-modal-overlay'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('카드(안쪽 영역) 클릭으로는 onClose가 호출되지 않는다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} testId="test-modal-overlay">
        <p>모달 내용</p>
      </Modal>,
    )

    await user.click(screen.getByText('모달 내용'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('card=false면 카드 테두리/배경 없이 위치 고정용 래퍼만 렌더링한다', () => {
    render(
      <Modal onClose={vi.fn()} card={false}>
        <p>모달 내용</p>
      </Modal>,
    )

    const wrapper = screen.getByText('모달 내용').parentElement
    expect(wrapper).toHaveClass('max-w-sm')
    expect(wrapper).not.toHaveClass('border')
  })

  it('열려 있는 동안 뒷 페이지(body) 스크롤을 막는다', () => {
    const { unmount } = render(
      <Modal onClose={vi.fn()}>
        <p>모달 내용</p>
      </Modal>,
    )

    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).toBe('')
  })
})
