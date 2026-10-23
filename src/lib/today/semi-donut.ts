/**
 * today 이번 주 수익의 반원 도넛 경로.
 *
 * 조각의 모서리를 둥글게 하려고 조각을 `corner` 만큼 안으로 줄여 그리고, 같은 색의 `corner × 2` 굵기 선으로 둘러 원래
 * 크기로 되돌린다. 바깥 · 안쪽 반지름만 줄이고 **양 끝은 각도로 줄이지 않는다.** 각도로 줄이면 호가 180° 보다 짧아지고
 * 끝 단면이 안쪽으로 기운다. 대신 선이 수평선 아래로 `corner` 만큼 나오므로 그림 높이가 그만큼을 품는다.
 */

export interface SemiDonutSize {
  /** 그림 폭. 반원의 지름에 위아래 여백을 더한 값 */
  width: number
  /** 띠 굵기 */
  thickness: number
  /** 모서리 둥근 정도 */
  corner: number
  /** 조각 사이 틈(px) */
  gap: number
}

export interface SemiDonutGeometry {
  /** 값마다 조각 경로. 값이 0 이거나 틈보다 좁은 조각은 빈 문자열이다 */
  paths: string[]
  /** 조각이 없을 때 그리는 바탕 반원 */
  track: string
  cx: number
  /** 수평선(반원의 바닥)의 높이 */
  cy: number
  /** 경로의 바깥 반지름(둥근 모서리 선을 빼고) */
  outer: number
  /** 그림 높이 */
  height: number
}

/** 반원 띠 하나. 각은 12시가 0 이고 왼쪽 끝이 −π/2, 오른쪽 끝이 π/2 다 */
function arcPath(cx: number, cy: number, outer: number, inner: number, from: number, to: number): string {
  const point = (radius: number, angle: number): string =>
    `${(cx + radius * Math.sin(angle)).toFixed(2)} ${(cy - radius * Math.cos(angle)).toFixed(2)}`
  return `M${point(outer, from)} A${outer} ${outer} 0 0 1 ${point(outer, to)} L${point(inner, to)} A${inner} ${inner} 0 0 0 ${point(inner, from)} Z`
}

/**
 * @param values 조각 값. 순서대로 왼쪽에서 오른쪽으로 놓인다
 */
export function semiDonutGeometry(values: readonly number[], size: SemiDonutSize): SemiDonutGeometry {
  const edge = size.width / 2 - 2
  const outer = edge - size.corner
  const inner = edge - size.thickness + size.corner
  const cx = size.width / 2
  const cy = edge + 2
  const mid = (outer + inner) / 2
  const pad = (size.corner + size.gap / 2) / mid
  const total = values.reduce((sum, value) => sum + value, 0)

  // 끝 조각은 값이 있는 조각 중에서 정한다. 0 인 조각을 끝으로 치면 옆 조각이 그 끝에서 틈만큼 짧아져 반원이 기운다.
  const firstShown = values.findIndex((value) => value > 0)
  const lastShown = values.length - 1 - [...values].reverse().findIndex((value) => value > 0)

  let angle = -Math.PI / 2
  const paths =
    total > 0
      ? values.map((value, index) => {
          if (value <= 0) return ''
          const span = (value / total) * Math.PI
          const from = angle + (index === firstShown ? 0 : pad)
          const to = angle + span - (index === lastShown ? 0 : pad)
          angle += span
          return to > from ? arcPath(cx, cy, outer, inner, from, to) : ''
        })
      : []

  return {
    paths,
    track: arcPath(cx, cy, outer, inner, -Math.PI / 2, Math.PI / 2),
    cx,
    cy,
    outer,
    height: cy + size.corner + 2,
  }
}
