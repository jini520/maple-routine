/**
 * 라우트 표 — `docs/migration/parity-inventory.md` §1 을 **데이터로** 옮긴 것([[ADR-128]] 3단계).
 *
 * ## 왜 표를 코드에 두는가
 *
 * 내비게이터를 손으로 적으면 계획서의 17행과 실제 화면 목록이 **두 벌**이 되고, 하나를 빠뜨려도
 * 아무 데서도 안 드러난다. 그래서 `RootNavigator` 는 이 표에서 파생된 이름 목록으로 화면을 그리고,
 * 테스트는 표가 17행인지 · 그 이름들이 실제로 열리는지를 함께 본다.
 *
 * `path` 는 RN 에서 **쓰이지 않는다**(딥링크 설정을 두지 않았다 — 아래). 남겨 두는 이유는 대조를
 * 위해서다: 웹 앱과 나란히 두고 "이 경로가 어디로 갔나"를 물을 수 있어야 하고, 그 대조가 전환 기간
 * 내내 필요하다(`docs/migration/README.md` «잃는 안전망» — 예전과의 비교는 사람이 한다).
 *
 * **딥링크(`linking`)는 두지 않는다.** 지금 앱에는 딥링크가 없고(웹뷰는 `https://localhost` 로만
 * 돈다), 설정을 두면 이 표가 문서에서 **동작**으로 바뀌어 없던 진입 경로가 생긴다. [[ADR-120]] 결정 9
 * 가 다루는 *"딥링크로 하위 페이지에 직접 들어와 되돌아갈 곳이 없는 경우"* 도 그래서 RN 에는 아직
 * 존재하지 않는다 — 스택은 언제나 우리가 push 한 만큼만 깊다.
 */

import type { NavigatorScreenParams } from '@react-navigation/native'

/** 탭 넷. 순서가 곧 탭바 순서다(`App.tsx` 의 `TAB_ITEMS` 와 같은 순서). */
export type TabRouteName = 'Content' | 'Boss' | 'Profit' | 'Settings'

export type TabParamList = {
  Content: undefined
  Boss: undefined
  Profit: undefined
  Settings: undefined
}

/**
 * 기능 안내 상세가 받는 파라미터.
 *
 * `section` 은 웹의 `?s=` 다([[ADR-125]] 결정 7) — 그쪽이 세그먼트가 아니라 쿼리인 이유는
 * `resolveStackDirection` 이 세그먼트를 스택 한 단으로 읽기 때문이었고, RN 에는 그 판정 자체가 없어
 * (push 는 우리가 명시한다) 그냥 파라미터 하나다.
 */
export interface FeatureGuideParams {
  guideId: string
  section?: string
}

export type RootStackParamList = {
  Onboarding: undefined
  Tabs: NavigatorScreenParams<TabParamList> | undefined
  ContentManage: undefined
  BossManage: undefined
  DropHistory: undefined
  DropPrice: undefined
  SettingsFeatureGuideList: undefined
  SettingsFeatureGuide: FeatureGuideParams
  SettingsReleaseNotes: undefined
  SettingsReleaseNoteGuide: FeatureGuideParams
  SettingsAccountData: undefined
  SettingsAbout: undefined
  SettingsPrivacy: undefined
}

export type StackRouteName = Exclude<keyof RootStackParamList, 'Onboarding' | 'Tabs'>

/**
 * 한 경로가 RN 의 어느 자리로 갔는가.
 *
 * - `initial` — 웹의 `/` 리디렉트. RN 에는 URL 이 없으므로 *"처음 서 있는 탭"* 이 그 자리다.
 * - `root` — 루트 스택의 화면이되 탭이 아닌 것(온보딩). 탭과 **배타**로 그려진다(아래).
 * - `tab` — 탭 넷.
 * - `push` — 탭 위로 밀려 들어오는 하위 페이지. 루트 스택에 쌓인다([[ADR-120]] 결정 4).
 */
export type RouteTarget =
  | { readonly kind: 'initial'; readonly route: TabRouteName }
  | { readonly kind: 'root'; readonly route: 'Onboarding' }
  | { readonly kind: 'tab'; readonly route: TabRouteName }
  | { readonly kind: 'push'; readonly route: StackRouteName }

export interface RouteRow {
  /** 웹(react-router) 경로 — parity-inventory §1 의 첫 열. */
  readonly path: string
  /** 그 경로가 그리던 화면 — parity-inventory §1 의 둘째 열. **두 행이 같은 값을 가질 수 있다.** */
  readonly screen: string
  readonly target: RouteTarget
}

/**
 * 17행. **행 수와 내용을 테스트가 고정한다** — 화면이 늘면 계획서와 여기가 함께 움직여야 한다.
 *
 * `/settings/about/privacy` 가 계획서 표(`/settings/privacy`)와 다른 것은 **계획서 쪽이 낡았기
 * 때문**이다. [[ADR-120]] 결정 11 이 구현 중에 경로를 `about` 의 **자식**으로 정정했고
 * (`/settings/privacy` 로 두면 about 이 즉시 사라진 자리에 처방침이 밀려 들어와 밀려 나가는 화면
 * 없이 배경만 바뀌는 프레임이 보인다), `app-capacitor` 의 라우트도 그렇게 되어 있다. 이 앱에서
 * 유일하게 2단인 스택이다. 계획서 표도 함께 고쳤다.
 */
