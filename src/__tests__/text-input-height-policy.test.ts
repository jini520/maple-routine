// 치는 칸은 자기 높이를 갖는다.
//
// RN 의 `TextInput` 은 높이를 **내용에서 잰다**. iOS 는 담은 글자의 종류대로 키를 재고
// (한글과 영문이 다르다) `lineHeight` 는 그 계산에 안 쓴다. 높이를 안 주면 무엇을 치느냐에 따라
// 상자가 바뀌고, 시트처럼 내용 높이를 다시 재는 구조에서는 그 흔들림이 화면 전체로 퍼진다.
//
// 이 규칙은 설계 문서에 글로만 있었고, 그래서 고침이 두 번에 걸쳐 조용히 걷혔다. 여기서 막는다.
//
// 높이가 **있는지만** 본다. 그 수가 줄 높이와 맞는지는 안 본다. 맞추는 산수를 여기 또 적으면
// 계단표(`typography.cjs`)와 두 벌이 되고, 안 맞는 수는 글자가 잘려 화면에서 바로 보인다.
// 안 보이는 실패는 `아무도 높이를 안 줬다` 쪽이다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..')

/**
 * 아톰과 molecule 의 **정의 파일**. JSDoc 의 `@example` 이 칸을 그려서 스캐너에 잡힌다.
 * 부품 자신은 치수를 안 정한다(호출부가 정한다).
 */
const DEFINITIONS = new Set([
  join(SRC, 'components', 'atoms', 'TextInput', 'TextInput.tsx'),
  join(SRC, 'components', 'molecules', 'SheetTextInput', 'SheetTextInput.tsx'),
])

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx$/.test(entry) && !DEFINITIONS.has(path) ? [path] : []
  })
}

/** 여는 태그부터 자기를 닫는 `/>` 까지. 칸은 언제나 자식이 없다. */
const FIELD = /<(?:Sheet)?TextInput\b[\s\S]*?\/>/g

/** `h-5` · `h-[38px]`. 앞 글자를 보는 것은 `min-h-7` 을 높이로 안 읽으려는 것이다. */
const HEIGHT = /(?<![-\w])h-(?:\d+(?:\.\d+)?|\[\d+px\])/

describe('치는 칸은 자기 높이를 갖는다', () => {
  const files = sourceFiles(SRC)

  it('훑을 파일이 있다. 스캐너가 빈손이면 아래 단언이 무의미하다', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('칸을 찾아낸다. 정규식이 빗나가면 아래 단언이 무의미하다', () => {
    const 칸수 = files.reduce(
      (sum, file) => sum + (readFileSync(file, 'utf8').match(FIELD)?.length ?? 0),
      0,
    )

    expect(칸수).toBeGreaterThanOrEqual(11)
  })

  it('모든 칸의 `className` 에 높이가 있다', () => {
    const 없는칸 = files.flatMap((file) => {
      const body = readFileSync(file, 'utf8')
      return [...body.matchAll(FIELD)]
        .filter((match) => !HEIGHT.test(match[0]))
        .map((match) => {
          const line = body.slice(0, match.index).split('\n').length
          return `${file.slice(SRC.length + 1)}:${line}`
        })
    })

    expect(없는칸).toEqual([])
  })
})
