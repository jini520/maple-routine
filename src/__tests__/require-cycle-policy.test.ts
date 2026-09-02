// 런타임 import 사이클 가드. `docs/foundation/architecture.md` `런타임 import 사이클을 만들지 않는다`.
//
// ## 왜 테스트가 필요한가
//
// 사이클은 **깨지지 않는다.** 값이 함수 본문에서만 쓰이면 호출 시점에 바인딩이 풀려 아무 일도
// 일어나지 않고, 그래서 리뷰에서 잡히지 않는다. 대가는 두 가지로 온다. 콜드 스타트마다 뜨는
// LogBox 배너(사용자가 **하단 warning toast** 로 신고한 그것)와, 언젠가 누가 그 심볼을 모듈
// 최상위로 끌어올렸을 때의 `undefined`.
//
// 웹만 보면 안 보인다: 이 경고를 내는 것은 Metro 뿐이고 Vite/Rollup 은 같은 사이클을 말없이
// 번들한다. 그래서 가드가 **app-rn 에** 있고, 훑는 범위는 Metro 가 실제로 번들하는 그래프다
// (`src/`). Metro 가 실제로 번들하는 그래프만 대상이다.
//
// ## `import type` 을 세지 않는 이유
//
// 컴파일에 지워져 `require` 가 안 나간다. Metro 도 세지 않는다. 실제로 `format.ts` 와
// `use-sync-error-toast.ts` 는 `./schedule-sync` 에서 `ScheduleSyncError` 를 타입으로만 가져오는데,
// 그 둘은 사이클이 아니다. 이것을 세면 고칠 것이 없는 자리를 고치라고 말하게 된다.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const SRC = join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== '__tests__' && entry !== '__mocks__' && entry !== '__snapshots__') {
        out.push(...sourceFiles(path))
      }
    } else if (/\.tsx?$/.test(entry) && !/\.(test|d)\.tsx?$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

/** 상대 경로만 푼다. 패키지 의존은 사이클을 만들 수 없다(이후 alias 가 없다). */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier)

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/** 명명 import 가 **전부** `type` 이면 그 구문도 통째로 지워진다(`{ type A, type B }`). */
function isTypeOnly(clause: string): boolean {
  const named = /^\{([\s\S]*)\}$/.exec(clause.trim())
  if (named === null) return false
  const specifiers = named[1]
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  return specifiers.length > 0 && specifiers.every((part) => part.startsWith('type '))
}

function runtimeDependencies(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  const out = new Set<string>()
  // `import type …` / `export type …` 는 앞의 `(?!type\s)` 가 거른다.
  const pattern = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    if (isTypeOnly(match[1])) continue
    const target = resolveSpecifier(file, match[2])
    if (target !== null && target !== file) out.add(target)
  }
  return [...out]
}

/** 사이클을 **경로 그대로** 돌려준다. 어느 고리를 끊어야 하는지 실패 메시지가 말해야 한다. */
function findCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = []
  const seen = new Set<string>()
  const visiting = new Set<string>()
  const done = new Set<string>()
  const stack: string[] = []

  function walk(node: string): void {
    visiting.add(node)
    stack.push(node)
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) continue
      if (visiting.has(next)) {
        const cycle = [...stack.slice(stack.indexOf(next)), next]
        const key = [...cycle].slice(0, -1).sort().join('|')
        if (!seen.has(key)) {
          seen.add(key)
          cycles.push(cycle)
        }
      } else if (!done.has(next)) {
        walk(next)
      }
    }
    stack.pop()
    visiting.delete(node)
    done.add(node)
  }

  for (const node of graph.keys()) if (!done.has(node)) walk(node)
  return cycles
}

describe('런타임 import 사이클', () => {
  it('Metro 가 번들하는 그래프에 사이클이 없다', () => {
    const files = sourceFiles(SRC)
    const graph = new Map(files.map((file) => [file, runtimeDependencies(file)]))

    const readable = findCycles(graph).map((cycle) =>
      cycle.map((path) => path.replace(resolve(__dirname, '../..'), '')).join('\n  → '),
    )

    expect(readable).toEqual([])
  })

  // 그래프를 못 읽고 있으면 위 테스트는 **사이클 0건** 으로 조용히 통과한다. 해석이 실제로
  // 도는지 하나로 붙든다. 화면(`app/`)에서 로직 층(`features/`)까지 건너가는 것을 고르는 이유는
  //  로 둘이 한 트리가 됐어도 **그 방향의 의존이 여전히 이 그래프의 본론**이라서다.
  it('그래프를 실제로 읽는다', () => {
    const entry = join(SRC, 'app/AppShell.tsx')
    const deps = runtimeDependencies(entry)

    expect(deps).toContain(join(SRC, 'features/theme/store.ts'))
    expect(deps).toContain(join(SRC, 'app/prehydrate.ts'))
  })
})
