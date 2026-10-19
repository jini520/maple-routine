// 새 ADR 규칙 검사 (docs-next)
//
// 재작성 중에는 새 문서를 `docs-next/` 에 쓰고, 다 쓰면 `docs/` 와 바꾼다. 옛 번호와 새 번호가
// 겹치므로 폴더를 나눴고, 이 파일은 새 폴더에만 건다. 교체할 때 `ROOT` 를 `docs` 로 바꾸고
// 옛 검사(`adr-citation-policy.test.ts`)의 문서 쪽 검사를 지운다.
//
// 검사는 다섯이다.
//
//   1. 파일 이름이 `ADR-{번호목록}_{카테고리}_{기능}.md` 이고 카테고리가 표에 있다
//   2. 한 번호는 한 파일에만 있다
//   3. 파일 머리의 제목 · 배지 · 번호 기록이 파일 이름과 맞는다
//   4. 인덱스 행과 파일이 일대일로 맞고 배지가 같다
//   5. 문서의 `[[ADR-NNN]]` 인용이 실재하는 번호를, `결정 N` 이 실재하는 결정을 가리킨다
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..')
const ROOT = join(REPO_ROOT, 'docs-next')
const ADR_DIR = join(ROOT, 'adr')
const INDEX = join(ROOT, 'ADR.md')

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
const FILE_NAME = new RegExp(`^ADR-(\\d{3}(?:\\+\\d{3})*)_(${SLUG})_(${SLUG})\\.md$`)
const BADGE = /[🟢🟡⛔⚪🗑]/u
const CITATION = /\[\[ADR-(\d{3})\]\](?: *결정 *(\d+(?:-\d+)?(?: *· *\d+(?:-\d+)?)*))?/g

type AdrFile = { name: string; numbers: string[]; category: string; body: string }

function adrFiles(): AdrFile[] {
  if (!existsSync(ADR_DIR)) return []
  return readdirSync(ADR_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const m = FILE_NAME.exec(name)
      return {
        name,
        numbers: m ? m[1].split('+') : [],
        category: m ? m[2] : '',
        body: readFileSync(join(ADR_DIR, name), 'utf8'),
      }
    })
}

/** `ADR.md` 카테고리 표의 slug 목록. */
function categories(): string[] {
  const text = readFileSync(INDEX, 'utf8')
  const section = text.slice(text.indexOf('## 카테고리'), text.indexOf('## 문서 형식'))
  return [...section.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1])
}

function markdownUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...markdownUnder(path))
    else if (entry.endsWith('.md')) out.push(path)
  }
  return out
}

