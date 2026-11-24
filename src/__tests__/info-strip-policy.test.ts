// 앱의 상태를 말하는 띠(결산 · 점검)의 색 `settlement-*` 은 안내 띠 `InfoStrip` 만 쓴다. 테마를 따르지 않는 전용 색이라
// 다른 자리가 쓰면 그 자리가 상태 띠처럼 읽히고, 띠를 화면이 직접 그리면 세 띠의 모양이 다시 갈린다.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')
const OWNER = join('components', 'molecules', 'InfoStrip')

function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (name === '__tests__' || name === 'node_modules') continue
    if (statSync(path).isDirectory()) out.push(...sources(path))
    else if (/\.tsx$/.test(name) && !/\.(test|spec)\.tsx$/.test(name)) out.push(path)
  }
  return out
}

describe('안내 띠의 색', () => {
  it('settlement 색 클래스는 InfoStrip 밖에서 쓰지 않는다', () => {
    const files = [...sources(join(SRC, 'app')), ...sources(join(SRC, 'components'))].filter(
      (file) => !relative(SRC, file).startsWith(OWNER),
    )
    expect(files.length).toBeGreaterThan(100)

    const offenders = files
      .filter((file) => /\b(bg|text)-settlement-[a-z-]+/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
    expect(offenders).toEqual([])
  })
})
