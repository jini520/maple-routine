// 떠 있는 ＋ 의 원은 `components/molecules/Fab` 하나가 그린다. 화면이 같은 원을 다시 그리면 다음 버튼이 또 다른
// 크기나 그림자를 고르고, 갈려도 화면에서는 한쪽이 조금 다르다로만 보여 알아채기 어렵다.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')
const OWNER = join('components', 'molecules', 'Fab')

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

/** 56 원 버튼의 클래스. 지름 · 원 · 테마색 셋이 한 `className` 에 함께 있으면 그 원이다. */
function drawsFabCircle(className: string): boolean {
  const classes = className.split(/\s+/)
  return classes.includes('h-14') && classes.includes('w-14') && classes.includes('rounded-full') && classes.includes('bg-primary')
}

describe('떠 있는 ＋ 의 원', () => {
  it('Fab 밖에서는 56 원 버튼을 직접 그리지 않는다', () => {
    const files = [...sources(join(SRC, 'app')), ...sources(join(SRC, 'components'))].filter(
      (file) => !relative(SRC, file).startsWith(OWNER),
    )
    expect(files.length).toBeGreaterThan(100)

    const offenders: string[] = []
    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(/className="([^"]+)"/g)) {
        if (drawsFabCircle(match[1])) offenders.push(relative(SRC, file))
      }
    }
    expect(offenders).toEqual([])
  })
})
