// 이번 주 수익의 반원 도넛 경로. 그림이 아니라 좌표로 묻는다. 양 끝이 수평선(가운데 높이)에서 끝나야 반원이 180° 다.

import { semiDonutGeometry, semiDonutSpans } from '../today/semi-donut'

const 치수 = { width: 168, thickness: 30, corner: 4, gap: 3 }

/** 경로의 첫 점(M x y) */
function 시작점(d: string): [number, number] {
  const [x, y] = d.slice(1).split(' ').map(Number)
  return [x, y]
}

/** 바깥 호의 끝점(첫 A 명령의 마지막 두 수) */
function 바깥끝점(d: string): [number, number] {
  const parts = d.split('A')[1].trim().split(/\s+/)
  return [Number(parts[5]), Number(parts[6].replace('L', ''))]
}

/** 경로의 네 꼭짓점. 바깥 시작 · 바깥 끝 · 안쪽 끝 · 안쪽 시작 순이다 */
function 꼭짓점(d: string): [number, number][] {
  const numbers = d.replace(/[MLAZ]/g, ' ').trim().split(/\s+/).map(Number)
  // M x y · A rx ry rot large sweep x y · L x y · A rx ry rot large sweep x y
  return [[numbers[0], numbers[1]], [numbers[7], numbers[8]], [numbers[9], numbers[10]], [numbers[16], numbers[17]]]
}

function 거리(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

describe('semiDonutGeometry', () => {
  it('첫 조각은 왼쪽 수평선에서, 마지막 조각은 오른쪽 수평선에서 끝난다', () => {
    const { paths, cx, cy, outer } = semiDonutGeometry([3, 1], 치수)

    expect(시작점(paths[0])).toEqual([cx - outer, cy])
    expect(바깥끝점(paths[1])).toEqual([cx + outer, cy])
  })

  // 순 수익에서 지출이 0 이면 [수입, 0] 이다. 0 인 조각을 끝 조각으로 치면 수입 조각이 오른쪽 끝에서 틈만큼 짧아져 기운다.
  it.each([
    ['뒤가 0', [5, 0], 0],
    ['앞이 0', [0, 5], 1],
    ['앞뒤가 0', [0, 5, 0], 1],
  ])('값이 0 인 조각은 빼고 계산한다: %s', (_이름, values, 그린조각) => {
    const { paths, cx, cy, outer } = semiDonutGeometry(values, 치수)

    expect(paths.filter((path) => path !== '')).toHaveLength(1)
    expect(시작점(paths[그린조각])).toEqual([cx - outer, cy])
    expect(바깥끝점(paths[그린조각])).toEqual([cx + outer, cy])
  })

  it('조각이 없을 때 그리는 바탕 반원도 양 끝이 수평선이다', () => {
    const { track, cx, cy, outer } = semiDonutGeometry([], 치수)

    expect(시작점(track)).toEqual([cx - outer, cy])
    expect(바깥끝점(track)).toEqual([cx + outer, cy])
  })

  // 틈을 같은 각도로 벌리면 반지름이 큰 바깥쪽 틈이 안쪽보다 넓다.
  it('조각 사이 틈은 바깥 호와 안쪽 호에서 폭이 같다', () => {
    const { paths } = semiDonutGeometry([5, 3, 2], 치수)

    for (const [왼쪽, 오른쪽] of [[paths[0], paths[1]], [paths[1], paths[2]]]) {
      const [, 바깥끝, 안쪽끝] = 꼭짓점(왼쪽)
      const [바깥시작, , , 안쪽시작] = 꼭짓점(오른쪽)
      expect(거리(바깥끝, 바깥시작)).toBeCloseTo(거리(안쪽끝, 안쪽시작), 1)
    }
  })

  // 둥근 모서리용 선이 수평선 아래로 `corner` 만큼 나온다. 높이가 그만큼 없으면 바닥이 잘린다.
  it('그림 높이는 수평선 아래로 나오는 모서리까지 품는다', () => {
    const { cy, height } = semiDonutGeometry([1], 치수)

    expect(height).toBeGreaterThanOrEqual(cy + 치수.corner)
  })

  // 조각 양 끝을 모서리와 틈만큼 깎으므로, 비율대로만 나누면 좁은 조각은 깎을 폭이 모자라 사라진다(통계 지출 4% 조각).
  it('아주 작은 조각도 그리고, 반원은 그대로 왼쪽 끝에서 오른쪽 끝까지 찬다', () => {
    const { paths, strokeWidths, cx, cy, outer } = semiDonutGeometry([200, 10, 8, 1], 치수)

    expect(paths.every((path) => path !== '')).toBe(true)
    expect(시작점(paths[0])).toEqual([cx - outer, cy])
    // 끝 조각은 모서리를 줄였으므로 경로가 아니라 경로 + 선 반쪽이 띠 바깥 가장자리에 닿는다
    const [끝x, 끝y] = 바깥끝점(paths[3])
    expect(끝y).toBe(cy)
    expect(끝x + strokeWidths[3] / 2).toBeCloseTo(cx + outer + 치수.corner, 1)
  })
})

describe('semiDonutSpans', () => {
  const 크기 = { innerEdge: 52, corner: 8, gap: 3 }
  /** 모서리 `corner` 로 깎고도 몸통이 남는 가장 좁은 폭. 가운데 조각 기준 */
  const 온모서리최소폭 = 2 * Math.asin((8 + 1.5) / (52 + 8))

  it('좁은 조각은 최소 폭을 받고, 그만큼을 넓은 조각에서 덜어 합이 반원이다', () => {
    const values = [200, 10, 8, 1]
    const spans = semiDonutSpans(values, 크기)
    const 폭 = spans.map((span) => span.to - span.from)
    const 비율대로 = values.map((value) => (value / 219) * Math.PI)

    expect(폭.reduce((sum, width) => sum + width, 0)).toBeCloseTo(Math.PI, 6)
    expect(폭[3]).toBeGreaterThan(비율대로[3])
    expect(폭[0]).toBeLessThan(비율대로[0])
    // 넓은 순서는 그대로다
    expect(폭[1]).toBeGreaterThanOrEqual(폭[2])
    expect(폭[2]).toBeGreaterThanOrEqual(폭[3])
  })

  // 모서리를 다 깎은 채 최소 폭을 주면 작은 조각이 너무 커진다. 좁은 조각은 모서리를 줄여 최소 폭도 줄인다.
  it('좁은 조각은 모서리를 줄여, 온 모서리로 깎을 때보다 좁게 그린다', () => {
    const spans = semiDonutSpans([200, 10, 4, 1], 크기)

    expect(spans[0].corner).toBe(8)
    expect(spans[2].corner).toBeLessThan(8)
    expect(spans[2].to - spans[2].from).toBeLessThan(온모서리최소폭)
    for (const span of spans) expect(span.corner).toBeGreaterThanOrEqual(4)
  })

  it('모든 조각이 충분히 넓으면 비율 그대로이고 모서리도 그대로다', () => {
    const spans = semiDonutSpans([3, 2, 1], 크기)

    expect(spans.map((span) => span.to - span.from)).toEqual(
      [3, 2, 1].map((value) => expect.closeTo((value / 6) * Math.PI, 6)),
    )
    expect(spans.map((span) => span.corner)).toEqual([8, 8, 8])
  })
})
