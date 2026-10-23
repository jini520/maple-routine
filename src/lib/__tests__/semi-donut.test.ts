// 이번 주 수익의 반원 도넛 경로. 그림이 아니라 좌표로 묻는다. 양 끝이 수평선(가운데 높이)에서 끝나야 반원이 180° 다.

import { semiDonutGeometry } from '../today/semi-donut'

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
})
