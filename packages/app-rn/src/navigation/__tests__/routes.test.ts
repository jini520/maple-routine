// 라우트 표가 계획서 §1 과 어긋나지 않는지 본다. **화면 동작이 아니라 목록의 완전성**이 대상이다 —
// 실제로 열리는지는 `RootNavigator.test.tsx` 가 본다.
//
// 이 파일이 있는 이유는 하나다: 계획서(`docs/migration/parity-inventory.md` §1)와 코드가 두 벌이면
// 하나를 빠뜨려도 아무 데서도 안 드러난다. 여기 적힌 17개 경로 문자열이 그 대조판이고, 화면이 늘면
// 계획서·`routes.ts`·이 목록이 **함께** 움직여야 한다.
import {
  FEATURE_GUIDE_ROUTE_NAMES,
  INITIAL_TAB_ROUTE,
  ROUTE_TABLE,
  STACK_ROUTE_NAMES,
  TAB_ITEMS,
} from '../routes'

/**
 * `docs/migration/parity-inventory.md` §1 의 첫 열, 순서 그대로.
 *
 * `/settings/about/privacy` 만 계획서 표의 `/settings/privacy` 와 다르다 — 계획서 쪽이 낡았고
 * ([[ADR-120]] 결정 11 이 구현 중에 `about` 의 자식으로 정정했다) 이 커밋에서 함께 고쳤다.
 */
const PARITY_PATHS = [
  '/',
  '/onboarding',
  '/content',
  '/content/manage',
  '/boss',
  '/boss/manage',
  '/profit',
  '/profit/drops',
  '/profit/prices',
  '/settings',
  '/settings/guide',
  '/settings/guide/:guideId',
  '/settings/release-notes',
  '/settings/release-notes/:guideId',
  '/settings/account-data',
  '/settings/about',
  '/settings/about/privacy',
]

describe('ROUTE_TABLE — 계획서 §1 대조', () => {
  it('17개 경로를 하나도 빠뜨리지 않고 순서까지 같다', () => {
    expect(ROUTE_TABLE.map((row) => row.path)).toEqual(PARITY_PATHS)
  })

  it('경로가 중복되지 않는다', () => {
    expect(new Set(PARITY_PATHS).size).toBe(PARITY_PATHS.length)
  })

  // 웹의 `/` 는 리디렉트였다. RN 에는 URL 이 없으므로 그 자리는 "처음 서 있는 탭"이고, 그 탭은
  // `/content` 여야 한다 — 리디렉트 목적지와 같은 화면이다.
  it('`/` 는 컨텐츠 탭에 서는 것으로 대응된다', () => {
    const root = ROUTE_TABLE.find((row) => row.path === '/')

    expect(root?.target).toEqual({ kind: 'initial', route: 'Content' })
    expect(INITIAL_TAB_ROUTE).toBe('Content')
    expect(root?.screen).toBe(
      ROUTE_TABLE.find((row) => row.path === '/content')?.screen,
    )
  })

  it('탭은 넷이고 라벨은 웹 TAB_ITEMS 와 같다', () => {
    expect(TAB_ITEMS).toEqual([
      { route: 'Content', label: '컨텐츠' },
      { route: 'Boss', label: '보스' },
      { route: 'Profit', label: '수익' },
      { route: 'Settings', label: '설정' },
    ])

    expect(ROUTE_TABLE.flatMap((row) => (row.target.kind === 'tab' ? [row.target.route] : []))).toEqual(
      TAB_ITEMS.map((tab) => tab.route),
    )
  })

  it('하위 페이지는 열하나이고 이름이 겹치지 않는다', () => {
    expect(STACK_ROUTE_NAMES).toEqual([
      'ContentManage',
      'BossManage',
      'DropHistory',
      'DropPrice',
      'SettingsFeatureGuideList',
      'SettingsFeatureGuide',
      'SettingsReleaseNotes',
      'SettingsReleaseNoteGuide',
      'SettingsAccountData',
      'SettingsAbout',
      'SettingsPrivacy',
    ])
    expect(new Set(STACK_ROUTE_NAMES).size).toBe(STACK_ROUTE_NAMES.length)
  })

  it('온보딩은 탭도 하위 페이지도 아닌 루트 화면이다', () => {
    const onboarding = ROUTE_TABLE.filter((row) => row.target.kind === 'root')

    expect(onboarding).toHaveLength(1)
    expect(onboarding[0]?.path).toBe('/onboarding')
  })
})

// [[ADR-125]] 결정 3 — 기능 설명 목록에서도, 개발 노트 항목에서도 **같은 상세**가 열린다.
// 웹에서 경로를 둘로 둔 이유(`resolveStackDirection` 이 형제 이동을 `replace` 로 떨어뜨려 전환이
// 사라진다)는 RN 에 없지만, **화면과 데이터가 한 벌이라는 계약은 그대로**다.
describe('안내 상세는 두 경로가 같은 화면을 가리킨다 ([[ADR-125]] 결정 3)', () => {
  const guideRows = ROUTE_TABLE.filter((row) =>
    row.path.endsWith('/:guideId'),
  )

  it('상세로 가는 경로가 정확히 둘이다', () => {
    expect(guideRows.map((row) => row.path)).toEqual([
      '/settings/guide/:guideId',
      '/settings/release-notes/:guideId',
    ])
  })

  it('둘의 `screen` 이 같다 — 사본이 아니라 한 벌이다', () => {
    expect(guideRows.map((row) => row.screen)).toEqual([
      'SettingsFeatureGuideScreen',
      'SettingsFeatureGuideScreen',
    ])
  })

  // 라우트 **이름**은 갈린다(부모가 다르므로 pop 목적지도 다르다). 갈리는 것은 이름뿐이라는 것을
  // 고정해 둔다 — 나중에 하나로 합치면 어느 목록으로 돌아갈지가 사라진다.
  it('라우트 이름은 둘이고 표의 두 행과 일치한다', () => {
    expect(FEATURE_GUIDE_ROUTE_NAMES).toEqual([
      'SettingsFeatureGuide',
      'SettingsReleaseNoteGuide',
    ])
    expect(guideRows.map((row) => row.target.route)).toEqual([...FEATURE_GUIDE_ROUTE_NAMES])
  })
})
