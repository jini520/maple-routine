// 옅은 원 안에 아이콘을 둔 배지(지름 28 이상)는 `atoms/IconBadge` 만 그린다. 화면이 직접 그리면 다음 화면이 또 다른 지름과 선 굵기를 고른다.
// 지름 16 · 20 처럼 다른 것에 붙는 작은 표시와, 수입 · 지출 색을 쓰는 가계부 줄의 원은 배지가 아니라서 세지 않는다.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')
const OWNER = join('components', 'atoms', 'IconBadge', 'IconBadge.tsx')
const MIN_BADGE_PX = 28

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

/** `h-8` 은 32, `h-[30px]` 은 30. 모르는 값은 0 */
function pxOf(token: string): number {
  const arbitrary = token.match(/^\[(\d+)px\]$/)
  if (arbitrary) return Number(arbitrary[1])
  return /^\d+(\.\d+)?$/.test(token) ? Number(token) * 4 : 0
}

describe('원 배지', () => {
  it('옅은 원 안에 아이콘을 둔 배지는 IconBadge 만 그린다', () => {
    const files = sources(SRC)
    expect(files.length).toBeGreaterThan(100)

    const drawn = files.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/className=\{?[`"]([^`"]*)[`"]/g)]
        .map((match) => match[1])
        .filter((classes) => /\brounded-full\b/.test(classes) && /\bbg-(primary|secondary|third|error)-tint\b/.test(classes))
        .filter((classes) => {
          const size = classes.match(/\bh-(\S+) w-\1(?=\s|$)/)
          return size !== null && pxOf(size[1]) >= MIN_BADGE_PX
        })
        .map(() => relative(SRC, file)),
    )
    expect(drawn.filter((file) => file !== OWNER)).toEqual([])
  })
})
