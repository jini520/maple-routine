// 주석 문체 가드.
//
// 장식 기호는 한 번 걷어도 다음 세션이 다시 들인다. 문서에만 적힌 규칙은 그렇게 썩는다.
// 여기서 세 가지를 못박는다.
//
//   1. `«»` 를 안 쓴다. 볼드가 그 자리다.
//   2. `「」` 를 안 쓴다. 백틱이 그 자리다.
//   3. `—` 를 문장을 끊거나 괄호로 쓰지 않는다. 마침표나 쌍점이 그 자리다.
//
// 셋째만 예외가 있다. 아래 `DASH_ALLOWED` 를 볼 것.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..')

/**
 * `—` 가 남아도 되는 자리.
 *
 * 문장을 끊는 쓰임이 아니라서 규칙 밖이다. 새로 더할 때는 **왜 문장이 아닌지**를 함께 적을 것.
 */
const DASH_ALLOWED: ReadonlyArray<{ file: string; why: string }> = [
  {
    file: '__tests__/adr-citation-policy.test.ts',
    why: '`docs/ADR.md` 집계 줄을 글자 그대로 무는 정규식이다. 주석이 아니라 코드다',
  },
  {
    file: 'lib/boss/boss-profit-period.ts',
    why: '표의 빈 칸(`| — |`)이라 「해당 없음」 이지 문장을 끊는 것이 아니다',
  },
]

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

/** 이 파일은 기호를 **검사 대상으로** 들고 있어야 해서 스스로를 뺀다. */
const SELF = join('__tests__', 'comment-style-policy.test.ts')

const FILES = sourceFiles(SRC).filter((f) => f.slice(SRC.length + 1) !== SELF)

function offenders(mark: RegExp, allow: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = []
  for (const file of FILES) {
    const rel = file.slice(SRC.length + 1)
    if (allow.has(rel)) continue
    for (const [i, line] of readFileSync(file, 'utf8').split('\n').entries()) {
      if (mark.test(line)) out.push(`${rel}:${i + 1}: ${line.trim().slice(0, 60)}`)
    }
  }
  return out
}

describe('주석 문체', () => {
  it('훑을 것을 실제로 찾았다', () => {
    expect(FILES.length).toBeGreaterThan(600)
  })

  it('`«»` 를 쓰지 않는다', () => {
    expect(offenders(/[«»]/)).toEqual([])
  })

  it('`「」` 를 쓰지 않는다', () => {
    expect(offenders(/[「」]/)).toEqual([])
  })

  it('`—` 는 정해진 두 자리에만 남는다', () => {
    const allow = new Set(DASH_ALLOWED.map((a) => a.file))
    expect(offenders(/—/, allow)).toEqual([])
  })

  it('파일 머리 주석은 JSDoc 이다', () => {
    // `//` 는 선언에 안 붙어서 호출부에서 마우스를 올려도 안 보인다. `/** */` 는 붙는다.
    // 머리 주석이 아예 없는 파일은 규칙 밖이다. 테스트 파일도 뺀다.
    const slash: string[] = []
    for (const file of FILES) {
      if (file.includes('__tests__')) continue
      const first = readFileSync(file, 'utf8')
        .split('\n')
        .find((l) => l.trim() !== '')
      if (first?.trim().startsWith('//') === true) slash.push(file.slice(SRC.length + 1))
    }

    expect(slash).toEqual([])
  })

  it('허용 목록이 낡지 않았다', () => {
    // 그 파일에서 `—` 가 사라졌으면 목록에서도 빼야 한다. 안 그러면 예외가 조용히 쌓인다.
    const stale = DASH_ALLOWED.filter((a) => !readFileSync(join(SRC, a.file), 'utf8').includes('—'))

    expect(stale.map((s) => s.file)).toEqual([])
  })
})
