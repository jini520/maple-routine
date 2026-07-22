// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastStack } from '../ToastStack'
import { useToastStore } from '../../../features/toast/store'
import type { ToastItem } from '../../../features/toast/store'

vi.mock('../../../features/toast/store', () => ({ useToastStore: vi.fn() }))

const mockedStore = vi.mocked(useToastStore)

function mockStore(toasts: ToastItem[]) {
  const dismiss = vi.fn()
  mockedStore.mockReturnValue({
    toasts,
    queue: [],
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
    showError: vi.fn(),
    dismiss,
  })
  return { dismiss }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ToastStack', () => {
  it('토스트가 없으면 아무것도 렌더하지 않는다', () => {
    mockStore([])
    const { container } = render(<ToastStack />)
    expect(container).toBeEmptyDOMElement()
  })

  it('store의 toasts를 각각 렌더한다', () => {
    mockStore([
      { id: '1', variant: 'success', message: '저장했어요', duration: 2000 },
      { id: '2', variant: 'error', message: '실패했어요', duration: null },
    ])
    render(<ToastStack />)
    expect(screen.getByText('저장했어요')).toBeInTheDocument()
    expect(screen.getByText('실패했어요')).toBeInTheDocument()
  })

  // Modal과 동일한 이유(ADR 없음, Modal.tsx 주석 참고) — 부모의 레이아웃 유틸리티에 영향받지 않도록 body 직속으로 띄운다.
  it('부모 레이아웃과 무관하도록 body 직속으로 렌더링한다', () => {
    mockStore([{ id: '1', variant: 'success', message: '저장했어요', duration: 2000 }])
    const { container } = render(
      <div className="space-y-4 p-4">
        <ToastStack />
      </div>,
    )

    const stack = screen.getByTestId('toast-stack')
    expect(stack.parentElement).toBe(document.body)
    expect(container.querySelector('[data-testid="toast-stack"]')).toBeNull()
  })

  it('오래된 토스트가 위, 최신 토스트가 탭바에 가까운 아래쪽에 온다', () => {
    mockStore([
      { id: '1', variant: 'success', message: '오래된 토스트', duration: 2000 },
      { id: '2', variant: 'success', message: '최신 토스트', duration: 2000 },
    ])
    render(<ToastStack />)

    const stack = screen.getByTestId('toast-stack')
    const texts = Array.from(stack.children).map((el) => el.textContent ?? '')
    expect(texts[0]).toContain('오래된 토스트')
    expect(texts[1]).toContain('최신 토스트')
  })

  it('닫기 버튼을 누르면 해당 토스트의 id로 dismiss를 호출한다', async () => {
    const user = userEvent.setup()
    const { dismiss } = mockStore([{ id: 'toast-abc', variant: 'success', message: '저장했어요', duration: 2000 }])
    render(<ToastStack />)

    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(dismiss).toHaveBeenCalledWith('toast-abc')
  })

  it('hasTabBar가 true(기본값)면 탭바 높이만큼 띄운다', () => {
    mockStore([{ id: '1', variant: 'success', message: '저장했어요', duration: 2000 }])
    render(<ToastStack />)

    expect(screen.getByTestId('toast-stack')).toHaveClass('bottom-[calc(4rem+var(--sa-bottom)+0.75rem)]')
  })

  it('hasTabBar가 false면 안전영역 바로 위에 띄운다(온보딩 등 탭바 없는 화면)', () => {
    mockStore([{ id: '1', variant: 'success', message: '저장했어요', duration: 2000 }])
    render(<ToastStack hasTabBar={false} />)

    const stack = screen.getByTestId('toast-stack')
    expect(stack).toHaveClass('bottom-[calc(var(--sa-bottom)+0.75rem)]')
    expect(stack).not.toHaveClass('bottom-[calc(4rem+var(--sa-bottom)+0.75rem)]')
  })
})
