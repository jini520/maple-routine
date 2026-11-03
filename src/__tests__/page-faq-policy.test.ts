// 모든 페이지에 FAQ 를 두고, 머리 제목 옆의 `FaqButton` 이 그 화면의 FAQ 시트를 연다.
// 문항이 정해진 화면부터 넣고 있어서, 넣은 화면을 아래 목록에 더해 간다.
// 렌더로 물으려면 화면마다 저장소와 쿼리를 다 세워야 해서 소스로 묻는다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP = join(__dirname, '..', 'app')

const SCREENS = [
  join(APP, 'today', 'TodayScreen.tsx'),
  join(APP, 'party-appointments', 'AppointmentsScreen.tsx'),
  join(APP, 'content-scheduler', 'ContentScreen.tsx'),
  join(APP, 'content-scheduler', 'ContentManageScreen.tsx'),
  join(APP, 'boss-scheduler', 'BossScreen.tsx'),
  join(APP, 'boss-scheduler', 'BossManageScreen.tsx'),
]

describe('페이지 FAQ', () => {
  it.each(SCREENS.map((path) => ({ name: path.slice(APP.length + 1), source: readFileSync(path, 'utf8') })))(
    '$name 의 머리에 FAQ 물음표가 있다',
    ({ source }) => {
      expect(source).toContain('<FaqButton')
    },
  )
})
