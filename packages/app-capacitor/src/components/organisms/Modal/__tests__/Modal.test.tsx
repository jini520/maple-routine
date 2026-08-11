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
        <Modal.Card>
          <p>모달 내용</p>
        </Modal.Card>
      </Modal>,
    )

    expect(screen.getByText('모달 내용')).toBeInTheDocument()
  })

  it('오버레이(바깥 영역) 클릭 시 onClose가 호출된다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} testId="test-modal-overlay">
        <Modal.Card>
          <p>모달 내용</p>
        </Modal.Card>
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
        <Modal.Card>
          <p>모달 내용</p>
        </Modal.Card>
      </Modal>,
    )

    await user.click(screen.getByText('모달 내용'))

    expect(onClose).not.toHaveBeenCalled()
  })

  // 예전 `card={false}` 프롭을 대신한다 — 껍데기의 유무는 켜고 끄는 속성이 아니라
  // 어떤 패널을 쓰는가의 문제라 컴포넌트로 갈랐다(ADR-094 3단계).
  it('Modal.Panel은 카드 테두리/배경 없이 위치 고정용 래퍼만 렌더링한다', () => {
    render(
      <Modal onClose={vi.fn()}>
        <Modal.Panel>
          <p>모달 내용</p>
        </Modal.Panel>
      </Modal>,
    )

    const wrapper = screen.getByText('모달 내용').parentElement
    expect(wrapper).toHaveClass('max-w-sm')
    expect(wrapper).not.toHaveClass('border')
  })

  it('Modal.Card는 카드 껍데기(테두리·배경·패딩)를 갖는다', () => {
    render(
      <Modal onClose={vi.fn()}>
        <Modal.Card>
          <p>모달 내용</p>
        </Modal.Card>
      </Modal>,
    )

    const panel = screen.getByText('모달 내용').parentElement
    expect(panel).toHaveClass('border', 'bg-surface', 'rounded-[14px]', 'p-6', 'max-w-sm')
  })

  it('Modal.Card의 tight는 하단 패딩만 줄인다(ADR-065 결정 2)', () => {
    render(
      <Modal onClose={vi.fn()}>
        <Modal.Card tight maxWidth="max-w-xs">
          <p>모달 내용</p>
        </Modal.Card>
      </Modal>,
    )

    const panel = screen.getByText('모달 내용').parentElement
    expect(panel).toHaveClass('px-6', 'pb-4', 'pt-6', 'max-w-xs')
    expect(panel).not.toHaveClass('p-6')
  })

  // 패널이 stopPropagation을 소유하므로, 패널 없이 내용을 직접 넣으면 안쪽 클릭이
  // 오버레이까지 올라가 모달이 닫힌다. children 타입을 element로 좁혀 둔 이유다.
  it('Modal.Panel도 안쪽 클릭을 삼킨다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} testId="test-modal-overlay">
        <Modal.Panel>
          <p>모달 내용</p>
        </Modal.Panel>
      </Modal>,
    )

    await user.click(screen.getByText('모달 내용'))

    expect(onClose).not.toHaveBeenCalled()
  })

  // 오버레이가 부모의 레이아웃 유틸리티(space-y-*의 margin 등)에 영향받으면 fixed 높이가 그만큼
  // 줄어 화면 끝(상태바·제스처 영역)까지 덮지 못한다 — 실기기에서 하단 16px이 딤 처리되지 않았다.
  // body로 포털 렌더링해 부모 컨텍스트를 원천 차단한다.
  it('부모 레이아웃과 무관하도록 body 직속으로 렌더링한다', () => {
    const { container } = render(
      <div className="p-4 space-y-4">
        <p>형제 요소</p>
        <Modal onClose={vi.fn()} testId="test-modal-overlay">
          <Modal.Card>
            <p>모달 내용</p>
          </Modal.Card>
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
        <Modal.Card>
          <p>모달 내용</p>
        </Modal.Card>
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
        <Modal.Card>
          <p>모달 내용</p>
        </Modal.Card>
      </Modal>,
    )

    const overlay = screen.getByTestId('test-modal-overlay')
    expect(overlay).toHaveClass('items-center')
    expect(overlay).not.toHaveClass('items-start')
  })

  // ADR-122: 스크림 위 패널의 바깥 테두리는 라이트 테마에서 톤다운된다. 클래스가 어디에 붙는지가
  // 패널 종류마다 다르다 — Card 는 자기가 테두리를 갖고, Panel 은 직계 자식이 갖는다.
  it('Modal.Card 는 자기 자신에 panel-on-scrim 을 갖는다', () => {
    render(
      <Modal onClose={vi.fn()}>
        <Modal.Card>
          <p>모달 내용</p>
        </Modal.Card>
      </Modal>,
    )

    expect(screen.getByText('모달 내용').parentElement).toHaveClass('panel-on-scrim')
  })

  it('Modal.Panel 은 자기 자신이 아니라 직계 자식을 겨냥하는 panel-on-scrim-parent 를 갖는다', () => {
    render(
      <Modal onClose={vi.fn()}>
        <Modal.Panel>
          <div data-testid="자체-카드">모달 내용</div>
        </Modal.Panel>
      </Modal>,
    )

    const wrapper = screen.getByTestId('자체-카드').parentElement
    expect(wrapper).toHaveClass('panel-on-scrim-parent')
    // 래퍼 자신에는 테두리가 없으므로 self 선택자를 붙이면 아무 일도 안 일어난다.
    expect(wrapper).not.toHaveClass('panel-on-scrim')
  })

  it('열려 있는 동안 뒷 페이지(body) 스크롤을 막는다', () => {
    const { unmount } = render(
      <Modal onClose={vi.fn()}>
        <Modal.Card>
          <p>모달 내용</p>
        </Modal.Card>
      </Modal>,
    )

    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).toBe('')
  })
})
