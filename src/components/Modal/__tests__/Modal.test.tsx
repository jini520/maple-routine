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

  // 오버레이가 부모의 레이아웃 유틸리티(space-y-*의 margin 등)에 영향받으면 fixed 높이가 그만큼
  // 줄어 화면 끝(상태바·제스처 영역)까지 덮지 못한다 — 실기기에서 하단 16px이 딤 처리되지 않았다.
  // body로 포털 렌더링해 부모 컨텍스트를 원천 차단한다.
  it('부모 레이아웃과 무관하도록 body 직속으로 렌더링한다', () => {
    const { container } = render(
      <div className="p-4 space-y-4">
        <p>형제 요소</p>
        <Modal onClose={vi.fn()} testId="test-modal-overlay">
          <p>모달 내용</p>
        </Modal>
      </div>,
    )

    const overlay = screen.getByTestId('test-modal-overlay')
    expect(overlay.parentElement).toBe(document.body)
    expect(container.querySelector('[data-testid="test-modal-overlay"]')).toBeNull()
  })

  // 키보드가 뜨면 WebView가 줄어드는데, 세로 중앙 정렬이면 중앙이 키보드 높이의 절반만큼 이동해
  // 모달이 크게 튄다(iOS는 플러그인이 애니메이션 없이 스냅). 상단에 고정하면 뷰포트가 줄어도
  // 위치가 변하지 않아 애초에 튈 일이 없다.
  it('기본값은 상단 정렬이며 상태바를 피해 여백을 둔다', () => {
    render(
      <Modal onClose={vi.fn()} testId="test-modal-overlay">
        <p>모달 내용</p>
      </Modal>,
    )

    const overlay = screen.getByTestId('test-modal-overlay')
    expect(overlay).toHaveClass('items-start')
    expect(overlay).toHaveClass('pt-[calc(var(--sa-top)+2rem)]')
    expect(overlay).not.toHaveClass('items-center')
  })

  it('align="center"면 세로 중앙에 놓는다 — 키보드를 띄우지 않는 모달용', () => {
    render(
      <Modal onClose={vi.fn()} testId="test-modal-overlay" align="center">
        <p>모달 내용</p>
      </Modal>,
    )

    const overlay = screen.getByTestId('test-modal-overlay')
    expect(overlay).toHaveClass('items-center')
    expect(overlay).not.toHaveClass('items-start')
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
