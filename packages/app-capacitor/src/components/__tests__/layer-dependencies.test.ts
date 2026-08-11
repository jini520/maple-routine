/// <reference types="node" />
// 아토믹 계층의 **의존 방향**을 강제한다(ADR-094 결정 2).
//
// 디렉터리를 나눈 실질이 여기 있다 — 규칙이 문서에만 있으면 시간이 지나며 어긋나고, 그때는
// 이미 되돌리기 어렵다. 이 테스트가 있으면 "새 컴포넌트를 어디 둘지"가 구조로 정해진다.
//
// 규칙: **아래로만 흐른다.** atom 은 아무것도 import 하지 않고, molecule 은 atom 까지,
// organism 은 molecule 까지, template 은 organism 까지 쓸 수 있다. 반대 방향은 계층이
// 무너진 것이다 — 예를 들어 atom 이 organism 을 쓰면 그 atom 은 더 이상 "토큰과 자기 상자만
// 아는" 것이 아니게 되고, 재사용하려 할 때마다 organism 이 딸려온다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const LAYERS = ['atoms', 'molecules', 'organisms', 'templates'] as const
type Layer = (typeof LAYERS)[number]

const RANK: Record<Layer, number> = { atoms: 0, molecules: 1, organisms: 2, templates: 3 }
// cwd 가 아니라 **이 파일** 기준이다 — 저장소 전체를 도는 `npm test` 는 루트에서, 패키지의
// `npm test` 는 패키지에서 돌기 때문에 cwd 상대 경로면 한쪽에서 디렉터리를 못 찾는다.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

function sourceFilesIn(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      // 테스트는 제외한다 — 픽스처를 만들려고 상위 계층을 참조하는 것은 정상이다.
      if (entry !== '__tests__') out.push(...sourceFilesIn(path))
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(path)
    }
  }
  return out
}

interface Violation {
  file: string
  from: Layer
  to: Layer
  specifier: string
}

function findViolations(): Violation[] {
  const violations: Violation[] = []
  for (const layer of LAYERS) {
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

describe('컴포넌트 계층 의존 방향 (ADR-094 결정 2)', () => {
  it('의존은 아래로만 흐른다 — 상위 계층을 import 하지 않는다', () => {
    const violations = findViolations().map(
      (v) => `${v.file}: ${v.from} → ${v.to} (${v.specifier})`,
    )

    expect(violations).toEqual([])
  })

  it('계층 디렉터리 네 개가 모두 존재하고 비어 있지 않다', () => {
    for (const layer of LAYERS) {
      expect(sourceFilesIn(join(ROOT, layer)).length).toBeGreaterThan(0)
    }
  })

  // 계층 밖에 컴포넌트를 두면 규칙이 적용되지 않는 사각이 생긴다. 컴포넌트가 아닌 공유
  // 상수(mapleLeafPath)는 예외로 둔다 — 그것은 계층을 갖는 대상이 아니다.
  it('components 바로 아래에는 계층 디렉터리와 공유 상수만 둔다', () => {
    const entries = readdirSync(ROOT).filter((e) => e !== '__tests__')
    const unexpected = entries.filter(
      (e) => !(LAYERS as readonly string[]).includes(e) && e !== 'mapleLeafPath.ts',
    )

    expect(unexpected).toEqual([])
  })
})
