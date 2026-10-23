/**
 * 단상 블록에 적는 닉네임의 줄. 네 자까지는 한 줄, 그보다 길면 반으로 나눠 앞줄을 하나 더 길게 둔다.
 *
 * 줄바꿈을 RN 에 맡기면 블록 폭에 따라 `또뽀메/르` 처럼 한 자만 다음 줄로 넘어간다.
 */
export function podiumNameLines(name: string): string[] {
  const chars = Array.from(name)
  if (chars.length <= 4) return [name]
  const head = Math.ceil(chars.length / 2)
  return [chars.slice(0, head).join(''), chars.slice(head).join('')]
}

/** 단상 블록이 내용보다 높은 만큼. 1 · 2 · 3위 차례다 */
const BLOCK_STEPS = [24, 10, 0]

/**
 * 단상 블록 아래 여백. 단차에 세 블록 중 가장 많은 닉네임 줄 수에서 모자란 줄만큼을 더한다.
 * 블록마다 제 줄 수만 쓰면 아래 순위 이름이 한 줄 더 길 때 블록 높이가 뒤집힌다.
 *
 * @param lineCounts 순위 차례의 닉네임 줄 수. 빈 자리는 빠져 있다
 * @param rank 0 이 1위
 * @param lineHeight 글자 크기 단계를 곱한 닉네임 한 줄 높이
 */
export function podiumBlockPadding(lineCounts: readonly number[], rank: number, lineHeight: number): number {
  const most = Math.max(...lineCounts)
  return (BLOCK_STEPS[rank] ?? 0) + (most - (lineCounts[rank] ?? most)) * lineHeight
}
