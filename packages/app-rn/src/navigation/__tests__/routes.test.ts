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
  TAB_ROUTE_NAMES,
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
  // **`origin` 으로 갈라 본다**([[ADR-132]] 결정 1). RN 에서 새로 생긴 화면 넷은 웹에 없으므로 이
  // 대조에 섞이면 안 된다 — 섞으면 «계획서와 같은가» 라는 이 테스트의 질문이 답할 수 없는 것이 된다.
  it('웹에서 온 17개 경로를 하나도 빠뜨리지 않고 순서까지 같다', () => {
    expect(ROUTE_TABLE.filter((row) => row.origin === 'web').map((row) => row.path)).toEqual(
      PARITY_PATHS,
    )
  })

  it('경로가 중복되지 않는다', () => {
    const paths = ROUTE_TABLE.map((row) => row.path)

    expect(new Set(paths).size).toBe(paths.length)
  })

  // 넷은 [[ADR-132]] 결정 1 의 탭이고, 다섯째는 [[ADR-144]] 결정 1 의 하위 페이지다 — 웹뷰 앱에서
  // 같은 일을 하는 것이 **모달**이라 대조할 경로가 없다(그래서 `web` 이 아니라 `rn` 이다).
  it('RN 에서 새로 생긴 화면은 다섯이고 넷은 탭·하나는 하위 페이지다', () => {
    const rnRows = ROUTE_TABLE.filter((row) => row.origin === 'rn')

    expect(rnRows.map((row) => row.target)).toEqual([
      { kind: 'tab', route: 'Today' },
      { kind: 'tab', route: 'HuntingProfit' },
      { kind: 'tab', route: 'Spend' },
      { kind: 'tab', route: 'Utility' },
      { kind: 'push', route: 'SettingsCharacters' },
    ])
  })

  // **`/` 행과 첫 화면이 갈렸다**([[ADR-132]] 결정 7). `/` 행은 *"웹이 그 경로에서 무엇을 보여
  // 줬는가"* 라는 기록이라 그대로 컨텐츠이고, *"이 앱이 어디서 시작하는가"* 는 새 `today` 다.
  // 한쪽만 고치면 이 테스트가 운다 — 갈린 것 자체가 결정이므로 둘을 함께 고정한다.
  it('`/` 행은 웹 기록이라 컨텐츠 그대로다', () => {
    const root = ROUTE_TABLE.find((row) => row.path === '/')

    expect(root?.target).toEqual({ kind: 'initial', route: 'Content' })
    expect(root?.screen).toBe(ROUTE_TABLE.find((row) => row.path === '/content')?.screen)
  })

  it('첫 화면은 `/` 가 아니라 today 다', () => {
    expect(INITIAL_TAB_ROUTE).toBe('Today')
    expect(ROUTE_TABLE.find((row) => row.target.kind === 'tab' && row.target.route === 'Today')).toBeDefined()
  })

  // 라벨은 여기 없다 — 바가 라벨을 두 층에서 쓰므로 `bar-model.ts` 의 `BAR_GROUPS` 가 갖는다
  // ([[ADR-132]] 결정 1). 그 표와 이 목록이 같은 집합인지는 `bar-model.test.ts` 가 본다.
  it('탭 화면은 아홉이고 표에서 파생된다', () => {
    expect(TAB_ROUTE_NAMES).toEqual([
      'Content',
      'Boss',
      // 웹에서는 `/boss` 위로 밀려 올라오던 하위 페이지다([[ADR-145]] 결정 1) — RN 에서만 형제 탭이라
      // 이 목록에 웹 경로가 하나 더 든다.
      'BossManage',
      'Profit',
      'Settings',
      'Today',
      'HuntingProfit',
      'Spend',
      'Utility',
    ])
    expect(new Set(TAB_ROUTE_NAMES).size).toBe(TAB_ROUTE_NAMES.length)
  })

  // **웹 경로인데 탭인 행은 이것 하나다**([[ADR-145]] 결정 1). 나머지 `/…/…` 경로는 전부 push 이므로,
  // 이 예외가 조용히 늘어나면(= 다른 하위 페이지도 탭이 되면) 여기서 드러난다.
  it('웹의 하위 경로 중 탭이 된 것은 보스 관리 하나다', () => {
    const promoted = ROUTE_TABLE.filter(
      (row) => row.origin === 'web' && row.path.split('/').length > 2 && row.target.kind === 'tab',
    )

    expect(promoted.map((row) => row.path)).toEqual(['/boss/manage'])
    expect(promoted[0]?.target).toEqual({ kind: 'tab', route: 'BossManage' })
  })

  it('하위 페이지는 열하나이고 이름이 겹치지 않는다', () => {
    expect(STACK_ROUTE_NAMES).toEqual([
      'ContentManage',
      'DropHistory',
      'DropPrice',
      'SettingsFeatureGuideList',
      'SettingsFeatureGuide',
      'SettingsReleaseNotes',
      'SettingsReleaseNoteGuide',
      'SettingsAccountData',
      'SettingsAbout',
      'SettingsPrivacy',
      // 웹에 짝이 없다([[ADR-144]] 결정 1) — 그쪽에서는 설정의 모달이다.
      'SettingsCharacters',
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
