// 진입 뒤의 모든 화면 머리에 FAQ 물음표를 둔다. 문항이 아직 없는 화면도 미리 달고, 서버에 문항이 생기면 그때 보인다.
// 그래서 새 화면을 만들고 물음표를 빠뜨리면 여기서 걸린다.
// 렌더로 물으려면 화면마다 저장소와 쿼리를 다 세워야 해서 소스로 묻는다.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP = join(__dirname, '..', 'app')

/** 진입 전 화면. FAQ 를 넣을지 아직 정하지 않았다. */
const BEFORE_ENTRY = new Set(['auth/SignInScreen.tsx', 'character-setup/CharacterSetupScreen.tsx'])

const SCREENS = readdirSync(APP, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('Screen.tsx') && !path.includes('__tests__') && !BEFORE_ENTRY.has(path))
  .sort()

describe('페이지 FAQ', () => {
  it('진입 뒤의 화면을 찾는다', () => {
    expect(SCREENS.length).toBeGreaterThanOrEqual(30)
  })

  it.each(SCREENS.map((name) => ({ name, source: readFileSync(join(APP, name), 'utf8') })))(
    '$name 의 머리에 FAQ 물음표가 있다',
    ({ source }) => {
      expect(source).toContain('<FaqButton')
      expect(source).toMatch(/useFaqSheet\(/)
    },
  )
})