export const ROUTE_TABLE: readonly RouteRow[] = [
  { path: '/', screen: 'ContentScreen', target: { kind: 'initial', route: 'Content' } },
  { path: '/onboarding', screen: 'OnboardingScreen', target: { kind: 'root', route: 'Onboarding' } },

  { path: '/content', screen: 'ContentScreen', target: { kind: 'tab', route: 'Content' } },
  {
    path: '/content/manage',
    screen: 'ContentManageScreen',
    target: { kind: 'push', route: 'ContentManage' },
  },

  { path: '/boss', screen: 'BossScreen', target: { kind: 'tab', route: 'Boss' } },
  { path: '/boss/manage', screen: 'BossManageScreen', target: { kind: 'push', route: 'BossManage' } },

  { path: '/profit', screen: 'BossProfitScreen', target: { kind: 'tab', route: 'Profit' } },
  { path: '/profit/drops', screen: 'DropHistoryScreen', target: { kind: 'push', route: 'DropHistory' } },
  { path: '/profit/prices', screen: 'DropPriceScreen', target: { kind: 'push', route: 'DropPrice' } },

  { path: '/settings', screen: 'SettingsScreen', target: { kind: 'tab', route: 'Settings' } },
  {
    path: '/settings/guide',
    screen: 'SettingsFeatureGuideListScreen',
    target: { kind: 'push', route: 'SettingsFeatureGuideList' },
  },
  // 아래 둘이 **같은 `screen` 값을 갖는 것이 계약이다**([[ADR-125]] 결정 3) — 기능 설명 목록에서도,
  // 개발 노트 항목에서도 같은 상세가 열린다. 화면과 데이터는 한 벌이고 경로만 둘이다.
  {
    path: '/settings/guide/:guideId',
    screen: 'SettingsFeatureGuideScreen',
    target: { kind: 'push', route: 'SettingsFeatureGuide' },
  },
  {
    path: '/settings/release-notes',
    screen: 'SettingsReleaseNotesScreen',
    target: { kind: 'push', route: 'SettingsReleaseNotes' },
  },
  {
    path: '/settings/release-notes/:guideId',
    screen: 'SettingsFeatureGuideScreen',
    target: { kind: 'push', route: 'SettingsReleaseNoteGuide' },
  },
  {
    path: '/settings/account-data',
    screen: 'SettingsAccountDataScreen',
    target: { kind: 'push', route: 'SettingsAccountData' },
  },
  { path: '/settings/about', screen: 'SettingsAboutScreen', target: { kind: 'push', route: 'SettingsAbout' } },
  {
    path: '/settings/about/privacy',
    screen: 'SettingsPrivacyScreen',
    target: { kind: 'push', route: 'SettingsPrivacy' },
  },
]

/** 하위 페이지 이름 — `RootNavigator` 가 이 목록으로 `<Stack.Screen>` 을 그린다. */
export const STACK_ROUTE_NAMES: readonly StackRouteName[] = ROUTE_TABLE.flatMap((row) =>
  row.target.kind === 'push' ? [row.target.route] : [],
)

/** 기능 안내 상세를 가리키는 두 라우트 — 같은 컴포넌트가 그린다([[ADR-125]] 결정 3). */
export const FEATURE_GUIDE_ROUTE_NAMES = [
  'SettingsFeatureGuide',
  'SettingsReleaseNoteGuide',
] as const satisfies readonly StackRouteName[]

export interface TabItem {
  readonly route: TabRouteName
  /** 탭바 라벨 — 웹 `TAB_ITEMS` 와 같은 문구다. */
  readonly label: string
}

/**
 * 탭 넷과 라벨.
 *
 * **아이콘은 아직 없다.** 웹의 셋은 lucide 이고 수익 하나는 커스텀 SVG(`ProfitIcon`, [[ADR-066]])라
 * atoms 를 옮기는 단계의 몫이다 — 여기서 임시 아이콘을 넣으면 그 단계에 버려질 뿐 아니라, 도메인
 * 아이덴티티를 임의로 고른 그림으로 대체하는 것이 된다([[ADR-066]] 이 명시적으로 금지한 방향).
 */
export const TAB_ITEMS: readonly TabItem[] = [
  { route: 'Content', label: '컨텐츠' },
  { route: 'Boss', label: '보스' },
  { route: 'Profit', label: '수익' },
  { route: 'Settings', label: '설정' },
]

/** 처음 서 있는 탭 — 웹의 `/` → `/content` 리디렉트 자리. */
export const INITIAL_TAB_ROUTE: TabRouteName = 'Content'
