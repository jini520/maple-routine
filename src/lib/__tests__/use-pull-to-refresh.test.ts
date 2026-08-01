// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PULL_MAX_PX } from '../pull-to-refresh'
import { usePullToRefresh } from '../use-pull-to-refresh'

// jsdom에는 TouchEvent·Touch 생성자가 없다. 훅이 읽는 필드(touches[].clientY)만 가진 합성 이벤트를 만든다.
function touchEvent(type: string, ...clientYs: number[]): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: clientYs.map((clientY) => ({ clientY })),
  })
  return event
}

function dispatch(event: Event): void {
  act(() => {
    document.dispatchEvent(event)
  })
}

// 이벤트가 bubbles: true라 자식에서 쏘아도 document 리스너에 닿는다. 다른 점은 event.target 뿐이다.
function dispatchFrom(target: EventTarget, event: Event): void {
  act(() => {
    target.dispatchEvent(event)
  })
}

// jsdom의 window.scrollY는 읽기 전용이라 정의를 덮어쓴다.
function setScrollY(value: number): void {
  Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true })
}

// jsdom은 레이아웃을 계산하지 않아 scrollHeight·clientHeight가 둘 다 0이다. "스크롤 가능한가"를 직접 심는다.
// overflow-y는 인라인 스타일로 주면 getComputedStyle이 그대로 읽는다.
const appended: HTMLElement[] = []
function appendDiv(
  props: { overflowY?: string; scrollHeight?: number; clientHeight?: number } = {},
  parent: HTMLElement = document.body,
): HTMLElement {
  const element = document.createElement('div')
  if (props.overflowY !== undefined) element.style.overflowY = props.overflowY
  Object.defineProperty(element, 'scrollHeight', {
    value: props.scrollHeight ?? 0,
    configurable: true,
  })
  Object.defineProperty(element, 'clientHeight', {
    value: props.clientHeight ?? 0,
    configurable: true,
  })
  parent.appendChild(element)
  if (parent === document.body) appended.push(element)
  return element
}

afterEach(() => {
  cleanup()
  setScrollY(0)
  appended.splice(0).forEach((element) => element.remove())
  document.body.style.overflow = ''
  document.body.style.overflowY = ''
  Reflect.deleteProperty(document.body, 'scrollHeight')
  Reflect.deleteProperty(document.body, 'clientHeight')
})

