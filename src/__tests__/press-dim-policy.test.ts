// 앱의 어떤 것도 누르는 동안 흐려지지 않는다(사용자 지정). 새로 만든 화면도 걸리게 `src/` 전체를 본다.
// NativeWind 가 렌더 뒤 `className` 을 지워 렌더 결과로는 물을 수 없어서 소스로 묻는다.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..')

/** 누르는 동안 흐려지게 하는 이름. NativeWind 클래스 · 흐려지는 RN 버튼 · 그 버튼의 흐림 값 */
const DIM_NAMES = ['active:opacity', 'TouchableOpacity', 'activeOpacity']

/** 테스트 · 목 · fixture 를 뺀 `src/` 의 소스 파일. 이 파일도 금지 이름을 적고 있어 빠져야 한다 */
const SOURCES = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter(
  (path) => /\.tsx?$/.test(path) && !/(^|\/)__(tests|mocks|fixtures)__\//.test(path),
)

describe('누름 표시', () => {
  it('앱의 소스에 누르는 동안 흐려지게 하는 코드가 없다', () => {
    const found = SOURCES.flatMap((path) => {
      const source = readFileSync(join(SRC, path), 'utf8')
      return DIM_NAMES.filter((name) => source.includes(name)).map((name) => `${path} → ${name}`)
    })

    expect(found).toEqual([])
  })
})
