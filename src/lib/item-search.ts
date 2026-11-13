/**
 * 아이템 이름 찾기. 인벤토리의 아이템 넣기와 가계부의 아이템 고르기가 함께 쓰는 규칙 하나.
 *
 * 두 곳이 같은 목록에서 고르므로 같은 글자를 치면 같은 아이템이 떠야 한다.
 */
import { disassemble } from 'es-hangul'

interface Match {
  /** 친 글자가 이름 안에 이어서 들어 있는지. 붙어서 맞은 이름이 위에 선다 */
  contiguous: boolean
  /** 친 첫 글자가 맞은 자리. 띄어쓰기를 뺀 이름에서의 위치 */
  start: number
}

function charsOf(text: string): string[] {
  return [...text.replace(/\s+/g, '')]
}

/** 이름의 `from` 자리부터 이어지는 자음 · 모음이 `jamo` 로 시작하는지. 치는 중인 마지막 글자를 맞추는 데 쓴다 */
function startsWithJamo(nameJamo: readonly string[], from: number, jamo: string): boolean {
  let joined = ''
  for (let index = from; index < nameJamo.length && joined.length < jamo.length; index++) {
    joined += nameJamo[index]
  }
  return joined.startsWith(jamo)
}

function matchOf(name: string, query: readonly string[]): Match | null {
  const chars = charsOf(name)
  const nameJamo = chars.map((char) => disassemble(char))
  const head = query.slice(0, -1)
  const lastJamo = disassemble(query[query.length - 1])

  for (let start = 0; start + head.length < chars.length; start++) {
    if (head.every((char, offset) => chars[start + offset] === char) && startsWithJamo(nameJamo, start + head.length, lastJamo)) {
      return { contiguous: true, start }
    }
  }

  // 앞 글자를 가장 앞에서부터 맞춰야 첫 글자 자리가 가장 앞이고, 마지막 글자가 들어갈 자리도 가장 넓다.
  let cursor = 0
  let start = -1
  for (const char of head) {
    while (cursor < chars.length && chars[cursor] !== char) cursor++
    if (cursor === chars.length) return null
    if (start < 0) start = cursor
    cursor++
  }
  for (let index = cursor; index < chars.length; index++) {
    if (startsWithJamo(nameJamo, index, lastJamo)) {
      return { contiguous: false, start: start < 0 ? index : start }
    }
  }
  return null
}

/**
 * 친 글자가 이름 안에 차례대로 들어 있는 아이템. 띄어쓰기는 보지 않고, 마지막 글자는 치는 중인 글자로 본다.
 *
 * 붙어서 맞은 것이 먼저, 그다음 친 첫 글자가 앞쪽에서 맞은 것이 먼저다. 그것까지 같으면 받은 차례 그대로다.
 *
 * @example searchItems(catalog, '소에1')
 */
export function searchItems<T extends { name: string }>(items: readonly T[], query: string): T[] {
  const chars = charsOf(query)
  if (chars.length === 0) return []

  return items
    .map((item, order) => ({ item, order, match: matchOf(item.name, chars) }))
    .filter((entry): entry is { item: T; order: number; match: Match } => entry.match !== null)
    .sort(
      (a, b) =>
        Number(b.match.contiguous) - Number(a.match.contiguous) || a.match.start - b.match.start || a.order - b.order,
    )
    .map((entry) => entry.item)
}
