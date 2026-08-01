// 손가락 이동 거리를 그대로 쓰면 목록이 손보다 빨리 내려가 "당기는 감각"이 없다. 절반만 따라오게 감쇠한다.
export const PULL_RESISTANCE = 0.5

// 이 거리를 넘으면 놓았을 때 재조회한다. 재조회가 도는 동안 목록이 머무는 위치이기도 하다
// ([[ADR-073]] 결정 5) — 목록이 아직 내려가 있다는 사실 자체가 "아직 안 끝났다"를 말한다.
export const PULL_THRESHOLD_PX = 56

// 임계값을 넘겨 더 당겨도 여기서 멈춘다. 끝없이 늘어나면 목록이 화면 밖으로 밀려난다.
export const PULL_MAX_PX = 80

// 손을 뗀 뒤 임계 위치로 정착하거나 0으로 복귀할 때 쓰는 전환이다.
// 드래그 중에는 쓰지 않는다([[ADR-073]] 결정 4) — 손가락이 붙어 있는데 전환이 걸리면 목록이
// 전환 시간만큼 늘 뒤처진 위치를 그려 "끌린다"는 감각이 죽는다.
export const PULL_SETTLE_TRANSITION = 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)'

export type PullPhase = 'idle' | 'pulling' | 'ready' | 'refreshing'

export function resolvePullDistance(rawDeltaY: number): number {
  if (rawDeltaY <= 0) return 0
  return Math.min(rawDeltaY * PULL_RESISTANCE, PULL_MAX_PX)
}

export function resolvePullPhase(distance: number, isRefreshing: boolean): PullPhase {
  // 재조회가 시작된 뒤 손을 떼면 distance가 0으로 돌아간다. 그때 목록이 제자리로 갔다 다시 내려가면 안 되므로
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

// 목록이 내려가는 거리이자 그렇게 벌어진 틈의 높이다 — 둘은 같은 틈의 두 면이라 한 함수에서 나온다
// ([[ADR-073]] 결정 6). 두 벌로 계산하면 값이 어긋나는 순간 인디케이터가 카드 위에 겹치거나 빈 띠가 남는다.
export function resolveContentOffsetPx(distance: number, phase: PullPhase): number {
  if (phase === 'refreshing') return PULL_THRESHOLD_PX
  if (phase === 'idle') return 0
  return Math.min(Math.max(distance, 0), PULL_MAX_PX)
}
