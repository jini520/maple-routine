/**
 * 약속 목록 · 시트의 캐릭터 점 색. 밝고 어두운 바탕 어디서나 점이 보이게 짙은 색이다.
 *
 * 테마와 상관없이 같은 색이다. 테마를 바꿔도 같은 캐릭터는 같은 색이어야 한눈에 가려진다.
 */
export const CHARACTER_BLOCK_COLORS: readonly string[] = [
  '#2F6BD8', // 파랑
  '#16835F', // 초록
  '#8A46D1', // 보라
  '#C2410C', // 주황
  '#BE185D', // 분홍
  '#0E7490', // 청록
  '#65751A', // 올리브
  '#92400E', // 갈색
]

/** 추적을 풀어 순서를 모르는 캐릭터 */
export const UNKNOWN_CHARACTER_COLOR = '#6B7280'

/**
 * 추적 순서에서 캐릭터별 색을 고르는 함수. 순서가 같으면 같은 캐릭터는 늘 같은 색이다.
 *
 * @example const colorOf = characterColorsOf(trackedOcids); colorOf(group.ocid)
 */
export function characterColorsOf(orderedOcids: readonly string[]): (ocid: string) => string {
  const index = new Map(orderedOcids.map((ocid, position) => [ocid, position]))
  return (ocid) => {
    const position = index.get(ocid)
    return position === undefined
      ? UNKNOWN_CHARACTER_COLOR
      : CHARACTER_BLOCK_COLORS[position % CHARACTER_BLOCK_COLORS.length]
  }
}
