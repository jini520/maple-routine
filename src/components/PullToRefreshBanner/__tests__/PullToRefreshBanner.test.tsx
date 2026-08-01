// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PULL_THRESHOLD_PX } from '../../../lib/pull-to-refresh'
import { PullToRefreshBanner } from '../PullToRefreshBanner'

afterEach(() => {
  cleanup()
})

describe('PullToRefreshBanner', () => {
  it('당김이 없으면(idle) DOM에 아무것도 남기지 않는다', () => {
    const { container } = render(<PullToRefreshBanner distance={0} phase="idle" />)

    expect(screen.queryByTestId('pull-to-refresh-banner')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('당기는 중에는 "당겨서 새로고침"을 보여준다', () => {
    render(<PullToRefreshBanner distance={20} phase="pulling" />)

    expect(screen.getByText('당겨서 새로고침')).toBeInTheDocument()
  })

  it('임계값을 넘기면 "놓으면 새로고침"으로 바뀐다', () => {
    render(<PullToRefreshBanner distance={PULL_THRESHOLD_PX} phase="ready" />)

    expect(screen.getByText('놓으면 새로고침')).toBeInTheDocument()
  })

  // [[ADR-061]] 결정 9 — 말줄임표가 남는 자리는 새로고침 아이콘 옆 "조회 중..." 한 곳뿐이다.
  it('재조회 중에는 "새로고침하고 있어요"이고 ~중... 어투를 쓰지 않는다', () => {
    render(<PullToRefreshBanner distance={0} phase="refreshing" />)

    expect(screen.getByText('새로고침하고 있어요')).toBeInTheDocument()
    expect(screen.getByTestId('pull-to-refresh-banner').textContent).not.toContain('...')
  })

  it('재조회 중에만 스윕 스피너를 쓴다(당기는 중에는 없다)', () => {
    render(<PullToRefreshBanner distance={0} phase="refreshing" />)
    expect(screen.getByTestId('maple-sweep-spinner')).toBeInTheDocument()

    cleanup()

    render(<PullToRefreshBanner distance={20} phase="pulling" />)
    expect(screen.queryByTestId('maple-sweep-spinner')).toBeNull()
  })

  // 손을 떼면 distance가 0으로 돌아간다 — 그때 배너가 닫히면 재조회 표시가 사라진다.
  it('재조회 중에는 distance가 0이어도 배너 높이가 임계값과 같다', () => {
    render(<PullToRefreshBanner distance={0} phase="refreshing" />)

    expect(screen.getByTestId('pull-to-refresh-banner')).toHaveStyle({
      height: `${PULL_THRESHOLD_PX}px`,
    })
  })

  it('당김이 깊어질수록 배너 높이가 커진다', () => {
    const { rerender } = render(<PullToRefreshBanner distance={20} phase="pulling" />)
    expect(screen.getByTestId('pull-to-refresh-banner')).toHaveStyle({ height: '20px' })

    rerender(<PullToRefreshBanner distance={40} phase="pulling" />)
    expect(screen.getByTestId('pull-to-refresh-banner')).toHaveStyle({ height: '40px' })
  })

  it('당김에 비례해 잎이 회전하고 진해진다', () => {
    render(<PullToRefreshBanner distance={PULL_THRESHOLD_PX / 2} phase="pulling" />)

    const leaf = screen.getByTestId('pull-to-refresh-leaf')
    expect(leaf).toHaveStyle({ transform: 'rotate(90deg)' })
    expect(Number(leaf.style.opacity)).toBeCloseTo(0.65)
  })

  it('임계값을 넘겨 더 당겨도 잎 회전이 180deg를 넘지 않는다', () => {
    render(<PullToRefreshBanner distance={PULL_THRESHOLD_PX * 2} phase="ready" />)

    expect(screen.getByTestId('pull-to-refresh-leaf')).toHaveStyle({
      transform: 'rotate(180deg)',
      opacity: '1',
    })
  })

  // 당김 구간의 잎은 스피너가 아니라 제스처 진행률 표시다([[ADR-072]] 결정 7) —
  // 손을 멈추면 그림도 멈춰야 하므로 애니메이션 클래스가 붙으면 안 된다.
  it('잎에는 애니메이션 클래스가 없다', () => {
    render(<PullToRefreshBanner distance={30} phase="pulling" />)

    expect(screen.getByTestId('pull-to-refresh-leaf').getAttribute('class')).not.toMatch(/animate-/)
  })

  // 배너는 목록 위를 덮으므로(밀어내지 않는다) 그 아래 카드의 탭이 막히면 안 된다.
  it('루트는 흐름에 영향을 주지 않는 절대 배치이고 터치를 가로채지 않는다', () => {
    render(<PullToRefreshBanner distance={30} phase="pulling" />)

    const banner = screen.getByTestId('pull-to-refresh-banner')
    expect(banner).toHaveClass('pointer-events-none', 'absolute', 'inset-x-0', 'top-full', 'overflow-hidden')
  })

  it('상태 변화를 스크린리더에 알리고 아이콘은 숨긴다', () => {
    render(<PullToRefreshBanner distance={30} phase="pulling" />)

    const banner = screen.getByTestId('pull-to-refresh-banner')
    expect(banner).toHaveAttribute('role', 'status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByTestId('pull-to-refresh-leaf')).toHaveAttribute('aria-hidden', 'true')
  })
})
