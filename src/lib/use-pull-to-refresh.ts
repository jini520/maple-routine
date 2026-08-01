import { useEffect, useRef, useState } from 'react'
import { resolvePullDistance, resolvePullPhase, shouldTriggerRefresh } from './pull-to-refresh'
import type { PullPhase } from './pull-to-refresh'

export interface PullToRefreshOptions {
  /** false면 리스너를 아예 붙이지 않고 항상 idle을 반환한다. */
  enabled: boolean
  /** 화면의 재조회 대기 상태(세 화면 공통으로 status === 'loading'). */
  isRefreshing: boolean
  /** 임계값을 넘겨 놓았을 때 호출된다. */
  onRefresh: () => void
}

export interface PullToRefreshState {
  distance: number
  phase: PullPhase
}

// 목록 최상단에서 아래로 당기는 제스처를 감지한다([[ADR-072]]). 이 앱에는 overflow 스크롤 컨테이너가
// 없고 문서 전체가 스크롤되므로(결정 1·2) 컨테이너 ref가 아니라 document 리스너 + window.scrollY 로
// 판정한다. 임계값·감쇠 계산은 전부 pull-to-refresh.ts 의 순수 함수가 갖는다.
export function usePullToRefresh({
  enabled,
  isRefreshing,
  onRefresh,
}: PullToRefreshOptions): PullToRefreshState {
  const [distance, setDistance] = useState(0)

  // 화면이 `onRefresh: () => refresh(trackedOcids ?? [])` 같은 인라인 함수를 넘기므로 의존성에 그대로
  // 넣으면 렌더마다 리스너를 붙였다 뗀다. isRefreshing 도 같은 이유로 ref에서 최신 값만 읽는다.
  const onRefreshRef = useRef(onRefresh)
  const isRefreshingRef = useRef(isRefreshing)
  useEffect(() => {
    onRefreshRef.current = onRefresh
    isRefreshingRef.current = isRefreshing
  })

  // "이번 재조회를 제스처가 시작했는가" — 헤더 버튼이 시작한 재조회에는 배너를 열지 않는다(결정 11).
  // 재조회가 끝나면(isRefreshing이 false로 돌아오면) 해제해, 다음 버튼 재조회에 배너가 새지 않게 한다.
  // 해제를 effect가 아니라 렌더 중 조정으로 하는 것은 "프롭이 바뀔 때 상태 되돌리기"의 리액트 권장
  // 패턴이라서다 — effect 안 setState는 렌더를 한 번 더 유발해 react-hooks 규칙이 막는다.
  const [didTriggerRefresh, setDidTriggerRefresh] = useState(false)
  const [wasRefreshing, setWasRefreshing] = useState(isRefreshing)
  if (wasRefreshing !== isRefreshing) {
    setWasRefreshing(isRefreshing)
    if (!isRefreshing) setDidTriggerRefresh(false)
  }

  useEffect(() => {
    if (!enabled) return

    let startY: number | null = null
    let pulled = 0

    const stopTracking = (): void => {
      startY = null
      pulled = 0
      setDistance(0)
    }

    const handleTouchStart = (event: TouchEvent): void => {
      if (isRefreshingRef.current) return // 결정 12 — 재조회 중에는 새 당김을 시작하지 않는다.
      if (event.touches.length !== 1) return // 멀티터치는 핀치/줌이지 당김이 아니다.
      if (window.scrollY > 0) return // 결정 2 — iOS 러버밴드에서 음수가 될 수 있어 `<= 0` 이다.
      startY = event.touches[0].clientY
      pulled = 0
    }

    const handleTouchMove = (event: TouchEvent): void => {
      if (startY === null) return

      const rawDelta = event.touches[0].clientY - startY
      if (rawDelta <= 0 || window.scrollY > 0) {
        // 사용자가 평범한 스크롤을 하려는 것이다.
        stopTracking()
        return
      }

      pulled = resolvePullDistance(rawDelta)
      setDistance(pulled)
      // 네이티브 스크롤이 같은 손가락을 가져가지 않게 막는다(리스너가 passive면 무시된다).
      if (pulled > 0) event.preventDefault()
    }

    const handleTouchEnd = (): void => {
      if (startY === null) return

      const triggered = shouldTriggerRefresh(pulled)
      stopTracking()
      if (triggered) {
        setDidTriggerRefresh(true)
        onRefreshRef.current()
      }
    }

    const handleTouchCancel = (): void => {
      stopTracking()
    }

    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
    document.addEventListener('touchcancel', handleTouchCancel)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchCancel)
      // 당기는 도중 비활성화되면 touchend가 오지 않아 배너가 열린 채 남는다.
      stopTracking()
    }
  }, [enabled])

  if (!enabled) return { distance: 0, phase: 'idle' }
  return { distance, phase: resolvePullPhase(distance, isRefreshing && didTriggerRefresh) }
}
