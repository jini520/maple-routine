/**
 * today 이번 주 수익의 반원 도넛 경로.
 *
 * 조각의 모서리를 둥글게 하려고 조각을 `corner` 만큼 안으로 줄여 그리고, 같은 색의 `corner × 2` 굵기 선으로 둘러 원래
 * 크기로 되돌린다. 바깥 · 안쪽 반지름만 줄이고 **양 끝은 각도로 줄이지 않는다.** 각도로 줄이면 호가 180° 보다 짧아지고
 * 끝 단면이 안쪽으로 기운다. 대신 선이 수평선 아래로 `corner` 만큼 나오므로 그림 높이가 그만큼을 품는다.
 *
 * 조각 사이 틈은 같은 각도가 아니라 같은 거리로 벌린다. 각도로 벌리면 반지름이 큰 바깥 호에서 틈이 더 넓다.
 *
 * 양 끝을 깎을 폭이 모자란 좁은 조각은 모서리를 줄이고(`MIN_CORNER` 까지), 그래도 모자라면 최소 폭을 받는다.
 * 최소 폭만큼은 넓은 조각에서 덜어 낸다. 비율대로만 나누면 좁은 조각은 사라진다.
 */

/** 깎고 남은 조각 몸통의 안쪽 호 길이(px). 0 이면 둥근 끝 둘만 맞붙는다 */
const MIN_BODY = 2
/** 좁은 조각에서 줄일 수 있는 가장 작은 모서리 */
const MIN_CORNER = 4

export interface SemiDonutSpan {
  from: number
  to: number
  /** 양 끝을 반지름 선에서 안쪽으로 옮길 거리. 반원의 양 끝과 값이 0 인 조각은 0 이다 */
  cut: { from: number; to: number }
  /** 이 조각의 둥근 정도. 경로를 이만큼 안으로 줄이고 `corner × 2` 굵기 선을 두른다 */
  corner: number
}

/**
 * 조각마다 각도와 모서리. 각은 12시가 0 이고 왼쪽 끝이 −π/2, 오른쪽 끝이 π/2 다.
 * @param values 조각 값. 순서대로 왼쪽에서 오른쪽으로 놓인다
 * @param size `innerEdge` 는 띠 안쪽 가장자리의 반지름, `corner` 는 넓은 조각의 둥근 정도
 */
export function semiDonutSpans(
  values: readonly number[],
  size: { innerEdge: number; corner: number; gap: number },
): SemiDonutSpan[] {
  // 끝 조각은 값이 있는 조각 중에서 정한다. 0 인 조각을 끝으로 치면 옆 조각이 그 끝에서 틈만큼 짧아져 반원이 기운다.
  const firstShown = values.findIndex((value) => value > 0)
  const lastShown = values.length - 1 - [...values].reverse().findIndex((value) => value > 0)
  const cutOf = (index: number, corner: number): { from: number; to: number } => {
    if (values[index] <= 0) return { from: 0, to: 0 }
    const cut = corner + size.gap / 2
    return { from: index === firstShown ? 0 : cut, to: index === lastShown ? 0 : cut }
  }
  // 모서리 `corner` 로 깎고도 몸통이 남는 폭. 안쪽 호가 각이 더 많이 깎이므로 안쪽 반지름으로 잰다
  const need = (index: number, corner: number): number => {
    const radius = size.innerEdge + corner
    const cut = cutOf(index, corner)
    return Math.asin(cut.from / radius) + Math.asin(cut.to / radius) + MIN_BODY / radius
  }
  const smallest = Math.min(MIN_CORNER, size.corner)
  const least = values.map((value, index) => (value > 0 ? need(index, smallest) : 0))

  const widths = values.map(() => 0)
  const fixed = values.map((value) => value <= 0)
  // 최소 폭에 묶인 조각을 빼고 남은 각을 비율대로 다시 나눈다. 다시 나눈 뒤 모자라는 조각이 또 생기면 묶고 되풀이한다.
  for (;;) {
    const free = values.reduce((sum, value, index) => (fixed[index] ? sum : sum + value), 0)
    const budget = Math.PI - least.reduce((sum, width, index) => (fixed[index] ? sum + width : sum), 0)
    if (free <= 0 || budget <= 0) break
    let changed = false
    values.forEach((value, index) => {
      if (fixed[index]) return
      widths[index] = (value / free) * budget
      if (widths[index] < least[index]) {
        fixed[index] = true
        changed = true
      }
    })
    if (!changed) break
  }
  values.forEach((value, index) => {
    if (fixed[index] && value > 0) widths[index] = least[index]
  })

  let angle = -Math.PI / 2
  return widths.map((width, index) => {
    let corner = size.corner
    while (corner > smallest && width < need(index, corner)) corner = Math.max(smallest, corner - 0.5)
    const from = angle
    angle += width
    return { from, to: angle, cut: cutOf(index, corner), corner }
  })
}

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
  /** 값마다 조각 경로. 값이 0 인 조각은 빈 문자열이다 */
  paths: string[]
  /** 값마다 둥근 모서리 선의 굵기. 좁은 조각은 모서리를 줄여 얇다 */
  strokeWidths: number[]
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

/**
 * 반원 띠 하나. 각은 12시가 0 이고 왼쪽 끝이 −π/2, 오른쪽 끝이 π/2 다.
 * @param cut 양 끝 단면을 각 `from` · `to` 의 반지름 선에서 안쪽으로 평행하게 옮길 거리
 */
export function arcPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  from: number,
  to: number,
  cut: { from: number; to: number } = { from: 0, to: 0 },
): string {
  'worklet'
  const point = (radius: number, angle: number): string =>
    `${(cx + radius * Math.sin(angle)).toFixed(2)} ${(cy - radius * Math.cos(angle)).toFixed(2)}`
  // 반지름 선에서 거리 d 인 평행선은 반지름 r 에서 asin(d / r) 만큼 각이 벌어진다
  const start = (radius: number): number => from + Math.asin(cut.from / radius)
  const end = (radius: number): number => to - Math.asin(cut.to / radius)
  return `M${point(outer, start(outer))} A${outer} ${outer} 0 0 1 ${point(outer, end(outer))} L${point(inner, end(inner))} A${inner} ${inner} 0 0 0 ${point(inner, start(inner))} Z`
}

/**
 * @param values 조각 값. 순서대로 왼쪽에서 오른쪽으로 놓인다
 */
export function semiDonutGeometry(values: readonly number[], size: SemiDonutSize): SemiDonutGeometry {
  const edge = size.width / 2 - 2
  const innerEdge = edge - size.thickness
  const cx = size.width / 2
  const cy = edge + 2
  const total = values.reduce((sum, value) => sum + value, 0)
  const spans = semiDonutSpans(values, { innerEdge, corner: size.corner, gap: size.gap })

  const paths =
    total > 0
      ? values.map((value, index) => {
          if (value <= 0) return ''
          const { from, to, cut, corner } = spans[index]
          return arcPath(cx, cy, edge - corner, innerEdge + corner, from, to, cut)
        })
      : []

  return {
    paths,
    strokeWidths: spans.map((span) => span.corner * 2),
    track: arcPath(cx, cy, edge - size.corner, innerEdge + size.corner, -Math.PI / 2, Math.PI / 2),
    cx,
    cy,
    outer: edge - size.corner,
    height: cy + size.corner + 2,
  }
}
