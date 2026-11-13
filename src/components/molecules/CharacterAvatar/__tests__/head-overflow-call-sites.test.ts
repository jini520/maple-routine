import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// 머리를 원 밖으로 그리는 얼굴은 아래 다섯 파일뿐이다. 레일 · 보스 카드 · 알약 · 묶음 라벨은 원 안에만 그린다.
// 다른 자리에 번지면 머리가 링이나 작은 칸을 덮는다. 렌더로는 못 물어서 소스로 묻는다.
const SRC = join(__dirname, '..', '..', '..', '..')

const HEAD_OVERFLOW_FILES = [
  'app/today/CharacterManageButton.tsx',
  'app/today/widgets/RemainingScheduleWidget.tsx',
  'app/today/widgets/WeeklyIncomeWidget.tsx',
  'components/organisms/AccountSelect/AccountSelect.tsx',
  'components/organisms/CharacterRow/CharacterRow.tsx',
]

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

it('`headOverflow` 를 넘기는 얼굴 호출부가 정한 다섯 파일과 같다', () => {
  const found = tsxFiles(SRC)
    .filter((file) => {
      const source = readFileSync(file, 'utf8')
      return [...source.matchAll(/<CharacterAvatar\b/g)].some((match) =>
        /\bheadOverflow\b/.test(openingTag(source, match.index)),
      )
    })
    .map((file) => relative(SRC, file))
    .sort()

  expect(found).toEqual(HEAD_OVERFLOW_FILES)
})
