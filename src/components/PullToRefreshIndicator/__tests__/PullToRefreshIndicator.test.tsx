// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PULL_THRESHOLD_PX } from '../../../lib/pull-to-refresh'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'

afterEach(() => {
  cleanup()
})

describe('PullToRefreshIndicator', () => {
  it('당김이 없으면(idle) DOM에 아무것도 남기지 않는다', () => {
    const { container } = render(<PullToRefreshIndicator distance={0} phase="idle" />)

    expect(screen.queryByTestId('pull-to-refresh-indicator')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('당기는 중에는 "당겨서 새로고침"을 보여준다', () => {
    render(<PullToRefreshIndicator distance={20} phase="pulling" />)

    expect(screen.getByText('당겨서 새로고침')).toBeInTheDocument()
  })

  it('임계값을 넘기면 "놓으면 새로고침"으로 바뀐다', () => {
    render(<PullToRefreshIndicator distance={PULL_THRESHOLD_PX} phase="ready" />)

    expect(screen.getByText('놓으면 새로고침')).toBeInTheDocument()
  })

  // [[ADR-061]] 결정 9 — 말줄임표가 남는 자리는 새로고침 아이콘 옆 "조회 중..." 한 곳뿐이다.
  it('재조회 중에는 "새로고침하고 있어요"이고 ~중... 어투를 쓰지 않는다', () => {
    render(<PullToRefreshIndicator distance={0} phase="refreshing" />)

    expect(screen.getByText('새로고침하고 있어요')).toBeInTheDocument()
    expect(screen.getByTestId('pull-to-refresh-indicator').textContent).not.toContain('...')
  })

  it('재조회 중에만 스윕 스피너를 쓴다(당기는 중에는 없다)', () => {
    render(<PullToRefreshIndicator distance={0} phase="refreshing" />)
    expect(screen.getByTestId('maple-sweep-spinner')).toBeInTheDocument()

    cleanup()

    render(<PullToRefreshIndicator distance={20} phase="pulling" />)
    expect(screen.queryByTestId('maple-sweep-spinner')).toBeNull()
  })

  // 손을 떼면 distance가 0으로 돌아간다 — 그때 틈이 닫히면 재조회 표시가 사라지고,
  // 목록도 제자리로 갔다 다시 내려간다([[ADR-073]] 결정 5의 정착 위치).
  it('재조회 중에는 distance가 0이어도 높이가 임계값과 같다', () => {
    render(<PullToRefreshIndicator distance={0} phase="refreshing" />)

    expect(screen.getByTestId('pull-to-refresh-indicator')).toHaveStyle({
      height: `${PULL_THRESHOLD_PX}px`,
    })
  })

  it('당김이 깊어질수록 벌어진 틈의 높이가 커진다', () => {
    const { rerender } = render(<PullToRefreshIndicator distance={20} phase="pulling" />)
    expect(screen.getByTestId('pull-to-refresh-indicator')).toHaveStyle({ height: '20px' })

    rerender(<PullToRefreshIndicator distance={40} phase="pulling" />)
    expect(screen.getByTestId('pull-to-refresh-indicator')).toHaveStyle({ height: '40px' })
  })

  it('당김에 비례해 잎이 회전하고 진해진다', () => {
    render(<PullToRefreshIndicator distance={PULL_THRESHOLD_PX / 2} phase="pulling" />)

    const leaf = screen.getByTestId('pull-to-refresh-leaf')
    expect(leaf).toHaveStyle({ transform: 'rotate(90deg)' })
    expect(Number(leaf.style.opacity)).toBeCloseTo(0.65)
  })

  it('임계값을 넘겨 더 당겨도 잎 회전이 180deg를 넘지 않는다', () => {
    render(<PullToRefreshIndicator distance={PULL_THRESHOLD_PX * 2} phase="ready" />)

    expect(screen.getByTestId('pull-to-refresh-leaf')).toHaveStyle({
      transform: 'rotate(180deg)',
      opacity: '1',
    })
  })

  // 당김 구간의 잎은 스피너가 아니라 제스처 진행률 표시다([[ADR-072]] 결정 7) —
  // 손을 멈추면 그림도 멈춰야 하므로 애니메이션 클래스가 붙으면 안 된다.
  it('잎에는 애니메이션 클래스가 없다', () => {
    render(<PullToRefreshIndicator distance={30} phase="pulling" />)

    expect(screen.getByTestId('pull-to-refresh-leaf').getAttribute('class')).not.toMatch(/animate-/)
  })

  it('루트는 흐름에 영향을 주지 않는 절대 배치이고 터치를 가로채지 않는다', () => {
    render(<PullToRefreshIndicator distance={30} phase="pulling" />)

    const indicator = screen.getByTestId('pull-to-refresh-indicator')
    expect(indicator).toHaveClass(
      'pointer-events-none',
      'absolute',
      'inset-x-0',
      'top-full',
      'overflow-hidden',
    )
  })

  // [[ADR-073]] 결정 7 — 목록이 내려가 생긴 틈은 이미 페이지 배경이라 덮을 것이 없다.
  // 불투명 면을 다시 깔면 경계선이 두 겹으로 보인다(옛 배너로의 회귀 가드).
  it('루트에 배경·테두리가 없다', () => {
    render(<PullToRefreshIndicator distance={30} phase="pulling" />)

    const indicator = screen.getByTestId('pull-to-refresh-indicator')
    expect(indicator).not.toHaveClass('bg-bg')
    expect(indicator).not.toHaveClass('border-b')
  })

  // [[ADR-073]] 결정 7 — 잎·문구는 "현재 벌어진 틈"의 세로 중앙에 있어야 틈이 커질수록 함께 내려온다.
  // 고정 h-14는 위에서부터 드러내던 옛 배너의 어법이다.
  it('내용은 고정 높이가 아니라 틈 전체(h-full)의 중앙에 놓인다', () => {
    render(<PullToRefreshIndicator distance={30} phase="pulling" />)

    const content = screen.getByTestId('pull-to-refresh-indicator').firstElementChild
    expect(content).toHaveClass('h-full', 'items-center', 'justify-center')
    expect(content).not.toHaveClass('h-14')
  })

  it('상태 변화를 스크린리더에 알리고 아이콘은 숨긴다', () => {
    render(<PullToRefreshIndicator distance={30} phase="pulling" />)

    const indicator = screen.getByTestId('pull-to-refresh-indicator')
    expect(indicator).toHaveAttribute('role', 'status')
    expect(indicator).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByTestId('pull-to-refresh-leaf')).toHaveAttribute('aria-hidden', 'true')
  })
})
