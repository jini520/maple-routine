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
