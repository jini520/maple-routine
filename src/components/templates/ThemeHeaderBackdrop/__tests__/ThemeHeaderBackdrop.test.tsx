// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeHeaderBackdrop } from '../ThemeHeaderBackdrop'
import { useThemeStore } from '@core/features/theme/store'
import { getThemeDefinition } from '@core/lib/theme-registry'
import jobThemes from '@core/data/job-themes.json'
import type { ThemeDefinition } from '@core/types/theme'

/**
 * **배경 있는 정의는 데이터가 아니라 여기서 주입한다**([[ADR-106]] 결정 3). 지금은 배경을 선언한
 * 테마가 0개라 `theme: '혼테일'` 로는 "있음" 분기를 못 태우는데, 이 컴포넌트가 검사받는 것은
 * 어느 테마가 배경을 갖느냐가 아니라 **`background` 유무로 렌더를 가르느냐**다.
 * "없음" 쪽은 진짜 테마로 그대로 검사한다(`mockReset` 이 원래 구현으로 되돌린다).
 */
vi.mock('@core/lib/theme-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@core/lib/theme-registry')>()
  return { ...actual, getThemeDefinition: vi.fn(actual.getThemeDefinition) }
})

afterEach(() => {
  cleanup()
  vi.mocked(getThemeDefinition).mockReset()
})

function withBackground(): void {
  useThemeStore.setState({ theme: '혼테일' })
  vi.mocked(getThemeDefinition).mockReturnValue({
    ...(jobThemes.혼테일 as ThemeDefinition),
    background: {
      image: 'hontail-cave',
      size: 'cover',
      position: 'center',
      dim: 0.82,
      fadeTop: '0px',
    },
  })
}

/**
 * 헤더 배경 조각([[ADR-088]] 결정 5-1) — 배경을 가진 테마에서만 나온다.
 *
 * 조각이 하는 일은 "헤더 자리의 배경을 그리는 것"과 "그 밑으로 스크롤된 카드를 가리는 것" 둘
 * 다여서, 배색은 CSS 가 맡고(`.theme-backdrop` 과 선언 공유) 여기서는 존재 여부만 정한다.
 */
describe('ThemeHeaderBackdrop', () => {
  it('배경이 있는 테마에서는 조각을 렌더한다', () => {
    withBackground()

    render(<ThemeHeaderBackdrop />)

    expect(screen.getByTestId('theme-header-backdrop')).toBeInTheDocument()
  })

  it('배경이 없는 테마에서는 아무것도 렌더하지 않는다 — 헤더 DOM 이 늘지 않는다', () => {
    useThemeStore.setState({ theme: '렌' })

    const { container } = render(<ThemeHeaderBackdrop />)

    expect(container).toBeEmptyDOMElement()
  })

  // 헤더 콘텐츠를 가로채면 안 된다 — 드롭다운·버튼이 그 위에 있다.
  it('스크린 리더에서 숨기고 포인터 이벤트를 받지 않는다', () => {
    withBackground()

    render(<ThemeHeaderBackdrop />)

    const backdrop = screen.getByTestId('theme-header-backdrop')
    expect(backdrop).toHaveAttribute('aria-hidden', 'true')
    expect(backdrop.className).toContain('theme-header-backdrop')
  })
})