/** 본문의 `### 결정 N.` 제목 번호. 형식 설명 속 예시를 피하려고 코드 블록은 뺀다. */
function decisionsIn(body: string): Set<string> {
  const text = body.replace(/```[\s\S]*?```/g, '')
  return new Set([...text.matchAll(/^#{3,4} *결정 *(\d+(?:-\d+)?)\./gm)].map((m) => m[1]))
}

const FILES = adrFiles()
const CATEGORIES = categories()

describe('새 ADR 파일', () => {
  it('카테고리 표를 실제로 읽었다', () => {
    // 경로가 틀려 빈 표를 읽고도 초록이 되는 것을 막는다.
    expect(CATEGORIES.length).toBeGreaterThan(20)
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length)
  })

  it('파일 이름이 규칙을 따른다', () => {
    const bad = FILES.filter((f) => f.numbers.length === 0).map((f) => f.name)
    expect(bad).toEqual([])
  })

  it('번호는 오름차순이고 카테고리는 표에 있다', () => {
    const bad = FILES.filter(
      (f) =>
        f.numbers.some((n, i) => i > 0 && n <= f.numbers[i - 1]) || !CATEGORIES.includes(f.category),
    ).map((f) => f.name)
    expect(bad).toEqual([])
  })

  it('한 번호는 한 파일에만 있다', () => {
    const seen = new Map<string, string>()
    const duplicated: string[] = []
    for (const f of FILES) {
      for (const n of f.numbers) {
        if (seen.has(n)) duplicated.push(`ADR-${n}: ${seen.get(n)} · ${f.name}`)
        seen.set(n, f.name)
      }
    }
    expect(duplicated).toEqual([])
  })

  it('제목이 파일 이름의 번호로 시작한다', () => {
    const bad = FILES.filter(
      (f) => f.numbers.length && !f.body.startsWith(`# ADR-${f.numbers.join('+')} `),
    ).map((f) => f.name)
    expect(bad).toEqual([])
  })

  it('상태 배지는 🟢 유효 · ⚪ 미구현 둘 중 하나다', () => {
    // 부분 폐기 · 폐기 상태를 두지 않는다. 죽은 결정은 지우고, 전부 죽으면 파일을 지운다.
    const bad = FILES.filter((f) => {
      const badge = BADGE.exec(f.body.split('\n').slice(0, 6).join('\n'))?.[0]
      return badge !== '🟢' && badge !== '⚪'
    }).map((f) => f.name)
    expect(bad).toEqual([])
  })

  it('파일 이름의 번호마다 번호 기록 줄이 있다', () => {
    const missing: string[] = []
    for (const f of FILES) {
      const log = f.body.slice(f.body.lastIndexOf('## 번호 기록'))
      for (const n of f.numbers) {
        if (!f.body.includes('## 번호 기록') || !log.includes(`- ADR-${n} (`)) {
          missing.push(`${f.name} → ADR-${n}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})

describe('새 ADR 인덱스', () => {
  const rows = readFileSync(INDEX, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('| [ADR-'))
    .map((l) => {
      const cells = l.split('|')
      return {
        target: /\(\.\/adr\/([^)]+)\)/.exec(cells[1])?.[1] ?? '',
        badge: BADGE.exec(cells[2])?.[0] ?? null,
      }
    })

  it('인덱스 행과 파일이 일대일로 맞는다', () => {
    expect(rows.map((r) => r.target).sort()).toEqual(FILES.map((f) => f.name).sort())
  })

  it('인덱스의 배지가 파일의 배지와 같다', () => {
    const mismatched = rows
      .map((r) => ({ r, f: FILES.find((f) => f.name === r.target) }))
      .filter(({ r, f }) => f && r.badge !== BADGE.exec(f.body.split('\n').slice(0, 6).join('\n'))?.[0])
      .map(({ r }) => r.target)
    expect(mismatched).toEqual([])
  })
})

describe('새 문서의 ADR 인용', () => {
  const byNumber = new Map<string, AdrFile>()
  for (const f of FILES) for (const n of f.numbers) byNumber.set(n, f)

  const citations = markdownUnder(ROOT).flatMap((file) =>
    // 코드 블록 속 형식 예시는 인용이 아니다.
    [...readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '').matchAll(CITATION)].map((m) => ({
      file: file.slice(REPO_ROOT.length + 1),
      adr: m[1],
      decisions: m[2] ? m[2].split(/ *· */) : [],
    })),
  )

  it('인용이 실재하는 번호를 가리킨다', () => {
    const dangling = citations.filter((c) => !byNumber.has(c.adr)).map((c) => `${c.file} → ADR-${c.adr}`)
    expect([...new Set(dangling)]).toEqual([])
  })

  it('`결정 N` 이 그 파일에 실제로 있다', () => {
    const broken: string[] = []
    for (const c of citations) {
      const f = byNumber.get(c.adr)
      if (!f) continue
      const declared = decisionsIn(f.body)
      for (const n of c.decisions) {
        if (!declared.has(n)) broken.push(`${c.file} → ADR-${c.adr} 결정 ${n}`)
      }
    }
    expect([...new Set(broken)]).toEqual([])
  })
})
