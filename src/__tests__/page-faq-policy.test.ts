// 진입 뒤의 모든 화면과 로그인 화면에 FAQ 입구를 둔다. 문항이 아직 없는 화면도 미리 달고, 서버에 문항이 생기면 그때 보인다.
// 그래서 새 화면을 만들고 입구를 빠뜨리면 여기서 걸린다.
// 렌더로 물으려면 화면마다 저장소와 쿼리를 다 세워야 해서 소스로 묻는다.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP = join(__dirname, '..', 'app')

/** 진입 전 화면 가운데 입구 자리를 아직 정하지 않은 것. */
const BEFORE_ENTRY = new Set(['character-setup/CharacterSetupScreen.tsx'])

const SCREENS = readdirSync(APP, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('Screen.tsx') && !path.includes('__tests__') && !BEFORE_ENTRY.has(path))
  .sort()

describe('페이지 FAQ', () => {
  it('진입 뒤의 화면을 찾는다', () => {
    expect(SCREENS.length).toBeGreaterThanOrEqual(30)
  })

  it.each(SCREENS.map((name) => ({ name, source: readFileSync(join(APP, name), 'utf8') })))(
    '$name 에 FAQ 입구가 있다',
    ({ source }) => {
      expect(source).toContain('<FaqButton')
      expect(source).toMatch(/useFaqSheet\(/)
    },
  )
})
