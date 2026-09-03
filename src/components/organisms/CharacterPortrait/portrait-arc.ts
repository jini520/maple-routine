/**
 * `rail` 규격의 호 경로와 각도. 치수는 `portrait-metrics` 가 갖는다.
 *
 * 각도는 **12시가 0도, 시계방향이 양수**다(음수면 반시계). SVG 의 3시 기준을 안 쓰는 것은 링이
 * 12시에서 시작하기로 돼 있어서다.
 */
import { PORTRAIT_RAIL } from './portrait-metrics'

/**
 * 글자가 붙는 아래 반원. 왼쪽에서 오른쪽으로 그린다(sweep 0).
 *
 * 방향을 뒤집으면 글자가 거울처럼 뒤집혀 못 읽는다. 호가 상자 좌우를 넘어도 된다.
 */
export function portraitTextArcPath(): string {
  const { centerX, centerY, textR: r } = PORTRAIT_RAIL
  return `M ${centerX - r} ${centerY} A ${r} ${r} 0 0 0 ${centerX + r} ${centerY}`
}

/** 레벨과 이름을 6시를 경계로 좌우에 붙이는 오프셋. */
export function portraitTextOffsetPercent(side: 'left' | 'right'): string {
  const halfArcLength = Math.PI * PORTRAIT_RAIL.textR
  const delta = (PORTRAIT_RAIL.textGap / 2 / halfArcLength) * 100
  return `${(side === 'right' ? 50 + delta : 50 - delta).toFixed(2)}%`
}

function pointAt(degrees: number): { x: number; y: number } {
  const radians = ((degrees - 90) * Math.PI) / 180
  return {
    x: PORTRAIT_RAIL.centerX + PORTRAIT_RAIL.ringR * Math.cos(radians),
    y: PORTRAIT_RAIL.centerY + PORTRAIT_RAIL.ringR * Math.sin(radians),
  }
}

/**
 * 링 호 경로. 길이가 0 이면 빈 문자열이다.
 *
 * 길이 0 인 호를 `strokeLinecap="round"` 로 그리면 점 하나가 찍혀 아직 아무것도 안 한 것이
 * 조금 한 것으로 보인다.
 */
export function portraitRingArcPath(from: number, to: number): string {
  if (Math.abs(to - from) < 0.01) return ''
  const start = pointAt(from)
  const end = pointAt(to)
  const largeArc = Math.abs(to - from) > 180 ? 1 : 0
  const sweep = to > from ? 1 : 0
  const r = PORTRAIT_RAIL.ringR
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`
}

/** 링 한 칸의 각도 구간. 셋 다 12시에서 시작해야 두 반원을 나란히 읽는다. */
export function portraitRingSpan(half: 'left' | 'right' | 'full'): { from: number; to: number } {
  if (half === 'full') return { from: 0, to: -360 }
  const gap = PORTRAIT_RAIL.ringGapDeg
  const sign = half === 'right' ? 1 : -1
  return { from: sign * gap, to: sign * (180 - gap) }
}

/** 한 바퀴는 호로 못 그린다(시작점과 끝점이 같다). 호출부가 `Circle` 로 갈아탄다. */
export function isFullTurn(span: { from: number; to: number }): boolean {
  return Math.abs(span.to - span.from) >= 360
}

/** 0~1 로 자른 진행 비율. `total` 이 0 이면 0 이다(0/0 을 100% 로 읽지 않는다). */
export function ringRatio(completed: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(Math.max(completed / total, 0), 1)
}
