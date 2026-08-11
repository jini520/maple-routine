// @vitest-environment jsdom
//
// ADR-112 — `fixed` 헤더가 흐름에서 빠진 자리를 채우는 spacer 높이 실측 훅.
// 이 파일이 지키는 것은 **갱신 경로가 둘**이라는 것이다: 매 커밋 도는 측정 layout effect(렌더로
// 높이가 바뀌는 경우)와 `ResizeObserver`(렌더 밖에서 바뀌는 경우). 어느 한쪽을 지우면 아래
// 케이스 중 하나가 반드시 깨진다.
import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMeasuredHeight } from '../use-measured-height'

// jsdom 은 레이아웃을 계산하지 않아 `getBoundingClientRect()` 가 늘 0 이다. 이 훅의 요점은
// **높이가 바뀌는 순간**이라 고정값(`mockReturnValue`)으로는 부족하다 — 가변 변수를 읽는 mock 을
// 걸어 테스트 도중 값을 바꾸고 리렌더를 태운다.
let stubbedHeight = 0

/** 훅이 마지막으로 돌려준 콜백 ref — 렌더 사이 identity 를 비교한다(테스트 6). */
let lastRef: ((node: HTMLDivElement | null) => void) | null = null

function Probe(props: { present?: boolean; label?: string }): React.JSX.Element {
  const { ref, height } = useMeasuredHeight<HTMLDivElement>()
  // 렌더 중에 바깥 변수를 건드리지 않는다(react-hooks 순수성 규칙) — effect 에서 기록한다.
  // 커밋마다 도는 effect 라 마지막 렌더가 받은 ref 가 남는다.
  useEffect(() => {
    lastRef = ref
  })
  return (
    <div>
      {props.present !== false && (
        <div ref={ref} data-testid="bar">
          {props.label}
        </div>
      )}
      <span data-testid="height">{height}</span>
    </div>
  )
}

function measured(): number {
  return Number(screen.getByTestId('height').textContent)
}

/**
 * `ResizeObserver` 를 **이 테스트 안에서만** 스파이로 갈아 끼운다. `vitest.setup.ts` 의 전역 스텁은
 * 콜백을 절대 부르지 않는 no-op 인데, 그 성질이 테스트 2 의 판별력 그 자체라 건드리지 않는다.
 */
function installSpyResizeObserver(): {
  callbacks: ResizeObserverCallback[]
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
} {
  const callbacks: ResizeObserverCallback[] = []
  const observe = vi.fn()
  const disconnect = vi.fn()

  class SpyResizeObserver {
    observe = observe
    unobserve = vi.fn()
    disconnect = disconnect
    constructor(callback: ResizeObserverCallback) {
      callbacks.push(callback)
    }
  }
  vi.stubGlobal('ResizeObserver', SpyResizeObserver)

  return { callbacks, observe, disconnect }
}

beforeEach(() => {
  stubbedHeight = 0
  lastRef = null
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ height: stubbedHeight }) as DOMRect,
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useMeasuredHeight', () => {
  it('첫 커밋에 실측 높이를 낸다', () => {
    stubbedHeight = 128
    render(<Probe />)

    // `useLayoutEffect` 라 페인트 전에 반영된다 — `useEffect` 면 첫 프레임 spacer 가 0이라
    // 목록이 위로 튄다([[ADR-085]] 결정 1 · [[ADR-098]] 결정 2).
    expect(measured()).toBe(128)
  })

  // ★ 이슈 #168 회귀 가드([[ADR-112]] 결정 1).
  // 보스 수익에서 기간을 이동하면 헤더 안 총 수익 블록이 빠져 헤더가 ~91px 짧아지는데, 갱신 경로가
  // `ResizeObserver` 하나면 spacer 는 옛 값인 채로 한 프레임이 그려진다(RO 콜백 안의 `setState` 는
  // React 이벤트 밖이라 Scheduler 태스크로 넘어간다 — [[ADR-102]] 와 같은 성질).
  // `vitest.setup.ts` 의 RO 스텁은 콜백을 **절대 부르지 않으므로**, 이 케이스가 통과한다는 것은
  // 측정 effect 가 같은 커밋에 실제로 그 일을 했다는 뜻이다.
  it('높이를 바꾸는 리렌더에서 ResizeObserver 없이 같은 커밋에 따라온다', () => {
    stubbedHeight = 220
    const view = render(<Probe label="총 수익" />)
    expect(measured()).toBe(220)

    // 헤더 안 조건부 블록이 빠져 헤더가 짧아진 상황.
    stubbedHeight = 129
    view.rerender(<Probe />)

    expect(measured()).toBe(129)
  })

  // 보스 수익은 빈 상태에서 헤더를 통째로 렌더하지 않는다 — 콜백 ref 라 호출부가 그 상태를
  // deps 로 알려주지 않아도 훅이 요소의 등장·소멸을 따라간다([[ADR-112]] 결정 3).
  it('요소가 사라졌다 다시 나타나면 다시 잰다', () => {
    stubbedHeight = 200
    const view = render(<Probe />)
    expect(measured()).toBe(200)

    // 요소가 사라져도 마지막 실측값은 남는다 — 이 훅은 측정 시점만 정하지 값의 수명을 바꾸지 않는다.
    view.rerender(<Probe present={false} />)
    expect(measured()).toBe(200)

    stubbedHeight = 96
    view.rerender(<Probe />)
    expect(measured()).toBe(96)
  })

  // RO 를 지우는 회귀를 잡는다 — 측정 effect 는 **렌더가 일어날 때만** 돌아서 웹폰트 로드·기기
  // 회전처럼 커밋 없이 높이가 바뀌는 경로를 못 잡는다.
  it('ResizeObserver 콜백이 오면 갱신한다', () => {
    const observer = installSpyResizeObserver()
    stubbedHeight = 150
    render(<Probe />)

    expect(observer.observe).toHaveBeenCalledTimes(1)
    expect(observer.callbacks).toHaveLength(1)

    stubbedHeight = 88
    act(() => {
      observer.callbacks[0]([], {} as ResizeObserver)
    })

    expect(measured()).toBe(88)
  })

  it('언마운트하면 관찰을 끊는다', () => {
    const observer = installSpyResizeObserver()
    stubbedHeight = 100
    const view = render(<Probe />)

    view.unmount()

    expect(observer.disconnect).toHaveBeenCalled()
  })

  // 콜백 ref 를 `useCallback` 으로 고정하지 않은 회귀를 잡는다 — 매 렌더 새 함수를 넘기면 React 가
  // 커밋마다 `ref(null)` → `ref(node)` 로 떼었다 붙인다.
  it('요소가 그대로면 관찰을 다시 붙이지 않는다', () => {
    const observer = installSpyResizeObserver()
    stubbedHeight = 100
    const view = render(<Probe label="a" />)
    const firstRef = lastRef

    view.rerender(<Probe label="b" />)
    view.rerender(<Probe label="c" />)

    expect(lastRef).toBe(firstRef)
    expect(observer.observe).toHaveBeenCalledTimes(1)
  })
})
