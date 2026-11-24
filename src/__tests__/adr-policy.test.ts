// ADR 규칙 검사
//
// 검사는 일곱이다.
//
//   1. 파일 이름이 `ADR-{번호목록}_{카테고리}_{기능}.md` 이고 카테고리가 표에 있다
//   2. 한 번호는 한 파일에만 있다
//   3. 파일 머리의 제목 · 배지 · 번호 기록이 파일 이름과 맞는다
//   4. 인덱스 행과 파일이 일대일로 맞고 배지가 같다
//   5. 문서의 `[[ADR-NNN]]` 인용이 실재하는 번호를, `결정 N` 이 실재하는 결정을 가리킨다
//   6. 소스는 ADR 을 인용하지 않는다
//   7. 앞으로 바뀔 일을 적은 버전 메모는 ⚪ 미구현 ADR 에만 있다
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..')
const ROOT = join(REPO_ROOT, 'docs')
const SRC = join(REPO_ROOT, 'src')
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

function filesUnder(dir: string, ext: RegExp): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== 'node_modules' && entry !== '__snapshots__') out.push(...filesUnder(path, ext))
    } else if (ext.test(entry)) {
      out.push(path)
    }
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

  const citations = filesUnder(ROOT, /\.md$/).flatMap((file) =>
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

/** 버전 뒤에 앞으로 바뀔 일을 적은 메모. `(1.0.15 에서 바뀐다)` · `1.0.15 부터 없앤다` 같은 것이다. */
const VERSION_NOTE = /\d+\.\d+\.\d+ ?(?:에서|부터는?) (?:바뀐다|바꾼다|없앤다|없어진다|걷는다|옮긴다|더한다)/g

describe('구현 전의 일', () => {
  // 🟢 ADR 과 기능 · 토대 · 저장소 문서는 지금 트리에 구현된 것만 적는다. 거기 단 예고 메모는 구현한 PR 이 자기 문서만
  // 고쳐서 구현 뒤에도 남는다. 앞으로의 일은 그 결정을 적는 ⚪ ADR 에만 둔다. 버전 숫자로 견주지 않는다. develop 의
  // `app.json` 버전은 release 를 딸 때까지 운영 버전이라, develop 에 들어온 새 버전의 일을 가리지 못한다.
  it('버전 예고 메모는 ⚪ ADR 에만 있다', () => {
    const offenders: string[] = []
    for (const file of filesUnder(ROOT, /\.md$/)) {
      let text = readFileSync(file, 'utf8')
      const adr = FILES.find((f) => join(ADR_DIR, f.name) === file)
      if (adr !== undefined) {
        if (BADGE.exec(adr.body.split('\n').slice(0, 6).join('\n'))?.[0] === '⚪') continue
        // 번호 기록은 그때 한 일의 기록이라 옛 메모를 걷은 일도 적힌다.
        if (text.includes('## 번호 기록')) text = text.slice(0, text.lastIndexOf('## 번호 기록'))
      }
      // 코드 블록과 백틱 속은 메모를 예로 들어 가리킨 것이다.
      const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
      const rel = file.slice(REPO_ROOT.length + 1)
      for (const m of prose.matchAll(VERSION_NOTE)) offenders.push(`${rel}: ${m[0]}`)
    }
    expect(offenders).toEqual([])
  })
})

describe('소스의 ADR 인용', () => {
  // 참조는 한 방향이다. 문서가 파일을 가리키는 것은 결정이 코드를 관리하는 일이고, 그 반대에는
  // 권한이 없다. 주석뿐 아니라 문자열(테스트 이름 · 에러 문구)도 같다. 이 파일만 예외다. 검사하려면
  // 인용을 패턴으로 적어야 한다.
  // 번호를 걷고 `(결정 N)` 만 남긴 인용도 막는다. 어느 문서의 결정인지 안 적혀 있어 아무것도 가리키지 않는데,
  // 인용이 붙어 있으니 이유를 적은 것처럼 보인다. 이렇게 남은 것이 마흔여섯 곳이었다.
  it('소스는 ADR 번호도 번호만 남은 결정 인용도 적지 않는다', () => {
    const self = join('src', '__tests__', 'adr-policy.test.ts')
    const offenders: string[] = []
    for (const file of filesUnder(SRC, /\.tsx?$/)) {
      const rel = file.slice(REPO_ROOT.length + 1)
      if (rel === self) continue
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (/ADR-\d{3}|\((결정|정정) \d/.test(line)) offenders.push(`${rel}: ${line.trim().slice(0, 60)}`)
      }
    }
    expect([...new Set(offenders)]).toEqual([])
  })

  // 설정 · 스크립트 · 네이티브 모듈도 소스다. 이 검사가 `src/` 만 보는 동안 그쪽에 옛 번호가 백 줄 넘게 쌓였고,
  // 문서를 다시 쓰며 번호가 바뀌자 그 인용은 엉뚱한 문서를 가리켰다. 문서(`docs/` · `*.md`)는 번호로 가리키는
  // 것이 규칙이라 뺀다. 번호를 받는 스크립트와 그 테스트는 번호를 다루는 코드라 뺀다.
  it('src 밖의 소스도 ADR 번호를 적지 않는다', () => {
    const exempt = new Set(['scripts/adr-number.mjs', 'scripts/__tests__/adr-number.test.mjs'])
    const tracked = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' }).split('\n')
    const sources = tracked.filter(
      (rel) =>
        rel !== '' &&
        !rel.startsWith('src/') &&
        !rel.startsWith('docs/') &&
        !rel.endsWith('.md') &&
        !exempt.has(rel) &&
        !/\.(png|jpe?g|webp|gif|ttf|otf|ico|svg|mp4|jar|keystore|p8|bin)$/.test(rel),
    )
    const offenders: string[] = []
    for (const rel of sources) {
      const path = join(REPO_ROOT, rel)
      if (!existsSync(path)) continue
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (/ADR-\d{3}/.test(line)) offenders.push(`${rel}: ${line.trim().slice(0, 60)}`)
      }
    }
    expect([...new Set(offenders)]).toEqual([])
  })
})
