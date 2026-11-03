import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// 줄의 왼쪽 끝에 서는 얼굴은 좌우를 뒤집는다. 안 뒤집는 자리는 레일과 today 머리의 캐릭터 관리 버튼뿐이다.
// 새 호출부가 `mirrored` 를 빠뜨리면 그 자리만 캐릭터가 내용을 등진다. 렌더로는 못 물어서 소스로 묻는다.
const SRC = join(__dirname, '..', '..', '..', '..')

/** 안 뒤집는 호출부. `CharacterPortrait` 는 `rail` 이 안 뒤집고 `compact` 가 프롭을 그대로 넘긴다. */
const NOT_MIRRORED = new Set([
  'app/today/CharacterManageButton.tsx',
  'components/organisms/CharacterPortrait/CharacterPortrait.tsx',
])

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

function openingTagsOf(source: string, component: string): string[] {
  const tags: string[] = []
  const pattern = new RegExp(`<${component}\\b`, 'g')
  for (const match of source.matchAll(pattern)) tags.push(openingTag(source, match.index))
  return tags
}

it('레일과 today 머리 버튼 말고는 모든 얼굴 호출부가 `mirrored` 를 넘긴다', () => {
  const missing: string[] = []
  for (const file of tsxFiles(SRC)) {
    const path = relative(SRC, file)
    if (NOT_MIRRORED.has(path)) continue
    const source = readFileSync(file, 'utf8')
    const faces = [
      ...openingTagsOf(source, 'CharacterAvatar'),
      ...openingTagsOf(source, 'CharacterPortrait').filter((tag) => tag.includes('variant="compact"')),
    ]
    for (const tag of faces) {
      if (!/\bmirrored\b/.test(tag)) missing.push(path)
    }
  }

  expect(missing).toEqual([])
})
