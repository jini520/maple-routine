/**
 * 큰 메소를 억/만으로 접은 표기. 칩 한 칸에 10자리가 그대로 들어가면 금액 자체를 밀어낸다.
 */
export function formatMesoShort(meso: number): string {
  const absolute = Math.abs(meso)
  if (absolute >= 100_000_000) return `${(absolute / 100_000_000).toFixed(1)}억`
  if (absolute >= 10_000) return `${Math.round(absolute / 10_000).toLocaleString()}만`
  return absolute.toLocaleString()
}
