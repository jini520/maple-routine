import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// 머리를 원 안에만 그리는 얼굴은 `CharacterPortrait` 의 두 규격(캐릭터 레일 · 보스 수입 카드 머리)이다. 둘 다 얼굴 바로
// 바깥에 링을 두른다.
// 새 호출부가 `overFrame` 을 빠뜨리면 그 자리만 원에 갇힌다. 렌더로는 못 물어서 소스로 묻는다.
const SRC = join(__dirname, '..', '..', '..', '..')

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__' || entry.name === '__fixtures__') return []
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return tsxFiles(path)
    return entry.name.endsWith('.tsx') ? [path] : []
  })
}

/** 여는 태그 하나. `fallback={<View>…</View>}` 처럼 중괄호 안의 `>` 는 태그의 끝이 아니다. */
function openingTag(source: string, start: number): string {
  let depth = 0
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
    else if (ch === '>' && depth === 0) return source.slice(start, i + 1)
  }
  return source.slice(start)
}

/** 모든 `CharacterAvatar` 여는 태그와 그 파일. */
function faceTags(): { path: string; tag: string }[] {
  return tsxFiles(SRC).flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    return [...source.matchAll(/<CharacterAvatar\b/g)].map((match) => ({
      path: relative(SRC, file),
      tag: openingTag(source, match.index),
    }))
  })
}

/** 링을 두른 초상화의 얼굴. 드롭 시세 머리도 지름을 `PORTRAIT_COMPACT` 에서 읽으므로 지름이 아니라 파일로 가른다. */
const RINGED_PORTRAIT_FILE = 'components/organisms/CharacterPortrait/CharacterPortrait.tsx'

it('`CharacterPortrait` 의 두 규격 말고 모든 얼굴 호출부가 `overFrame` 을 넘긴다', () => {
  const missing = faceTags()
    .filter(({ path, tag }) => path !== RINGED_PORTRAIT_FILE && !/\boverFrame\b/.test(tag))
    .map(({ path }) => path)

  expect(missing).toEqual([])
})

it('`CharacterPortrait` 의 레일과 `compact` 는 `overFrame` 을 넘기지 않는다', () => {
  const ringed = faceTags().filter(({ path }) => path === RINGED_PORTRAIT_FILE)

  expect(ringed).toHaveLength(2)
  expect(ringed.filter(({ tag }) => /\boverFrame\b/.test(tag))).toEqual([])
})
