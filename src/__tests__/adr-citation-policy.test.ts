// ADR 인용 링크 검사
//
// 문서에 `[[ADR-NNN]]` 인용이 수천 건 있는데 이게 맞는 주소인지 확인하는 장치가 없었다. 링크가
// 깨져도 타입 검사도 테스트도 그대로 통과한다. 문서가 조용히 썩는 자리라서 여기서 막는다.
//
// 검사는 넷이다.
//
//   1. 소스가 ADR 을 아예 인용하지 않는가
//   2. 문서의 인용이 실제 파일을 가리키는가
//   3. `결정 N` 까지 특정한 인용의 N 이 그 문서에 실제로 있는가
//   4. `docs/ADR.md` 인덱스의 배지가 각 파일의 배지와 같은가
//
// ## 1번이 소스 쪽 검사 전부다
//
// 참조는 한 방향이다. 문서가 파일을 가리키는 것은 결정이 코드를 관리하는 일이고, 그 반대에는
// 권한이 없다. 종전에는 `소스가 완전히 죽은 ADR 을 인용하지 않는가`를 봤는데, 인용 자체를
// 막으면 그 검사가 할 일이 없어진다.
//
// ## 3번을 전부에 걸지 않는 이유
//
// ADR 마다 결정을 적는 형식이 다르다. 최근 것은 `### 결정 1.` 제목을 쓰지만, 옛 문서는
// `**결정**:` 아래 번호 목록이거나 `## 결정` 아래 `### 1.` 이고, 아예 제목 없이 문단으로만
// 적힌 것도 있다. 형식이 여섯 갈래라 기계가 안전하게 읽어낼 수 있는 것은 지금 16개뿐이다.
//
// 그래서 `### 결정 1.` 제목을 쓰는 문서만 엄격히 보고 나머지는 검사하지 않는다. 대신
// `CANONICAL_BASELINE` 으로 기준선을 박아 **되돌아가는 것만 막는다**. 문서를 정리해 형식을
// 맞추면 그 ADR 은 자동으로 검사 대상이 되고, 한 번 대상이 된 것은 다시 빠질 수 없다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..')
const SRC = join(REPO_ROOT, 'src')
const DOCS = join(REPO_ROOT, 'docs')
const ADR_DIR = join(DOCS, 'adr')
const INDEX = join(DOCS, 'ADR.md')

/** 인용 한 건. `` 이면 kind='결정', numbers=['11']. */
type Citation = { file: string; adr: string; kind?: string; numbers: string[] }

/**
 * 인용 정규식. 쉼표 뒤는 날짜가 오는 자리라(`결정 7, 2026-08-25`) 번호 목록으로 읽지 않는다.
 * 가운뎃점만 목록 구분자다(`결정 3·4`).
 */
const CITATION = /\[\[ADR-(\d{3})\]\](?: *(결정|정정) *(\d+(?:-\d+)?(?: *· *\d+(?:-\d+)?)*))?/g

/** 형식을 기계가 읽을 수 있어 검사 대상인 ADR. 여기서 빠지면 실패한다. 되돌아가지 말라는 뜻. */
const CANONICAL_BASELINE = [
  '139', '140', '141', '142', '143', '144', '145', '146',
  '147', '166', '167', '169', '170', '171', '172', '173',
]

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

function citationsIn(files: string[]): Citation[] {
  const out: Citation[] = []
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(CITATION)) {
      out.push({
        file: file.slice(REPO_ROOT.length + 1),
        adr: m[1],
        kind: m[2],
        numbers: m[3] ? m[3].split(/ *· */) : [],
      })
    }
  }
  return out
}

/** `docs/adr/` 에 있는 ADR 번호 → 본문. */
function adrBodies(): Map<string, string> {
  const out = new Map<string, string>()
  for (const entry of readdirSync(ADR_DIR)) {
    const m = /^ADR-(\d{3})\.md$/.exec(entry)
    if (m) out.set(m[1], readFileSync(join(ADR_DIR, entry), 'utf8'))
  }
  return out
}

const BADGE = /[🟢🟡⛔⚪🗑]/u

/** 문서 머리(제목 + 배너)에 박힌 상태 배지. */
function badgeOf(body: string): string | null {
  return BADGE.exec(body.split('\n').slice(0, 8).join('\n'))?.[0] ?? null
}

/**
 * 이 문서가 정의하는 결정·정정 번호. `### 결정 1.` 이 있는 문서만 다룬다. 첫 결정이 제목으로
 * 서 있으면 나머지도 그렇다는 뜻이고, 그 가정이 깨지면 검사 3이 잡는다.
 */
