import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// 머리를 원 안에만 그리는 얼굴은 캐릭터 레일 하나다. 스케줄러 링이 얼굴 바로 바깥에 있어서 머리가 링을 가린다.
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

/** 레일의 얼굴. 지름을 `PORTRAIT_RAIL` 에서 읽는다. */
function isRailFace(tag: string): boolean {
  return tag.includes('PORTRAIT_RAIL.faceSize')
}

it('레일 말고 모든 얼굴 호출부가 `overFrame` 을 넘긴다', () => {
  const missing = faceTags()
    .filter(({ tag }) => !isRailFace(tag) && !/\boverFrame\b/.test(tag))
    .map(({ path }) => path)

  expect(missing).toEqual([])
})

it('레일은 `overFrame` 을 넘기지 않는다', () => {
  const rail = faceTags().filter(({ tag }) => isRailFace(tag))

  expect(rail).toHaveLength(1)
  expect(rail.filter(({ tag }) => /\boverFrame\b/.test(tag))).toEqual([])
})
