// 대기 표시는 `atoms/Spinner` 의 링 하나다. 모양이 둘 이상이면 같은 기다림이 쓰는 곳에 따라 다른 뜻으로 읽힌다.
// 새 스피너 컴포넌트를 만들지 않고 `Spinner` 의 크기와 색으로 맞춘다.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')
const OWNER = join('components', 'atoms', 'Spinner', 'Spinner.tsx')

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

describe('스피너', () => {
  it('이름이 Spinner 로 끝나는 컴포넌트는 atoms/Spinner 의 Spinner 하나다', () => {
    const files = sources(SRC)
    expect(files.length).toBeGreaterThan(100)

    const spinners = files.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/export function (\w*Spinner)\b/g)].map(
        (match) => `${relative(SRC, file)} ${match[1]}`,
      ),
    )
    expect(spinners).toEqual([`${OWNER} Spinner`])
  })
})
