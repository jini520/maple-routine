// 드롭다운의 자리 재기와 목록 오버레이는 `SelectField` 한 곳에 둔다. 오버레이가 둘이면 펼치는 방향이나 회전 처리 같은 고침이
// 한쪽에만 들어간다. 새 드롭다운은 `SelectField` 위에 칸과 줄 모양만 얹는다.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')
const OWNER = join('components', 'organisms', 'SelectField', 'SelectField.tsx')

function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (name === '__tests__' || name === 'node_modules') continue
    if (statSync(path).isDirectory()) out.push(...sources(path))
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(path)
  }
  return out
}

describe('드롭다운 오버레이', () => {
  it('placeDropdown 은 SelectField 만 부른다', () => {
    const files = [...sources(join(SRC, 'app')), ...sources(join(SRC, 'components'))]
    expect(files.length).toBeGreaterThan(100)

    const callers = files
      .filter((file) => /\bplaceDropdown\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
    expect(callers).toEqual([OWNER])
  })
})
