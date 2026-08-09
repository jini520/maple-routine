// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StackScreen } from '../StackScreen'
import { useScreenStackStore } from '../../../../features/screen-stack/store'
import { STACK_BELOW_SHIFT_PERCENT } from '../../../../lib/stack-transition'

// 공용 스택 셸의 계약([[ADR-120]]). 값 계산은 `lib/stack-transition` 의 순수 함수 테스트가 맡고,
// 여기서는 **셸이 그 값을 언제 어디에 쓰는지**를 본다.

function LocationProbe(): React.JSX.Element {
  return <span data-testid="location">{useLocation().pathname}</span>
}

function ParentScreen(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <div>
      <span>부모 화면</span>
      <button type="button" onClick={() => navigate('/parent/child')}>
        열기
      </button>
      <Outlet />
    </div>
  )
}

function ChildScreen(): React.JSX.Element {
  return (
    <StackScreen parentPath="/parent">
      <span>자식 화면</span>
    </StackScreen>
  )
}

function renderApp(initialEntries: string[]): void {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/parent" element={<ParentScreen />}>
          <Route path="child" element={<ChildScreen />} />
        </Route>
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useScreenStackStore.setState({ depth: 0, progress: 1, isDragging: false, transitionMs: 0 })
})

afterEach(() => {
  cleanup()
})

