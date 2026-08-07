// @vitest-environment jsdom
//
// ADR-094 4단계 — templates 추출. 이 테스트가 지키는 것은 4화면이 복붙하던 마크업을
// **글자 하나까지 그대로** 내는 것이다(ADR-094 결정 4).
//
// ADR-098 결정 2 — 그 셸이 `sticky top-0` 에서 `fixed` + 실측 spacer 로 바뀌었다.
// `sticky` 요소의 화면 위치는 스크롤 오프셋의 함수라, iOS 스크롤 스레드가 옛 오프셋을
// 뒤늦게 되돌려 보내는 프레임에 헤더가 화면 밖으로 날아간다.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { domSnapshot } from '../../../../__tests__/dom-snapshot.helper'
import { PageHeader } from '../PageHeader'
import { useThemeStore } from '../../../../features/theme/store'
import { getThemeDefinition } from '../../../../lib/theme-registry'
import jobThemes from '../../../../data/job-themes.json'
import type { ThemeDefinition } from '../../../../types/theme'

// 배경 있는 테마 정의를 주입하기 위한 부분 모킹(ADR-106 결정 3). 나머지 export 는 실물 그대로다.
vi.mock('../../../../lib/theme-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../lib/theme-registry')>()
  return { ...actual, getThemeDefinition: vi.fn(actual.getThemeDefinition) }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  stubbedHeight = 0
  vi.mocked(getThemeDefinition).mockReset()
  useThemeStore.setState({ theme: '렌' })
})

const SHELL = 'fixed inset-x-0 top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2'

// jsdom 은 레이아웃이 없어 실측이 늘 0이다 — 헤더 높이를 가진 것처럼 재게 만든다.
//
// 값을 **여러 번 바꿀 수 있어야** 한다(높이가 바뀌는 커밋을 재현하는 케이스가 있다). 그래서 고정
// 반환값이 아니라 가변 변수를 읽는 mock 을 한 번만 깔고, 이후 호출은 그 변수만 바꾼다 —
// 호출 형태(`stubHeaderHeight(148)`)는 그대로다.
let stubbedHeight = 0

function stubHeaderHeight(height: number): void {
  stubbedHeight = height
  if (vi.isMockFunction(Element.prototype.getBoundingClientRect)) return

  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        height: stubbedHeight,
        width: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: stubbedHeight,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  )
}

function barOf(container: HTMLElement): Element {
  const bar = container.firstElementChild?.firstElementChild
  if (bar === null || bar === undefined) throw new Error('고정 헤더를 찾지 못했습니다')
  return bar
}

