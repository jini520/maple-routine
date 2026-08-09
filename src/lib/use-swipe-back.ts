import { useEffect, useRef } from 'react'
import { useScreenStackStore } from '../features/screen-stack/store'
import {
  resolveSettleMs,
  resolveTransitionMs,
  shouldPopOnRelease,
  STACK_GESTURE_SLOP_PX,
} from './stack-transition'

// 가장자리 스와이프 백([[ADR-120]] 결정 6). 왼쪽 띠에서 시작한 가로 드래그가 손가락을 따라오고,
// 놓는 순간 거리·속도로 판정한다.
//
// **WKWebView 의 `allowsBackForwardNavigationGestures` 는 쓰지 않는다** — SPA 의 `pushState`
// 히스토리를 직접 건드려 라우터 상태와 어긋난다. 직접 구현이 현실적이다.
//
// **나가는 연출은 여기 없다.** pop 이 성립하면 `onPop()`(= `navigate(-1)`)만 부르고 끝낸다 —
// 화면이 밀려 나가는 것은 `useStackLocation` 이 라우트를 한 박자 늦추며 한 곳에서 낸다
// ([[ADR-120]] 결정 9-b). 그래야 하드웨어 뒤로가기와 같은 연출을 탄다. 여기가 책임지는 것은
// **취소(원위치)** 뿐이다.

export interface SwipeBackOptions {
  /** false 면 리스너를 붙이지 않는다. */
  enabled: boolean
  /** 제스처가 성립했을 때. `navigate(-1)` 이 여기 온다. */
  onPop: () => void
}

/** 반환한 ref 를 가장자리 히트존 요소에 붙인다. */
export function useSwipeBack({ enabled, onPop }: SwipeBackOptions): React.RefObject<HTMLDivElement | null> {
  const edgeRef = useRef<HTMLDivElement | null>(null)

  // 화면이 인라인 함수를 넘기므로 의존성에 그대로 넣으면 렌더마다 리스너를 붙였다 뗀다
  // (`usePullToRefresh` 와 같은 처방).
  const onPopRef = useRef(onPop)
  useEffect(() => {
    onPopRef.current = onPop
  })

  useEffect(() => {
    const edge = edgeRef.current
    if (!enabled || edge === null) return

    const { setProgress, setDragging, setTransitionMs } = useScreenStackStore.getState()

    let startX: number | null = null
    let startY = 0
    let lastX = 0
    let lastT = 0
    let velocity = 0
    let width = 1
    // 축 판정은 제스처당 한 번만 한다. 'pending' 은 아직 어느 쪽인지 모르는 구간이다.
    let axis: 'pending' | 'horizontal' | 'abandoned' = 'pending'

    const stop = (): void => {
      startX = null
      axis = 'pending'
      setDragging(false)
    }

    const handleTouchStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1) return // 멀티터치는 핀치/줌이지 스와이프가 아니다.
      const touch = event.touches[0]
      startX = touch.clientX
      startY = touch.clientY
      lastX = touch.clientX
      lastT = event.timeStamp
      velocity = 0
      width = window.innerWidth > 0 ? window.innerWidth : 1
      axis = 'pending'
    }

    const handleTouchMove = (event: TouchEvent): void => {
      if (startX === null) return
      const touch = event.touches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY

      if (axis === 'pending') {
        // 슬롭 안에서는 아직 판정하지 않는다 — 손가락이 놓이는 순간의 미세한 흔들림으로
        // 방향을 정하면 세로 스크롤이 가로로 오인된다.
        if (Math.abs(dx) < STACK_GESTURE_SLOP_PX && Math.abs(dy) < STACK_GESTURE_SLOP_PX) return
        // 세로가 먼저 이기면 스크롤에 양보하고 이 제스처는 버린다.
        axis = Math.abs(dy) > Math.abs(dx) ? 'abandoned' : 'horizontal'
        if (axis === 'horizontal') setDragging(true)
      }
      if (axis === 'abandoned') return

      const dt = event.timeStamp - lastT
      if (dt > 0) velocity = (touch.clientX - lastX) / dt
      lastX = touch.clientX
      lastT = event.timeStamp

      // 네이티브 스크롤·오버스크롤이 같은 손가락을 가져가지 않게 막는다(리스너가 passive 면 무시된다).
      event.preventDefault()
      setProgress(dx / width)
    }

    const handleTouchEnd = (): void => {
      if (startX === null) return
      const wasHorizontal = axis === 'horizontal'
      const progress = useScreenStackStore.getState().progress
      stop()
      if (!wasHorizontal) return

      if (shouldPopOnRelease(progress, velocity)) {
        onPopRef.current()
        return
      }

      // 취소 — 남은 거리에 비례한 시간으로 제자리에 되돌린다.
      setTransitionMs(resolveSettleMs(progress, false, resolveTransitionMs()))
      setProgress(0)
    }

    edge.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
    document.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      edge.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)
      // 끌던 도중 화면이 사라지면 touchend 가 오지 않아 드래그 상태가 남는다.
      stop()
    }
  }, [enabled])

  return edgeRef
}