describe('usePullToRefresh', () => {
  it('임계값을 넘겨 당겼다 놓으면 onRefresh를 한 번 호출한다', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() =>
      usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh }),
    )

    dispatch(touchEvent('touchstart', 0))
    dispatch(touchEvent('touchmove', 200))

    // 200 * 0.5 = 100 → 상한 80에서 멈추고, 임계값 56을 넘었으니 ready다.
    expect(result.current.distance).toBe(PULL_MAX_PX)
    expect(result.current.phase).toBe('ready')

    dispatch(touchEvent('touchend'))

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(result.current.distance).toBe(0)
  })

  it('당기는 동안 touchmove의 기본 동작을 막는다', () => {
    // 네이티브 스크롤과 배너가 같은 손가락을 나눠 갖지 않도록 preventDefault가 필요하다
    // (그래서 리스너가 { passive: false }여야 한다).
    renderHook(() => usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh: vi.fn() }))

    dispatch(touchEvent('touchstart', 0))
    const move = touchEvent('touchmove', 40)
    dispatch(move)

    expect(move.defaultPrevented).toBe(true)
  })

  it('임계값 미만에서 놓으면 onRefresh를 호출하지 않는다', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() =>
      usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh }),
    )

    dispatch(touchEvent('touchstart', 0))
    dispatch(touchEvent('touchmove', 40)) // 40 * 0.5 = 20 < 56

    expect(result.current.phase).toBe('pulling')

    dispatch(touchEvent('touchend'))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('최상단이 아니면(window.scrollY > 0) 당겨도 onRefresh를 호출하지 않는다', () => {
    const onRefresh = vi.fn()
    renderHook(() => usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh }))

    setScrollY(120)
    dispatch(touchEvent('touchstart', 0))
    dispatch(touchEvent('touchmove', 200))
    dispatch(touchEvent('touchend'))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('enabled가 false면 당겨도 호출되지 않고 phase가 항상 idle이다', () => {
    const onRefresh = vi.fn()
    const { result, rerender } = renderHook(
      ({ isRefreshing }) => usePullToRefresh({ enabled: false, isRefreshing, onRefresh }),
      { initialProps: { isRefreshing: false } },
    )

    dispatch(touchEvent('touchstart', 0))
    dispatch(touchEvent('touchmove', 200))
    dispatch(touchEvent('touchend'))

    expect(onRefresh).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('idle')

    // 재조회 중이어도 배너를 띄우지 않는다.
    rerender({ isRefreshing: true })

    expect(result.current.phase).toBe('idle')
  })

  it('재조회 중(isRefreshing)에 시작한 당김은 onRefresh를 호출하지 않는다', () => {
    // ADR-072 결정 12 — 연타로 refresh가 중첩되면 무의미한 왕복만 늘어난다.
    const onRefresh = vi.fn()
    renderHook(() => usePullToRefresh({ enabled: true, isRefreshing: true, onRefresh }))

    dispatch(touchEvent('touchstart', 0))
    dispatch(touchEvent('touchmove', 200))
    dispatch(touchEvent('touchend'))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('위로 움직이면 추적이 끊겨 그 뒤 아래로 크게 당겨도 호출되지 않는다', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() =>
      usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh }),
    )

    dispatch(touchEvent('touchstart', 100))
    dispatch(touchEvent('touchmove', 60)) // 위로 — 평범한 스크롤이다

    expect(result.current.distance).toBe(0)

    dispatch(touchEvent('touchmove', 400))
    dispatch(touchEvent('touchend'))

    expect(onRefresh).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('idle')
  })

  it('손가락이 둘이면 추적을 시작하지 않는다', () => {
    const onRefresh = vi.fn()
    renderHook(() => usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh }))

    dispatch(touchEvent('touchstart', 0, 10)) // 핀치/줌이지 당김이 아니다
    dispatch(touchEvent('touchmove', 200))
    dispatch(touchEvent('touchend'))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('touchcancel이 오면 onRefresh를 호출하지 않고 당김만 되돌린다', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() =>
      usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh }),
    )

    dispatch(touchEvent('touchstart', 0))
    dispatch(touchEvent('touchmove', 200))
    dispatch(touchEvent('touchcancel'))

    expect(onRefresh).not.toHaveBeenCalled()
    expect(result.current.distance).toBe(0)
    expect(result.current.phase).toBe('idle')
  })

  it('제스처로 시작하지 않은 재조회(헤더 버튼)에는 phase가 refreshing이 아니다', () => {
    // ADR-072 결정 11 — 그 대기는 아이콘 회전 + `조회 중...`이 이미 말하고 있다.
    const { result } = renderHook(() =>
      usePullToRefresh({ enabled: true, isRefreshing: true, onRefresh: vi.fn() }),
    )

    expect(result.current.phase).toBe('idle')
  })

  it('제스처로 시작한 재조회 동안에는 phase가 refreshing이고, 끝나면 idle로 돌아간다', () => {
    const onRefresh = vi.fn()
    const { result, rerender } = renderHook(
      ({ isRefreshing }) => usePullToRefresh({ enabled: true, isRefreshing, onRefresh }),
      { initialProps: { isRefreshing: false } },
    )

    dispatch(touchEvent('touchstart', 0))
    dispatch(touchEvent('touchmove', 200))
    dispatch(touchEvent('touchend'))

    rerender({ isRefreshing: true })
    expect(result.current.phase).toBe('refreshing')

    rerender({ isRefreshing: false })
    expect(result.current.phase).toBe('idle')
  })

  it('언마운트 뒤에는 document 이벤트가 와도 호출되지 않는다', () => {
    const onRefresh = vi.fn()
    const { unmount } = renderHook(() =>
      usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh }),
    )

    unmount()

    dispatch(touchEvent('touchstart', 0))
    dispatch(touchEvent('touchmove', 200))
    dispatch(touchEvent('touchend'))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  describe('스크롤 가능한 조상 안에서 시작한 터치 (ADR-072 결정 14)', () => {
    it('스크롤 가능한 오버레이 안에서 시작한 당김은 onRefresh를 호출하지 않는다', () => {
      // 모달·바텀시트가 떠 있으면 body 스크롤이 잠겨 window.scrollY는 0 그대로다. 최상단 판정만으로는
      // 오버레이 내부 스크롤 의도까지 페이지 당김으로 흡수한다.
      const onRefresh = vi.fn()
      renderHook(() => usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh }))

      document.body.style.overflow = 'hidden'
      const overlay = appendDiv({ overflowY: 'auto', scrollHeight: 900, clientHeight: 400 })
      const inner = appendDiv({}, overlay) // 실제로 손가락이 닿는 곳은 스크롤러 안의 카드다

      dispatchFrom(inner, touchEvent('touchstart', 0))
      dispatchFrom(inner, touchEvent('touchmove', 200))
      dispatchFrom(inner, touchEvent('touchend'))

      expect(onRefresh).not.toHaveBeenCalled()
    })

    it('그 경우 touchmove의 기본 동작을 막지 않는다(내부 스크롤이 살아 있어야 한다)', () => {
      renderHook(() => usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh: vi.fn() }))

      document.body.style.overflow = 'hidden'
      const overlay = appendDiv({ overflowY: 'auto', scrollHeight: 900, clientHeight: 400 })

      dispatchFrom(overlay, touchEvent('touchstart', 0))
      const move = touchEvent('touchmove', 200)
      dispatchFrom(overlay, move)

      expect(move.defaultPrevented).toBe(false)
    })

    it('오버레이가 스크롤 불가면(scrollHeight === clientHeight) 당김이 정상 동작한다', () => {
      // 검사가 과하게 잡으면 내용이 짧은 모달 뒤에서 제스처가 통째로 죽는다.
      const onRefresh = vi.fn()
      renderHook(() => usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh }))

      const overlay = appendDiv({ overflowY: 'auto', scrollHeight: 400, clientHeight: 400 })

      dispatchFrom(overlay, touchEvent('touchstart', 0))
      dispatchFrom(overlay, touchEvent('touchmove', 200))
      dispatchFrom(overlay, touchEvent('touchend'))

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('평범한 페이지 요소에서 시작한 당김은 종전대로 동작한다', () => {
      const onRefresh = vi.fn()
      renderHook(() => usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh }))

      const card = appendDiv({ scrollHeight: 900, clientHeight: 400 }) // overflow가 없으니 스크롤러가 아니다

      dispatchFrom(card, touchEvent('touchstart', 0))
      dispatchFrom(card, touchEvent('touchmove', 200))
      dispatchFrom(card, touchEvent('touchend'))

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('document.body에서 시작한 당김은 동작한다(문서 스크롤 루트는 배제 대상이 아니다)', () => {
      // 페이지 자신은 당김의 대상이다 — 루트에 걸린 overflow를 보고 제스처를 끄면 안 된다.
      const onRefresh = vi.fn()
      renderHook(() => usePullToRefresh({ enabled: true, isRefreshing: false, onRefresh }))

      document.body.style.overflowY = 'auto'
      Object.defineProperty(document.body, 'scrollHeight', { value: 2000, configurable: true })
      Object.defineProperty(document.body, 'clientHeight', { value: 800, configurable: true })

      dispatchFrom(document.body, touchEvent('touchstart', 0))
      dispatchFrom(document.body, touchEvent('touchmove', 200))
      dispatchFrom(document.body, touchEvent('touchend'))

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })
  })
})
