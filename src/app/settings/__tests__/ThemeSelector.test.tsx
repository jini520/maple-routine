// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeSelector } from '../ThemeSelector'
import { THEME_NAMES, getThemeDefinition } from '../../../lib/theme-registry'
import type { ThemeName } from '../../../types/theme'

afterEach(() => {
  cleanup()
})

const namesOfMode = (mode: 'light' | 'dark'): ThemeName[] =>
  THEME_NAMES.filter((name) => getThemeDefinition(name).mode === mode)

describe('ThemeSelector — 선택 계약', () => {
  it('현재 테마가 렌이면 렌 타일은 눌린 상태, 레테 타일은 눌리지 않은 상태다', () => {
    render(<ThemeSelector theme="렌" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '렌' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '레테' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('레테 타일을 클릭하면 onSelect가 레테로 호출된다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ThemeSelector theme="렌" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: '레테' }))

    expect(onSelect).toHaveBeenCalledWith('레테')
  })

  it('현재 테마가 머쉬맘이면 머쉬맘 타일이 눌린 상태다', () => {
    render(<ThemeSelector theme="머쉬맘" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '머쉬맘' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('머쉬맘 타일을 클릭하면 onSelect가 머쉬맘으로 호출된다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ThemeSelector theme="렌" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: '머쉬맘' }))

    expect(onSelect).toHaveBeenCalledWith('머쉬맘')
  })

  it('현재 테마가 혼테일이면 혼테일 타일이 눌린 상태다', () => {
    render(<ThemeSelector theme="혼테일" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '혼테일' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('혼테일 타일을 클릭하면 onSelect가 혼테일로 호출된다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ThemeSelector theme="렌" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: '혼테일' }))

    expect(onSelect).toHaveBeenCalledWith('혼테일')
  })
})

/**
 * 아래 검사들은 테마 이름을 나열하지 않고 **레지스트리를 순회**한다([[ADR-064]] 결정 11 방식) —
 * 테마가 수십 개로 늘어도 항목 수가 그대로다.
 */
describe('ThemeSelector — 카테고리 섹션 ([[ADR-104]] 결정 1·3)', () => {
  it('등록된 모든 테마를 보여준다', () => {
    render(<ThemeSelector theme="렌" onSelect={vi.fn()} />)

    for (const name of THEME_NAMES) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('카테고리 헤더가 기본·직업·보스 순으로 나온다', () => {
    render(<ThemeSelector theme="렌" onSelect={vi.fn()} />)

    const headers = screen.getAllByTestId('theme-category-heading').map((node) => node.textContent)
    expect(headers).toEqual(['기본', '직업', '보스'])
  })
})

describe('ThemeSelector — 라이트·다크 필터 ([[ADR-104]] 결정 3)', () => {
  it('기본값은 전체다', () => {
    render(<ThemeSelector theme="렌" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '라이트' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '다크' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('다크를 누르면 라이트 테마가 목록에서 사라진다', async () => {
    const user = userEvent.setup()
    render(<ThemeSelector theme="렌" onSelect={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '다크' }))

    for (const name of namesOfMode('dark')) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    for (const name of namesOfMode('light')) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('라이트를 누르면 다크 테마가 목록에서 사라진다', async () => {
    const user = userEvent.setup()
    render(<ThemeSelector theme="혼테일" onSelect={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '라이트' }))

    for (const name of namesOfMode('light')) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    for (const name of namesOfMode('dark')) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('걸러낸 결과가 0인 카테고리는 헤더도 사라진다', async () => {
    const user = userEvent.setup()
    render(<ThemeSelector theme="렌" onSelect={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '라이트' }))

    const surviving = new Set<string>(
      namesOfMode('light').map((name) => getThemeDefinition(name).category),
    )
    const headers = screen.getAllByTestId('theme-category-heading').map((node) => node.textContent)

    expect(headers.length).toBe(surviving.size)
    for (const header of headers) {
      expect(surviving.has(header ?? '')).toBe(true)
    }
  })

  it('전체로 되돌리면 다시 다 보인다', async () => {
    const user = userEvent.setup()
    render(<ThemeSelector theme="렌" onSelect={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '다크' }))
    await user.click(screen.getByRole('button', { name: '전체' }))

    for (const name of THEME_NAMES) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  // 라이트를 보는 중에 다크를 쓰고 있을 수 있다 — 정상으로 둔다([[ADR-104]] 결정 3).
  it('현재 선택된 테마가 필터에서 빠져도 다른 테마를 고를 수 있다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ThemeSelector theme="혼테일" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: '라이트' }))
    expect(screen.queryByRole('button', { name: '혼테일' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '머쉬맘' }))
    expect(onSelect).toHaveBeenCalledWith('머쉬맘')
  })
})

describe('ThemeSelector — 프리뷰 타일 ([[ADR-104]] 결정 2·4)', () => {
  it('타일이 그 테마의 배경색으로 자기를 칠한다', () => {
    render(<ThemeSelector theme="렌" onSelect={vi.fn()} />)

    for (const name of THEME_NAMES) {
      expect(screen.getByRole('button', { name })).toHaveStyle({
        backgroundColor: getThemeDefinition(name).bg,
      })
    }
  })

  // 목록은 색만 쓴다 — 그림을 넣으면 썸네일용 dim 값이 새로 생긴다([[ADR-104]] 결정 4).
  it('배경 이미지를 목록에서 로드하지 않는다', () => {
    const { container } = render(<ThemeSelector theme="렌" onSelect={vi.fn()} />)

    expect(container.querySelector('img')).toBeNull()
    for (const node of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(node.style.backgroundImage).toBe('')
    }
  })
})