describe('StackScreen', () => {
  it('마운트하면 스택 깊이를 올리고 화면 밖에서 시작한다', () => {
    renderApp(['/parent/child'])

    expect(useScreenStackStore.getState().depth).toBe(1)
    expect(screen.getByTestId('stack-screen')).toHaveStyle({ transform: 'translateX(100%)' })
  })

  it('언마운트하면 깊이가 내려간다 — 아래 화면의 transform 이 사라지는 지점', () => {
    renderApp(['/parent/child'])
    cleanup()

    expect(useScreenStackStore.getState().depth).toBe(0)
  })

  // ADR-077 이 중첩 라우트로 확보한 계약. 포털은 DOM 만 옮기고 트리는 그대로라 그대로 성립한다.
  it('열려 있는 동안 아래 화면이 언마운트되지 않는다', () => {
    renderApp(['/parent/child'])

    expect(screen.getByText('부모 화면')).toBeInTheDocument()
    expect(screen.getByText('자식 화면')).toBeInTheDocument()
  })

  // ADR-120 결정 3 — 탭 레이어에 transform 이 걸리면 그 안의 fixed 후손이 함께 밀린다.
  it('오버레이를 부모 DOM 안이 아니라 포털 루트에 붙인다', () => {
    const stackRoot = document.createElement('div')
    stackRoot.id = 'stack-root'
    document.body.appendChild(stackRoot)

    renderApp(['/parent/child'])

    expect(stackRoot.querySelector('[data-testid="stack-screen"]')).not.toBeNull()
    expect(screen.getByText('부모 화면').parentElement?.contains(screen.getByTestId('stack-screen'))).toBe(
      false,
    )

    stackRoot.remove()
  })

  // ADR-120 결정 7 — translateX(0) 을 남기면 containing block 이 되어 중첩 sticky 의 기준이 바뀐다.
  it('다 들어와 멈추면 transform 속성 자체가 없다', () => {
    renderApp(['/parent/child'])

    act(() => {
      useScreenStackStore.getState().setProgress(0)
    })

    expect(screen.getByTestId('stack-screen').style.transform).toBe('')
  })

  it('손가락이 붙어 있는 동안은 전환을 걸지 않는다', () => {
    renderApp(['/parent/child'])

    act(() => {
      useScreenStackStore.getState().setDragging(true)
    })

    expect(screen.getByTestId('stack-screen')).toHaveStyle({ transition: 'none' })
  })

  it('2단으로 열면 아래 층은 밀리고 위 층만 움직인다', () => {
    render(
      <MemoryRouter initialEntries={['/parent/child/grandchild']}>
        <Routes>
          <Route path="/parent" element={<ParentScreen />}>
            <Route
              path="child"
              element={
                <StackScreen parentPath="/parent">
                  <span>자식 화면</span>
                  <Outlet />
                </StackScreen>
              }
            >
              <Route
                path="grandchild"
                element={
                  <StackScreen parentPath="/parent/child">
                    <span>손자 화면</span>
                  </StackScreen>
                }
              />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    act(() => {
      useScreenStackStore.getState().setProgress(0)
    })

    // DOM 순서가 아니라 층 번호로 고른다 — 포털이 붙는 순서에 의존하지 않는다.
    const layers = screen.getAllByTestId('stack-screen')
    const child = layers.find((el) => el.dataset.stackIndex === '0')
    const grandchild = layers.find((el) => el.dataset.stackIndex === '1')

    expect(useScreenStackStore.getState().depth).toBe(2)
    expect(child).toBeDefined()
    expect(grandchild).toBeDefined()
    // 아래 층은 패럴랙스만큼 밀려 있고, 최상단은 제자리라 속성이 없다.
    expect(child).toHaveStyle({ transform: `translateX(${-STACK_BELOW_SHIFT_PERCENT}%)` })
    expect(grandchild?.style.transform).toBe('')
  })
})

describe('StackScreen 의 뒤로', () => {
  // ADR-120 결정 9 — 앞으로 새 라우트를 밀어 넣던 것을 진짜 pop 으로 바꿨다.
  it('되돌아갈 항목이 있으면 pop 한다', () => {
    renderApp(['/parent'])

    fireEvent.click(screen.getByRole('button', { name: '열기' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/parent/child')

    act(() => {
      useScreenStackStore.getState().setProgress(0)
    })
    fireEvent.touchStart(screen.getByTestId('stack-edge-zone'), {
      touches: [{ clientX: 4, clientY: 300 }],
    })
    fireEvent.touchMove(document, { touches: [{ clientX: 600, clientY: 300 }] })
    fireEvent.touchEnd(document)

    expect(screen.getByTestId('location')).toHaveTextContent('/parent')
  })

  // 딥링크·OTA 재시작으로 직접 들어오면 되돌아갈 항목이 없어 -1 이 앱을 벗어난다.
  it('직접 진입이면 부모 경로로 replace 한다', () => {
    renderApp(['/parent/child'])

    act(() => {
      useScreenStackStore.getState().setProgress(0)
    })
    fireEvent.touchStart(screen.getByTestId('stack-edge-zone'), {
      touches: [{ clientX: 4, clientY: 300 }],
    })
    fireEvent.touchMove(document, { touches: [{ clientX: 600, clientY: 300 }] })
    fireEvent.touchEnd(document)

    expect(screen.getByTestId('location')).toHaveTextContent('/parent')
  })
})

describe('가장자리 스와이프 백', () => {
  beforeEach(() => {
    renderApp(['/parent/child'])
    act(() => {
      useScreenStackStore.getState().setProgress(0)
    })
  })

  it('손가락을 따라 진행률이 올라간다', () => {
    fireEvent.touchStart(screen.getByTestId('stack-edge-zone'), {
      touches: [{ clientX: 4, clientY: 300 }],
    })
    fireEvent.touchMove(document, { touches: [{ clientX: 4 + window.innerWidth / 2, clientY: 300 }] })

    expect(useScreenStackStore.getState().isDragging).toBe(true)
    expect(useScreenStackStore.getState().progress).toBeCloseTo(0.5, 2)
  })

  // 세로가 먼저 이기면 목록 스크롤이다 — 제스처가 그것을 가로채면 안 된다.
  it('세로가 먼저 이기면 제스처를 포기한다', () => {
    fireEvent.touchStart(screen.getByTestId('stack-edge-zone'), {
      touches: [{ clientX: 4, clientY: 300 }],
    })
    fireEvent.touchMove(document, { touches: [{ clientX: 8, clientY: 380 }] })

    expect(useScreenStackStore.getState().isDragging).toBe(false)
    expect(useScreenStackStore.getState().progress).toBe(0)
  })

  it('기준에 못 미치게 끌고 놓으면 제자리로 돌아간다', () => {
    fireEvent.touchStart(screen.getByTestId('stack-edge-zone'), {
      touches: [{ clientX: 4, clientY: 300 }],
    })
    fireEvent.touchMove(document, { touches: [{ clientX: 4 + window.innerWidth * 0.1, clientY: 300 }] })
    fireEvent.touchEnd(document)

    expect(useScreenStackStore.getState().progress).toBe(0)
    expect(useScreenStackStore.getState().isDragging).toBe(false)
    expect(screen.getByTestId('location')).toHaveTextContent('/parent/child')
  })
})
