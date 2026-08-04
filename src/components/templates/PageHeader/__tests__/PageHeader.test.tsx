// @vitest-environment jsdom
//
// ADR-094 4단계 — templates 추출. 이 테스트가 지키는 것은 4화면이 복붙하던 마크업을
// **글자 하나까지 그대로** 내는 것이다(ADR-094 결정 4).
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { domSnapshot } from '../../../../__tests__/dom-snapshot.helper'
import { PageHeader } from '../PageHeader'
import { useThemeStore } from '../../../../features/theme/store'

afterEach(() => {
  cleanup()
  useThemeStore.setState({ theme: '렌' })
})

const SHELL = 'sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2'

describe('PageHeader', () => {
  it('셸 클래스가 4화면이 쓰던 것과 정확히 같다', () => {
    const { container } = render(<PageHeader>내용</PageHeader>)

    expect(container.firstElementChild).toHaveAttribute('class', SHELL)
  })

  it('children을 space-y-4 래퍼 안에 넣는다', () => {
    render(
      <PageHeader>
        <h1>컨텐츠 스케줄러</h1>
      </PageHeader>,
    )

    const wrapper = screen.getByRole('heading').parentElement
    expect(wrapper).toHaveAttribute('class', 'space-y-4')
  })

  it('하단 페이드를 마스크와 함께 그리고, 스크린리더에서 감춘다', () => {
    const { container } = render(<PageHeader>내용</PageHeader>)

    const fade = container.querySelector('[aria-hidden="true"].top-full')
    expect(fade).toHaveClass('pointer-events-none', 'absolute', 'inset-x-0', 'h-8', 'backdrop-blur-sm')
    expect(fade).toHaveStyle({ maskImage: 'linear-gradient(to bottom, black, transparent)' })
  })

  // 배경 조각은 배경을 가진 테마에서만 나온다(ADR-088 결정 5-1) — 색만 있는 테마는 DOM 자체가
  // 늘지 않는다. PageHeader 가 그 조건부를 그대로 물려받는지 본다.
  it('배경 있는 테마에서만 테마 배경 조각이 나온다', () => {
    useThemeStore.setState({ theme: '혼테일' })
    const { rerender } = render(<PageHeader>내용</PageHeader>)
    expect(screen.getByTestId('theme-header-backdrop')).toBeInTheDocument()

    useThemeStore.setState({ theme: '렌' })
    rerender(<PageHeader>내용</PageHeader>)
    expect(screen.queryByTestId('theme-header-backdrop')).not.toBeInTheDocument()
  })

  it('자식 순서 — 배경 조각 → 내용 → 페이드', () => {
    const { container } = render(<PageHeader>내용</PageHeader>)

    expect(domSnapshot(container)).toMatchSnapshot()
  })
})

describe('PageHeader below 슬롯', () => {
  // 당겨서 새로고침 인디케이터는 absolute inset-x-0 top-full 이라 이 셸이 positioned
  // ancestor 여야 하고, 자기 주석도 "sticky 헤더 블록의 마지막 자식"이라고 못박는다.
  // children 에 섞으면 space-y-4 안으로 들어가 흐름 자식이 되어 위치가 완전히 달라진다.
  it('below는 페이드 뒤, 셸의 마지막 자식으로 놓인다', () => {
    const { container } = render(
      <PageHeader below={<div data-testid="ptr" />}>내용</PageHeader>,
    )

    const shell = container.firstElementChild
    expect(shell?.lastElementChild).toHaveAttribute('data-testid', 'ptr')
  })

  it('below를 안 주면 아무것도 더 그리지 않는다', () => {
    const { container } = render(<PageHeader>내용</PageHeader>)

    const shell = container.firstElementChild
    expect(shell?.lastElementChild).toHaveClass('top-full', 'backdrop-blur-sm')
  })
})