describe('PageHeader', () => {
  it('셸 클래스가 4화면이 쓰던 것과 정확히 같다', () => {
    const { container } = render(<PageHeader>내용</PageHeader>)

    expect(barOf(container)).toHaveAttribute('class', SHELL)
  })

  // ADR-098 결정 2 회귀 가드 — sticky 로 되돌리면 오프셋이 흔들리는 프레임에 헤더가 날아간다.
  it('헤더는 fixed 라 화면 위치가 스크롤 오프셋의 함수가 아니다', () => {
    const { container } = render(<PageHeader>내용</PageHeader>)

    const bar = barOf(container)
    expect(bar).toHaveClass('fixed', 'inset-x-0', 'top-0')
    expect(bar).not.toHaveClass('sticky')
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
  //
  // 배경 있는 정의는 **주입한다** — 지금은 배경을 선언한 테마가 0개라(ADR-106) 테마 이름으로는
  // "있음" 분기를 못 태우는데, 여기서 볼 것은 어느 테마가 배경을 갖느냐가 아니라 PageHeader 가
  // 그 조건부를 물려받느냐다.
  it('배경 있는 테마에서만 테마 배경 조각이 나온다', () => {
    vi.mocked(getThemeDefinition).mockReturnValue({
      ...(jobThemes.혼테일 as ThemeDefinition),
      background: { image: 'hontail-cave', size: 'cover', position: 'center', dim: 0.82, fadeTop: '0px' },
    })
    const { rerender } = render(<PageHeader>내용</PageHeader>)
    expect(screen.getByTestId('theme-header-backdrop')).toBeInTheDocument()

    vi.mocked(getThemeDefinition).mockReset()
    rerender(<PageHeader>내용</PageHeader>)
    expect(screen.queryByTestId('theme-header-backdrop')).not.toBeInTheDocument()
  })

  it('자식 순서 — 배경 조각 → 내용 → 페이드', () => {
    const { container } = render(<PageHeader>내용</PageHeader>)

    expect(domSnapshot(container)).toMatchSnapshot()
  })
})

// ADR-098 결정 2 — fixed 헤더는 흐름에서 빠지므로 목록이 헤더 아래에서 시작하도록
// 같은 높이의 spacer 를 흐름에 둔다. 보스 수익이 [[ADR-085]] 에서 한 것과 같은 형태다.
describe('PageHeader 스페이서', () => {
  it('헤더 실측 높이만큼의 spacer 를 흐름에 둔다', () => {
    stubHeaderHeight(148)
    const { container } = render(<PageHeader>내용</PageHeader>)

    const spacer = container.firstElementChild?.lastElementChild
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(spacer).toHaveStyle({ height: '148px' })
  })

  // ★ 이슈 #168 회귀 가드([[ADR-112]] 결정 1). 이 셸을 쓰는 네 화면 모두 헤더 children 안에 높이를
  // 바꾸는 조건부 블록이 있다(탭 줄·셸 승계 로딩 카드·경고 줄) — 갱신 경로가 `ResizeObserver`
  // 하나뿐이면 헤더는 이미 짧은데 spacer 는 옛 값인 프레임이 한 번 그려진다(RO 콜백 안의
  // `setState` 는 React 이벤트 밖이라 Scheduler 태스크로 넘어가 다음 프레임에 렌더된다).
  //
  // **`vitest.setup.ts` 의 RO 스텁은 콜백을 절대 부르지 않는다** — 그 전제가 이 테스트의 판별력이다.
  // 통과한다는 것은 RO 가 아니라 측정 layout effect 가 같은 커밋에 그 일을 했다는 뜻이다.
  it('헤더 내용이 바뀌어 높이가 줄면 spacer 도 같은 커밋에 줄어든다', () => {
    stubHeaderHeight(220)
    const { container, rerender } = render(
      <PageHeader>
        <h1>보스 스케줄러</h1>
        <div>일간 / 주간 탭 줄</div>
      </PageHeader>,
    )
    const spacer = container.firstElementChild?.lastElementChild
    expect(spacer).toHaveStyle({ height: '220px' })

    // 탭 줄이 빠져 헤더가 짧아진 커밋.
    stubHeaderHeight(129)
    rerender(
      <PageHeader>
        <h1>보스 스케줄러</h1>
      </PageHeader>,
    )

    expect(spacer).toHaveStyle({ height: '129px' })
  })

  it('실측 전(높이 0)에도 spacer 자리는 존재한다', () => {
    const { container } = render(<PageHeader>내용</PageHeader>)

    const spacer = container.firstElementChild?.lastElementChild
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(spacer).toHaveStyle({ height: '0px' })
  })

  // 프래그먼트로 반환하면 화면 루트의 `space-y-4` 가 spacer 에도 margin-top 을 얹어 목록이
  // 16px 내려간다([[ADR-085]] 가 보스 수익에서 겪은 것과 같은 함정) — 래퍼 하나로 감싸
  // 흐름에서 차지하는 자리를 헤더 하나로 유지한다.
  it('고정 헤더와 spacer 를 래퍼 하나로 묶어 화면 루트의 형제 수를 늘리지 않는다', () => {
    const { container } = render(
      <div className="-mt-[var(--sa-top)] space-y-4">
        <PageHeader>내용</PageHeader>
        <div data-testid="list" />
      </div>,
    )

    const root = container.firstElementChild
    expect(root?.children).toHaveLength(2)
    expect(root?.lastElementChild).toHaveAttribute('data-testid', 'list')
    // 고정 헤더는 래퍼 안에 있다 — 루트의 직계 자식이면 space-y-4 가 spacer 에 마진을 얹는다.
    expect(root?.firstElementChild?.className).toBe('')
    expect(barOf(root as HTMLElement)).toHaveClass('fixed')
  })
})

describe('PageHeader below 슬롯', () => {
  // 당겨서 새로고침 인디케이터는 absolute inset-x-0 top-full 이라 이 셸이 positioned
  // ancestor 여야 하고, 자기 주석도 "고정 헤더 블록의 마지막 자식"이라고 못박는다.
  // children 에 섞으면 space-y-4 안으로 들어가 흐름 자식이 되어 위치가 완전히 달라진다.
  it('below는 페이드 뒤, 셸의 마지막 자식으로 놓인다', () => {
    const { container } = render(
      <PageHeader below={<div data-testid="ptr" />}>내용</PageHeader>,
    )

    expect(barOf(container).lastElementChild).toHaveAttribute('data-testid', 'ptr')
  })

  it('below를 안 주면 아무것도 더 그리지 않는다', () => {
    const { container } = render(<PageHeader>내용</PageHeader>)

    expect(barOf(container).lastElementChild).toHaveClass('top-full', 'backdrop-blur-sm')
  })
})
