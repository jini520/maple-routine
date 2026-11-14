/**
 * 게임 닉네임처럼 센 글자의 바이트. 영문 · 숫자 · 공백 · 기본 기호(ASCII)는 1, 한글과 그 밖의 글자는 2 다.
 *
 * @example
 * textBytes('메이플ID-4f1c08ab') // 17
 */
export function textBytes(text: string): number {
  let bytes = 0
  for (const char of text) bytes += char.codePointAt(0)! <= 0x7f ? 1 : 2
  return bytes
}

/**
 * 칸의 글자가 `previous` 에서 `next` 로 바뀔 때 `maxBytes` 안에서 받는 글자. 새로 들어온 글자는 넘지 않는 데까지만 받고,
 * 지우기는 언제나 받는다.
 *
 * @returns `text` 는 받은 글자, `caret` 은 받은 입력이 끝나는 자리(UTF-16 위치)
 */
export function fitToBytes(previous: string, next: string, maxBytes: number): { text: string; caret: number } {
  // 코드 포인트로 나눠 이모지 같은 두 칸 글자를 쪼개지 않는다.
  const before = Array.from(previous)
  const after = Array.from(next)
  const shared = Math.min(before.length, after.length)
  let head = 0
  while (head < shared && before[head] === after[head]) head++
  let tail = 0
  while (tail < shared - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++

  const suffix = after.slice(after.length - tail).join('')
  let room = maxBytes - textBytes(after.slice(0, head).join('') + suffix)
  const typed: string[] = []
  for (const char of after.slice(head, after.length - tail)) {
    room -= textBytes(char)
    if (room < 0) break
    typed.push(char)
  }
  const lead = [...after.slice(0, head), ...typed].join('')
  return { text: lead + suffix, caret: lead.length }
}