function declaredNumbers(body: string): { decisions: Set<string>; corrections: Set<string> } | null {
  if (!/^#{3,4} *결정 *1\./m.test(body)) return null
  const decisions = new Set<string>()
  const corrections = new Set<string>()
  for (const m of body.matchAll(/^#{3,4} *결정 *(\d+(?:-\d+)?)\./gm)) decisions.add(m[1])
  for (const m of body.matchAll(/^#{2,4} *정정 *(\d+)/gm)) corrections.add(m[1])
  return { decisions, corrections }
}

const BODIES = adrBodies()
const SRC_CITATIONS = citationsIn(filesUnder(SRC, /\.tsx?$/))
const DOC_CITATIONS = citationsIn(filesUnder(DOCS, /\.md$/))

/** 이 파일은 인용을 **패턴으로** 적어야 해서 스스로를 뺀다. */
const SELF = join('src', '__tests__', 'adr-citation-policy.test.ts')

describe('ADR 인용 링크', () => {
  it('훑을 것을 실제로 찾았다', () => {
    // 경로가 틀려 0건을 훑고도 초록이 되는 것이 이 부류 가드의 흔한 실패다.
    expect(BODIES.size).toBeGreaterThan(150)
    expect(DOC_CITATIONS.length).toBeGreaterThan(3000)
  })

  it('모든 인용이 실제 ADR 파일을 가리킨다', () => {
    const dangling = DOC_CITATIONS.filter((c) => !BODIES.has(c.adr)).map(
      (c) => `${c.file} → ADR-${c.adr}`,
    )

    expect([...new Set(dangling)]).toEqual([])
  })

  it('소스는 ADR 을 인용하지 않는다', () => {
    // 참조는 한 방향이다. 문서가 파일을 가리키는 것은 결정이 코드를 관리하는 일이고, 그 반대에는
    // 권한이 없다. 주석뿐 아니라 문자열(테스트 이름·에러 문구)도 같다. 어느 쪽이든 ADR 을 손볼
    // 때 소스가 검토 대상이 되는 것은 마찬가지다.
    //
    // 이 파일만 예외다. 인용을 **패턴으로** 적어야 검사를 할 수 있다.
    const offenders = SRC_CITATIONS.filter((c) => c.file !== SELF).map(
      (c) => `${c.file} → ADR-${c.adr}`,
    )

    expect([...new Set(offenders)]).toEqual([])

    // 대괄호 없는 언급도 같다. 848건이 이 검사 밖에 있었다.
    const bare: string[] = []
    for (const file of filesUnder(SRC, /\.tsx?$/)) {
      const rel = file.slice(REPO_ROOT.length + 1)
      if (rel === SELF) continue
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (/(?<!\[\[)ADR-\d{3}/.test(line)) bare.push(`${rel}: ${line.trim().slice(0, 60)}`)
      }
    }

    expect([...new Set(bare)]).toEqual([])
  })

  it('`결정 N` 까지 특정한 인용의 번호가 그 문서에 실제로 있다', () => {
    const broken: string[] = []
    let checked = 0

    for (const c of DOC_CITATIONS) {
      if (!c.kind || c.numbers.length === 0) continue
      const declared = declaredNumbers(BODIES.get(c.adr) ?? '')
      if (!declared) continue

      const pool = c.kind === '결정' ? declared.decisions : declared.corrections
      // 정정을 하나도 안 쓰는 문서면 판단할 근거가 없다. 건너뛴다.
      if (pool.size === 0) continue

      for (const n of c.numbers) {
        checked += 1
        if (!pool.has(n)) broken.push(`${c.file} → ADR-${c.adr} ${c.kind} ${n}`)
      }
    }

    // 소스 인용이 사라지면서 대상이 문서뿐이 됐다. 이 숫자는 `정말 훑었나` 가드다.
    expect(checked).toBeGreaterThan(600)
    expect([...new Set(broken)]).toEqual([])
  })

  it('형식을 맞춘 ADR 은 다시 옛 형식으로 돌아가지 않는다', () => {
    const regressed = CANONICAL_BASELINE.filter((n) => !declaredNumbers(BODIES.get(n) ?? ''))

    expect(regressed).toEqual([])
  })
})

describe('ADR 인덱스', () => {
  const rows = readFileSync(INDEX, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('| ['))
    .map((l) => {
      const cells = l.split('|')
      return { adr: /\[(\d+)\]/.exec(cells[1])?.[1] ?? '', badge: BADGE.exec(cells[2])?.[0] ?? null }
    })

  it('인덱스 행과 파일이 일대일로 맞는다', () => {
    expect(rows.length).toBe(BODIES.size)
    expect(rows.filter((r) => !BODIES.has(r.adr)).map((r) => r.adr)).toEqual([])
  })

  it('인덱스의 배지가 파일의 배지와 같다', () => {
    // 인덱스가 🟢 라고 적어 두면 다음 세션은 파일을 안 열고 근거로 쓴다. 어긋나면 위험하다.
    const mismatched = rows
      .filter((r) => r.badge !== badgeOf(BODIES.get(r.adr) ?? ''))
      .map((r) => `ADR-${r.adr}: 인덱스 ${r.badge} · 파일 ${badgeOf(BODIES.get(r.adr) ?? '')}`)

    expect(mismatched).toEqual([])
  })

  it('머리말의 집계가 표와 맞는다', () => {
    const line = /^총 (\d+)건 — 🟢 (\d+) · 🟡 (\d+) · ⛔ (\d+) · ⚪ (\d+) · 🗑 (\d+)$/m.exec(
      readFileSync(INDEX, 'utf8'),
    )
    expect(line).not.toBeNull()

    const count = (badge: string) => rows.filter((r) => r.badge === badge).length
    expect(line!.slice(1).map(Number)).toEqual([
      rows.length,
      count('🟢'),
      count('🟡'),
      count('⛔'),
      count('⚪'),
      count('🗑'),
    ])
  })
})
