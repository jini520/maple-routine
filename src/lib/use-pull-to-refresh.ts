import { useEffect, useRef, useState } from 'react'
import { resolvePullDistance, resolvePullPhase, shouldTriggerRefresh } from '@core/lib/pull-to-refresh'
import type { PullPhase } from '@core/lib/pull-to-refresh'

export interface PullToRefreshOptions {
  /** false면 리스너를 아예 붙이지 않고 항상 idle을 반환한다. */
  enabled: boolean
  /** 화면의 재조회 대기 상태(세 화면 공통으로 status === 'loading'). */
  isRefreshing: boolean
  /** 임계값을 넘겨 놓았을 때 호출된다. */
  onRefresh: () => void
  /**
   * 화면이 자기 스크롤 컨테이너를 가질 때 그 요소([[ADR-099]] 결정 2). 주면 최상단 판정이
   * `scrollTop <= 0` 이 되고, 오버레이 배제 검사(결정 14)의 탐색이 이 요소에서 멈춘다 —
   * 페이지 자신은 당김의 대상이지 배제 대상이 아니다.
   *
   * 안 주면 문서 스크롤 기준([[ADR-072]] 결정 1·2) 그대로다. 전환하지 않은 화면은 프롭을
   * 넘기지 않으므로 동작이 바뀌지 않는다.
   */
  scrollRoot?: { current: HTMLElement | null }
}

export interface PullToRefreshState {
  distance: number
  phase: PullPhase
  /**
   * 손가락이 붙어 있고 추적 중일 때만 true. 화면은 이 값으로 목록 이동의 전환을 끈다
   * ([[ADR-073]] 결정 4). 손을 떼면 즉시 false다 — 재조회 대기(`phase === 'refreshing'`)는
   * 드래그가 아니라서, 임계 위치로 정착하는 애니메이션이 전환을 타야 한다.
   */
  isDragging: boolean
}

// 터치가 시작된 자리가 "페이지"인지 "그 위에 뜬 레이어"인지 묻는다([[ADR-072]] 결정 14). 모달·바텀시트는
// 자기 스크롤을 가지면서 body 스크롤을 잠그므로 window.scrollY 는 0 그대로다(결정 2만으로는 최상단으로
// 보인다). 그래서 이 검사가 없으면 오버레이 내부를 스크롤하려는 손가락이 document 까지 버블링돼
// preventDefault 로 내부 스크롤이 막히고, 손을 떼면 뒤 페이지가 재조회된다.
// 스크롤 루트에 닿으면 멈춘다 — 페이지 자신은 당김의 대상이지 배제 대상이 아니다. 그 루트는 문서
// (body·documentElement)이거나, 화면이 자기 스크롤 컨테이너를 가질 때는 그 요소다([[ADR-099]] 결정 2).
// scrollTop 은 보지 않는다(결정 14) — 오버레이가 떠 있는 동안의 배경 새로고침은 어느 경우에도 의도가 아니다.
function startedInScrollableLayer(target: EventTarget | null, scrollRoot: HTMLElement | null): boolean {
  let node = target instanceof Element ? target : null
  while (node !== null && node !== document.body && node !== document.documentElement && node !== scrollRoot) {
    const { overflowY } = window.getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return true
    }
    node = node.parentElement
  }
  return false
}

// 목록 최상단에서 아래로 당기는 제스처를 감지한다([[ADR-072]]). 리스너는 어느 쪽이든 document 에
// 붙이고(제스처는 화면 어디서 시작해도 잡아야 한다), **최상단인지 묻는 대상만** 갈린다 —
// 문서 스크롤이면 `window.scrollY`, 화면이 자기 스크롤 컨테이너를 가지면 그 요소의 `scrollTop`
// ([[ADR-099]] 결정 2). 임계값·감쇠 계산은 전부 pull-to-refresh.ts 의 순수 함수가 갖는다.
export function usePullToRefresh({
  enabled,
  isRefreshing,
  onRefresh,
  scrollRoot,
}: PullToRefreshOptions): PullToRefreshState {
  const [distance, setDistance] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

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

    // 스크롤 오프셋을 어디서 읽을지 — 컨테이너를 준 화면은 그 요소, 아니면 문서다.
    // iOS 러버밴드에서 음수가 될 수 있어 두 경로 모두 `> 0` 으로 묻는다(결정 2).
    const isScrolledDown = (): boolean => {
      const root = scrollRoot?.current
      return root !== null && root !== undefined ? root.scrollTop > 0 : window.scrollY > 0
    }

    const stopTracking = (): void => {
      startY = null
      pulled = 0
      setDistance(0)
      setIsDragging(false)
    }

    const handleTouchStart = (event: TouchEvent): void => {
      if (isRefreshingRef.current) return // 결정 12 — 재조회 중에는 새 당김을 시작하지 않는다.
      if (event.touches.length !== 1) return // 멀티터치는 핀치/줌이지 당김이 아니다.
      // 결정 14 — 출처 검사가 최상단 판정보다 앞이다. 조상 사슬 탐색은 레이아웃을 읽으므로
      // touchmove 가 아니라 여기서 제스처당 한 번만 한다.
      if (startedInScrollableLayer(event.target, scrollRoot?.current ?? null)) return
      if (isScrolledDown()) return // 결정 2 — iOS 러버밴드에서 음수가 될 수 있어 `<= 0` 이다.
      startY = event.touches[0].clientY
      pulled = 0
      setIsDragging(true)
    }

    const handleTouchMove = (event: TouchEvent): void => {
      if (startY === null) return

      const rawDelta = event.touches[0].clientY - startY
      if (rawDelta <= 0 || isScrolledDown()) {
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
  }, [enabled, scrollRoot])

  if (!enabled) return { distance: 0, phase: 'idle', isDragging: false }
  return {
    distance,
    phase: resolvePullPhase(distance, isRefreshing && didTriggerRefresh),
    isDragging,
  }
}
