// 손가락 이동 거리를 그대로 쓰면 배너가 손보다 빨리 열려 "당기는 감각"이 없다. 절반만 따라오게 감쇠한다.
export const PULL_RESISTANCE = 0.5

// 이 거리를 넘으면 놓았을 때 재조회한다. 배너가 완전히 펼쳐진 높이(`h-14`)와 같은 값이다 —
// 배너가 다 열린 순간이 곧 임계값 도달이라 별도 신호 없이도 읽힌다.
export const PULL_THRESHOLD_PX = 56

// 임계값을 넘겨 더 당겨도 여기서 멈춘다. 끝없이 늘어나면 배너가 목록을 계속 덮는다.
export const PULL_MAX_PX = 80

export type PullPhase = 'idle' | 'pulling' | 'ready' | 'refreshing'

export function resolvePullDistance(rawDeltaY: number): number {
  if (rawDeltaY <= 0) return 0
  return Math.min(rawDeltaY * PULL_RESISTANCE, PULL_MAX_PX)
}

export function resolvePullPhase(distance: number, isRefreshing: boolean): PullPhase {
  // 재조회가 시작된 뒤 손을 떼면 distance가 0으로 돌아간다. 그때 배너가 닫혔다 다시 열리면 안 되므로
  // 재조회 중에는 거리와 무관하게 항상 refreshing이다.
  if (isRefreshing) return 'refreshing'
  if (distance <= 0) return 'idle'
  if (distance >= PULL_THRESHOLD_PX) return 'ready'
  return 'pulling'
}

// resolvePullPhase 의 'ready' 판정과 같은 경계를 쓴다 — 경계가 갈리면
// "놓으면 새로고침"이 뜬 채로 아무 일도 일어나지 않는다.
export function shouldTriggerRefresh(distance: number): boolean {
  return distance >= PULL_THRESHOLD_PX
}

// 단풍잎 회전각·불투명도에 쓸 0~1 진행률. 임계값을 넘겨 더 당겨도 1을 넘지 않는다.
export function resolvePullProgress(distance: number): number {
  return Math.min(Math.max(distance / PULL_THRESHOLD_PX, 0), 1)
}

export function resolveBandHeightPx(distance: number, phase: PullPhase): number {
  if (phase === 'refreshing') return PULL_THRESHOLD_PX
  if (phase === 'idle') return 0
  return Math.min(Math.max(distance, 0), PULL_MAX_PX)
}
