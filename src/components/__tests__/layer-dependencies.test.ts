// 아토믹 계층의 **의존 방향**을 강제한다. `app-capacitor` 의 같은 이름 테스트를
// RN 쪽으로 옮긴 것이고, 규칙도 같다.
//
// 디렉터리를 나눈 실질이 여기 있다. 규칙이 문서에만 있으면 시간이 지나며 어긋나고, 그때는
// 이미 되돌리기 어렵다. 이 테스트가 있으면 "새 컴포넌트를 어디 둘지"가 구조로 정해진다. 전환 중에는
// 특히 필요하다: 화면(step 4~6)이 붙기 전에 계층이 무너지면 되돌리는 값이 훨씬 비싸다.
//
// ── 웹판과 다른 것 둘 ─────────────────────────────────────────────────────────────
//
// ① 경로 기준이 `import.meta.url` → `__dirname`. 이 패키지의 테스트는 jest(CJS)라 `import.meta` 가
//    없다. 뜻은 같다. **cwd 가 아니라 이 파일** 기준이어야 어디서 돌리든 같은 디렉터리를 본다.
// ② 웹판은 *"계층 디렉터리 네 개가 모두 존재하고 비어 있지 않다"* 를 단언하지만, 여기서는 계층이
//    **아래에서부터 차례로** 도착한다(step 3 atoms → 4 molecules → 5 organisms → 6 templates).
//    그래서 "네 개"가 아니라 **"있는 것은 아래에서부터 끊기지 않는다"** 로 적는다. 지금 통과시키려고
//    수를 줄여 적으면 step 6 뒤에 그 숫자를 되돌릴 사람이 필요한데, 이렇게 두면 계층이 하나 늘 때
//    **손댈 것이 없다**.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LAYERS = ['atoms', 'molecules', 'organisms', 'templates'] as const
type Layer = (typeof LAYERS)[number]

const RANK: Record<Layer, number> = { atoms: 0, molecules: 1, organisms: 2, templates: 3 }
const ROOT = join(__dirname, '..')

function exists(path: string): boolean {
  try {
    statSync(path)
    return true
  } catch {
    return false
  }
}

function sourceFilesIn(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      // 테스트는 제외한다. 픽스처를 만들려고 상위 계층을 참조하는 것은 정상이다.
      if (entry !== '__tests__') out.push(...sourceFilesIn(path))
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(path)
    }
  }
  return out
}

/** 지금까지 옮겨온 계층. 없는 디렉터리는 아직 안 온 것이지 위반이 아니다. */
const presentLayers = LAYERS.filter((layer) => exists(join(ROOT, layer)))

interface Violation {
  file: string
  from: Layer
  to: Layer
  specifier: string
}

function findViolations(): Violation[] {
  const violations: Violation[] = []
  for (const layer of presentLayers) {
    for (const file of sourceFilesIn(join(ROOT, layer))) {
      const source = readFileSync(file, 'utf8')
      for (const [, specifier] of source.matchAll(/from '([^']+)'/g)) {
        const matched = /(?:^|\/)(atoms|molecules|organisms|templates)\//.exec(specifier)
        if (matched === null) continue
        const target = matched[1] as Layer
        if (RANK[target] > RANK[layer]) {
          violations.push({ file, from: layer, to: target, specifier })
        }
      }
    }
  }
  return violations
}

describe('컴포넌트 계층 의존 방향', () => {
  it('의존은 아래로만 흐른다. 상위 계층을 import 하지 않는다', () => {
    const violations = findViolations().map(
      (v) => `${v.file}: ${v.from} → ${v.to} (${v.specifier})`,
    )

    expect(violations).toEqual([])
  })

  it('옮겨온 계층은 아래에서부터 끊기지 않고, 전부 비어 있지 않다', () => {
    // `atoms` 없이 `molecules` 만 있는 상태는 "아직 안 옮긴 것"이 아니라 계층을 건너뛴 것이다.
    expect(presentLayers).toEqual(LAYERS.slice(0, presentLayers.length))
    expect(presentLayers.length).toBeGreaterThan(0)

    for (const layer of presentLayers) {
      expect(sourceFilesIn(join(ROOT, layer)).length).toBeGreaterThan(0)
    }
  })

  // 계층 밖에 컴포넌트를 두면 규칙이 적용되지 않는 사각이 생긴다. 예외가 하나 있었으나
  // 단풍잎 경로가 `atoms/Icon/maple-leaf.ts` 로 들어가 없어졌다.
  it('components 바로 아래에는 계층 디렉터리만 둔다', () => {
    const entries = readdirSync(ROOT).filter((e) => e !== '__tests__')
    const unexpected = entries.filter((e) => !(LAYERS as readonly string[]).includes(e))

    expect(unexpected).toEqual([])
  })
})
