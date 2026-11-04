// 모든 화면에 FAQ 입구를 둔다. 진입 뒤는 머리 물음표, 진입 전은 글자 버튼이다. 문항이 아직 없는 화면도 미리 달고,
// 서버에 문항이 생기면 그때 보인다. 그래서 새 화면을 만들고 입구를 빠뜨리면 여기서 걸린다.
// 렌더로 물으려면 화면마다 저장소와 쿼리를 다 세워야 해서 소스로 묻는다.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP = join(__dirname, '..', 'app')

/** 화면을 내보내는 줄. 한 파일이 화면을 여럿 내보낼 수 있다(MVP 온보딩 둘). */
const SCREEN_EXPORT = /export function \w+Screen\(/g

const FILES = readdirSync(APP, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.tsx') && !path.includes('__tests__'))
  .map((name) => {
    const source = readFileSync(join(APP, name), 'utf8')
    return { name, source, screens: source.match(SCREEN_EXPORT)?.length ?? 0 }
  })
  .filter((file) => file.screens > 0)
  .sort((a, b) => a.name.localeCompare(b.name))

describe('페이지 FAQ', () => {
  it('화면을 찾는다', () => {
    expect(FILES.reduce((sum, file) => sum + file.screens, 0)).toBeGreaterThanOrEqual(34)
  })

  it.each(FILES)('$name 의 화면마다 FAQ 입구가 있다', ({ source, screens }) => {
    expect(source).toContain('<FaqButton')
    expect(source.match(/useFaqSheet\(/g)?.length ?? 0).toBeGreaterThanOrEqual(screens)
  })
})
