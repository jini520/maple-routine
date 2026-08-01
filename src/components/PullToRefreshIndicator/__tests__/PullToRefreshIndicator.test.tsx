// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PULL_THRESHOLD_PX } from '../../../lib/pull-to-refresh'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'

afterEach(() => {
  cleanup()
})

function ringPath(): SVGPathElement {
  return screen.getByTestId('pull-to-refresh-leaf').querySelector('path') as SVGPathElement
}

describe('PullToRefreshIndicator', () => {
  it('당김이 없으면(idle) DOM에 아무것도 남기지 않는다', () => {
    const { container } = render(<PullToRefreshIndicator distance={0} phase="idle" />)

    expect(screen.queryByTestId('pull-to-refresh-indicator')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  // [[ADR-074]] 결정 1 — 마크 하나가 진행률과 대기를 모두 말하므로 문구는 잉여다.
  // 옛 3상태 문구가 되살아나면 여기서 잡힌다.
  it('어느 단계에서도 문구를 렌더하지 않는다', () => {
    for (const phase of ['pulling', 'ready', 'refreshing'] as const) {
      render(<PullToRefreshIndicator distance={30} phase={phase} />)

      expect(screen.queryByText('당겨서 새로고침')).toBeNull()
      expect(screen.queryByText('놓으면 새로고침')).toBeNull()
      expect(screen.queryByText('새로고침하고 있어요')).toBeNull()
      expect(screen.getByTestId('pull-to-refresh-indicator').textContent).toBe('')

      cleanup()
    }
  })

  // [[ADR-074]] 결정 7 — 문구가 없으면 role="status"는 읽을 것이 없는 빈 라이브 리전이다.
  // 재조회 상태는 헤더의 "조회 중..."이 이미 알린다([[ADR-061]] 결정 8).
  it('루트를 접근성 트리에서 숨기고 라이브 리전을 두지 않는다', () => {
    render(<PullToRefreshIndicator distance={30} phase="pulling" />)

    const indicator = screen.getByTestId('pull-to-refresh-indicator')
    expect(indicator).toHaveAttribute('aria-hidden', 'true')
    expect(indicator).not.toHaveAttribute('role')
    expect(indicator).not.toHaveAttribute('aria-live')
  })

  // [[ADR-074]] 결정 2 — 채움 잎이 아니라 외곽선 링이다(채움으로의 회귀 가드).
  it('당김 구간의 마크는 채움이 아니라 외곽선 링이다', () => {
    render(<PullToRefreshIndicator distance={30} phase="pulling" />)

    const path = ringPath()
    expect(path).toHaveAttribute('fill', 'none')
    expect(path).toHaveAttribute('stroke', 'currentColor')
    expect(path).toHaveAttribute('pathLength', '300')
    expect(path).toHaveAttribute('stroke-dasharray', '300 300')
  })

  // [[ADR-074]] 결정 3 — 남은 호가 그대로 남은 거리다. 회전이 아니라 드로잉으로 진행률을 말한다.
  it('당김이 깊어질수록 링이 이어져 그려진다', () => {
    const { rerender } = render(<PullToRefreshIndicator distance={0} phase="pulling" />)
    expect(ringPath()).toHaveAttribute('stroke-dashoffset', '300')

    rerender(<PullToRefreshIndicator distance={PULL_THRESHOLD_PX / 2} phase="pulling" />)
    expect(ringPath()).toHaveAttribute('stroke-dashoffset', '150')

    rerender(<PullToRefreshIndicator distance={PULL_THRESHOLD_PX} phase="ready" />)
    expect(ringPath()).toHaveAttribute('stroke-dashoffset', '0')
  })

  it('임계값을 넘겨 더 당겨도 링이 완성 상태를 넘지 않는다', () => {
    render(<PullToRefreshIndicator distance={PULL_THRESHOLD_PX * 2} phase="ready" />)

    expect(Number(ringPath().getAttribute('stroke-dashoffset'))).toBe(0)
  })

  // 당김 구간의 링은 스피너가 아니라 제스처 진행률 표시다([[ADR-074]] 결정 3) —
  // 손을 멈추면 그림도 멈춰야 하므로 애니메이션 클래스가 붙으면 안 된다.
  it('당김 구간의 링에는 애니메이션 클래스가 없다', () => {
    render(<PullToRefreshIndicator distance={30} phase="pulling" />)

    const svgClass = screen.getByTestId('pull-to-refresh-leaf').getAttribute('class') ?? ''
    const pathClass = ringPath().getAttribute('class') ?? ''
    expect(svgClass).not.toMatch(/animate-/)
    expect(pathClass).not.toMatch(/animate-/)
  })

  // [[ADR-074]] 결정 4·5 — 같은 링이 그대로 돈다. 스윕 스피너는 이 자리에서 쓰지 않는다.
  it('재조회 구간은 트레일 링 스피너이고 스윕 스피너가 아니다', () => {
    render(<PullToRefreshIndicator distance={0} phase="refreshing" />)
    expect(screen.getByTestId('maple-spinner')).toBeInTheDocument()
    expect(screen.queryByTestId('maple-sweep-spinner')).toBeNull()
    expect(screen.queryByTestId('pull-to-refresh-leaf')).toBeNull()

    cleanup()

    render(<PullToRefreshIndicator distance={20} phase="pulling" />)
    expect(screen.queryByTestId('maple-spinner')).toBeNull()
    expect(screen.queryByTestId('maple-sweep-spinner')).toBeNull()
  })

  // [[ADR-074]] 결정 6 — 손을 떼는 순간 마크가 커지거나 작아지면 한 동작이 두 개로 끊겨 보인다.
  it('당김 구간과 재조회 구간의 마크 크기가 같다', () => {
    render(<PullToRefreshIndicator distance={PULL_THRESHOLD_PX} phase="ready" />)
    const pulling = screen.getByTestId('pull-to-refresh-leaf')
    const pullingSize = [pulling.getAttribute('width'), pulling.getAttribute('height')]

    cleanup()

    render(<PullToRefreshIndicator distance={0} phase="refreshing" />)
    const refreshing = screen.getByTestId('maple-spinner')

    expect(pullingSize).toEqual([
      refreshing.getAttribute('width'),
      refreshing.getAttribute('height'),
    ])
    expect(pullingSize[0]).toBe('28')
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

  // [[ADR-073]] 결정 7 — 마크는 "현재 벌어진 틈"의 세로 중앙에 있어야 틈이 커질수록 함께 내려온다.
  // 고정 h-14는 위에서부터 드러내던 옛 배너의 어법이다.
  it('내용은 고정 높이가 아니라 틈 전체(h-full)의 중앙에 놓인다', () => {
    render(<PullToRefreshIndicator distance={30} phase="pulling" />)

    const content = screen.getByTestId('pull-to-refresh-indicator').firstElementChild
    expect(content).toHaveClass('h-full', 'items-center', 'justify-center')
    expect(content).not.toHaveClass('h-14')
  })
})
