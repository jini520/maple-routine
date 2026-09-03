// 배경 정책 가드.
//
// **배경은 벽지 한 장뿐이다.** 그리는 곳은 `ThemeBackdrop` 하나이고, 헤더는 자기 배경을 칠하지
// 않는다. 헤더 자리에 그림 조각을 따로 그리던 옛 배치는 **헤더가 불투명하고
// 화면에 고정돼 있다** 는 전제 위에 있었는데, 그 전제가 없어졌다.
//
// ## 왜 **없음** 을 테스트하나
//
// `sticky-policy.test.ts` 와 같은 부류다. 이 결정이 만드는 것은 코드가 아니라 **코드의 부재**라,
// 회귀는 **깨지는** 모양이 아니라 **슬그머니 되살아나는** 모양으로 온다. 누군가 헤더가 비쳐 보이는
// 게 어색해서 `bg-bg` 를 한 줄 넣으면 벽지 위에 검은 띠가 돌아오고, 그게 **정확히 이 문서가
// 걷어낸 상태**다(헤더 넷 중 둘만 그림을 이어 붙이던 그 상태).
//
// ## 무엇을 잡나
//
// - `ThemeHeaderBackdrop`. 삭제한 조각. 이름이 되살아나면 두 번째 그리는 곳이 생긴 것이다
// - `z-10 bg-bg`. 헤더 넷이 공유하던 셸 문자열. `bg-bg` 자체는 시트·에러 화면에서 정당하게
//   쓰이므로(그쪽은 벽지 위에 **떠 있는 판** 이다) 헤더 셸만 좁혀서 잡는다
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== '__tests__' && entry !== '__snapshots__') out.push(...sourceFiles(path))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

/** 주석은 대상이 아니다. 이 정책의 기록이 거기 산다(`sticky-policy.test.ts` 와 같은 판단). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

const FORBIDDEN: Array<{ pattern: RegExp; what: string }> = [
  { pattern: /\bThemeHeaderBackdrop\b/, what: '헤더 그림 조각' },
  { pattern: /z-10 bg-bg/, what: '헤더 셸의 불투명 배경' },
]

describe(' 배경은 벽지 한 장뿐이다', () => {
  const files = sourceFiles(SRC)

  it('검사 대상 파일을 실제로 찾는다', () => {
    // 경로가 틀려 0개를 훑고도 초록이 되는 것이 이 부류 가드의 흔한 실패다.
    expect(files.length).toBeGreaterThan(50)
  })

  it.each(FORBIDDEN)('$what 이 코드에 없다', ({ pattern }) => {
    const offenders = files.filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))

    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([])
  })

  // 걷어내기만 하고 끝나면 배경이 아예 없어진다. 남는 한 장이 실제로 남아 있는지 함께 본다.
  it('벽지를 그리는 곳은 여전히 하나 있다', () => {
    const drawers = files.filter((file) =>
      /theme-backdrop["']/.test(stripComments(readFileSync(file, 'utf8'))),
    )

    expect(drawers.map((f) => f.slice(SRC.length + 1))).toEqual([
      'components/templates/ThemeBackdrop/ThemeBackdrop.tsx',
    ])
  })
})
