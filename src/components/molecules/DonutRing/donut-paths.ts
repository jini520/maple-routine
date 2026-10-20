/** 도넛 조각의 경로 계산. 부품 파일에 두면 그 파일이 부품만 내보내지 않아 빠른 새로 고침이 끊긴다 */

export interface DonutGeometry {
  size: number
  thickness: number
  /** 조각 사이 틈(링 가운데 둘레 위의 px) */
  gap: number
  cornerRadius: number
}

/**
 * 조각 경로. 반지름만큼 안으로 줄인 부채꼴에 같은 색의 둥근 테두리를 입혀 모서리를 깎는다.
 *
 * 좁은 조각은 폭이 허락하는 만큼만 깎는다. 다 깎으면 시작각이 끝각을 넘어 조각이 뒤집혀 그려진다.
 */
export function donutSlicePaths(values: readonly number[], geometry: DonutGeometry): { d: string; strokeWidth: number }[] {
  const center = geometry.size / 2
  // 테두리가 바깥으로 비어져 나가지 않게 상자 안쪽 3 에서 멈춘다.
  const outer = center - 3
  const inner = outer - geometry.thickness
  const gap = geometry.gap / (inner + geometry.thickness / 2)
  const total = values.reduce((sum, value) => sum + value, 0)
  const available = 2 * Math.PI - values.length * gap
  const point = (radius: number, angle: number): string =>
    `${(center + radius * Math.cos(angle)).toFixed(2)} ${(center + radius * Math.sin(angle)).toFixed(2)}`
  let angle = -Math.PI / 2 + gap / 2
  return values.map((value) => {
    const start = angle
    const end = angle + (available * value) / total
    angle = end + gap
    const corner = Math.min(geometry.cornerRadius, ((end - start) * inner) / 2.2)
    const ro = outer - corner
    const ri = inner + corner
    const so = start + corner / ro
    const eo = end - corner / ro
    const si = start + corner / ri
    const ei = end - corner / ri
    const largeOuter = eo - so > Math.PI ? 1 : 0
    const largeInner = ei - si > Math.PI ? 1 : 0
    return {
      d: `M ${point(ro, so)} A ${ro} ${ro} 0 ${largeOuter} 1 ${point(ro, eo)} L ${point(ri, ei)} A ${ri} ${ri} 0 ${largeInner} 0 ${point(ri, si)} Z`,
      strokeWidth: corner * 2,
    }
  })
}
