// 스케줄러 두 화면의 레일 아래 간격 가드.
//
// 여백이 `CharacterRail` 안이 아니라 **감싸는 뷰**에 있다. 같은 레일이 관리 화면 둘에도 서고 그
// 두 화면은 레일 아래가 카드가 아니라서다. 감싸는 뷰라는 자리는 눈에 안 띄므로, 다음 사람이
// 레일만 옮기고 감싸개를 두고 가면 한 화면에서만 간격이 사라진다.
//
// 조건도 함께 본다. 감싸개에 레일과 같은 조건이 안 걸리면 캐릭터가 없는 첫 조회에서 빈 여백이
// 남는다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP = join(__dirname, '..', 'app')

const SCREENS = [
  join(APP, 'content-scheduler', 'ContentScreen.tsx'),
  join(APP, 'boss-scheduler', 'BossScreen.tsx'),
]

// **여백 클래스를 대괄호 임의값 꼴 정규식으로 찾지 말 것.** Tailwind 의 스캔 범위가
// `./src/**/*.{ts,tsx}` 라 테스트 파일도 훑는다. `pb` + `-` + 대괄호로 감싼 문자 클래스를 적으면
// 그것을 임의값 유틸리티로 읽어 값이 `\d.` 인 규칙을 만들고, 그 깨진 값이 번들을 통째로 못 쓰게
// 만든다(`Compiling JS failed: non-terminated string`). 그래서 대괄호 없이 숫자만 적는다.

/**
 * 레일을 감싼 뷰. 레일과 **같은 조건** 안에 있어야 하므로 조건까지 함께 본다.
 *
 * 주석이 조건과 감싸개 사이에 들어가므로 그 사이를 넉넉히 허용한다.
 */
const WRAPPED_RAIL =
  /characters\.length > 0 && selected !== null && \(\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<View className="(pb-\d(?:\.5)?)">\s*<CharacterRail/

describe('캐릭터 레일 아래 간격', () => {
  const found = SCREENS.map((path) => ({
    name: path.slice(APP.length + 1),
    gap: WRAPPED_RAIL.exec(readFileSync(path, 'utf8'))?.[1] ?? null,
  }))

  it.each(found)('$name 은 레일과 같은 조건 안에서 레일을 감싸 아래 여백을 준다', ({ gap }) => {
    expect(gap).not.toBeNull()
  })

  it('두 화면이 같은 값이다', () => {
    const values = new Set(found.map((one) => one.gap))
    expect(values.size).toBe(1)
    expect(values.has(null)).toBe(false)
  })
})

// 보스 스케줄러는 카드 앞에 무리 제목(`월간`)이 서고 컨텐츠 스케줄러는 바로 카드다. 그 제목이
// 차지하는 높이만큼 컨텐츠 쪽 카드 목록이 비워 둬야 두 화면을 오갈 때 첫 카드가 안 뛴다.
// 일간·주간 목록 둘 다 같은 값이어야 한다.
describe('컨텐츠 스케줄러의 첫 카드 자리', () => {
  const source = readFileSync(join(APP, 'content-scheduler', 'ContentScreen.tsx'), 'utf8')

  it('카드 목록 둘이 같은 위 여백을 든다', () => {
    const lists = [...source.matchAll(/className="gap-2([^"]*)"/g)].map(
      (match) => /\bpt-\d(?:\.5)?\b/.exec(match[1])?.[0] ?? null,
    )

    expect(lists).toHaveLength(2)
    expect(new Set(lists).size).toBe(1)
    expect(lists[0]).not.toBeNull()
  })
})
