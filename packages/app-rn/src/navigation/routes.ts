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

/**
 * 탭 내비게이터의 화면 여덟 — **그룹이 아니라 페이지다**([[ADR-132]] 결정 1).
 *
 * 바에 보이는 «그룹»(스케줄·가계부…)은 내비게이션 구조가 아니라 **바의 표현**이라 여기 없다.
 * 그 묶음은 `bar-model.ts` 의 표가 갖는다. 중첩 내비게이터를 두지 않은 이유도 같다 — 하위 페이지들은
 * 서로 형제이고 전환에 스택도 애니메이션도 없다.
 *
 * 순서는 «그룹 순서 → 그룹 안 순서» 다. 바가 이 순서로 그리는 것은 아니지만(그건 `BAR_GROUPS`),
 * 표 둘이 같은 순서를 갖고 있으면 나중에 대조하기 쉽다.
 */
export type TabRouteName =
  | 'Today'
  | 'Content'
  | 'Boss'
  | 'Profit'
  | 'HuntingProfit'
  | 'Spend'
  | 'Utility'
  | 'Settings'

export type TabParamList = {
  Today: undefined
  Content: undefined
  Boss: undefined
  Profit: undefined
  HuntingProfit: undefined
  Spend: undefined
  Utility: undefined
  /**
   * `openPicker` 는 웹의 **`/boss?openPicker=1`** 이다 — 캐릭터 관리 피커를 **열어 둔 채로** 이 탭에
   * 보낸다. 보내는 쪽 셋: 보스 수익의 "캐릭터 선택하러 가기"([[ADR-068]] 결정 4)와 컨텐츠·보스
   * 스케줄러의 빈 상태 CTA.
   *
   * **받는 쪽이 `Boss` 에서 여기로 옮겨왔다**([[ADR-140]] 결정 1·2) — 피커를 여는 자리가 설정
   * 하나가 되면서 목적지도 함께 옮겼다. 열어 두고 보낸다는 계약 자체는 그대로다.
   *
   * URL 이 없어 "새로고침·뒤로가기마다 피커가 다시 열린다"는 웹의 걱정은 사라지지만 **파라미터는
   * 스택에 남는다** — 탭을 떠났다 돌아오면 그대로 살아 있으므로 화면이 `setParams` 로 지우는 일은
   * 그대로 필요하다(`SettingsScreen`).
   */
  Settings: { openPicker?: boolean } | undefined
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
  /**
   * 캐릭터 관리 — **웹에 없는 화면이다**([[ADR-144]] 결정 1). 웹뷰 앱에서는 모달이고, RN 에서는
   * 두 층 + 드롭다운 + 순서 + 대표가 385px 모달 본문에 안 들어가 하위 페이지가 됐다.
   */
  SettingsCharacters: undefined
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
  /** 웹(react-router) 경로 — parity-inventory §1 의 첫 열. `origin: 'rn'` 이면 웹에 없는 경로다(아래). */
  readonly path: string
  /** 그 경로가 그리던 화면 — parity-inventory §1 의 둘째 열. **두 행이 같은 값을 가질 수 있다.** */
  readonly screen: string
  readonly target: RouteTarget
  /**
   * 이 행이 **어디서 왔는가**([[ADR-132]] 결정 1).
   *
   * - `web` — 웹 앱에 실제로 있는 경로. 계획서 §1 과 대조되는 행이고 **17개로 고정**이다.
   * - `rn` — RN 에서 새로 생긴 화면. 웹에는 없다. `path` 는 그 화면이 웹 규칙대로였다면 가졌을
   *   경로이고 **대조가 아니라 이름표**다 — 이 값으로 계획서를 검사하지 말 것(테스트가 갈라 본다).
   */
  readonly origin: 'web' | 'rn'
}

/**
 * 웹 17행 + RN 5행. **행 수와 내용을 테스트가 고정한다** — 화면이 늘면 계획서와 여기가 함께 움직여야 한다.
 *
 * `/settings/about/privacy` 가 계획서 표(`/settings/privacy`)와 다른 것은 **계획서 쪽이 낡았기
 * 때문**이다. [[ADR-120]] 결정 11 이 구현 중에 경로를 `about` 의 **자식**으로 정정했고
 * (`/settings/privacy` 로 두면 about 이 즉시 사라진 자리에 처방침이 밀려 들어와 밀려 나가는 화면
 * 없이 배경만 바뀌는 프레임이 보인다), `app-capacitor` 의 라우트도 그렇게 되어 있다. 이 앱에서
 * 유일하게 2단인 스택이다. 계획서 표도 함께 고쳤다.
 */
export const ROUTE_TABLE: readonly RouteRow[] = [
  { path: '/', screen: 'ContentScreen', target: { kind: 'initial', route: 'Content' }, origin: 'web' },
  { path: '/onboarding', screen: 'OnboardingScreen', target: { kind: 'root', route: 'Onboarding' }, origin: 'web' },

  { path: '/content', screen: 'ContentScreen', target: { kind: 'tab', route: 'Content' }, origin: 'web' },
  {
    path: '/content/manage',
    screen: 'ContentManageScreen',
    target: { kind: 'push', route: 'ContentManage' },
    origin: 'web',
  },

  { path: '/boss', screen: 'BossScreen', target: { kind: 'tab', route: 'Boss' }, origin: 'web' },
  { path: '/boss/manage', screen: 'BossManageScreen', target: { kind: 'push', route: 'BossManage' }, origin: 'web' },

  { path: '/profit', screen: 'BossProfitScreen', target: { kind: 'tab', route: 'Profit' }, origin: 'web' },
  { path: '/profit/drops', screen: 'DropHistoryScreen', target: { kind: 'push', route: 'DropHistory' }, origin: 'web' },
  { path: '/profit/prices', screen: 'DropPriceScreen', target: { kind: 'push', route: 'DropPrice' }, origin: 'web' },

  { path: '/settings', screen: 'SettingsScreen', target: { kind: 'tab', route: 'Settings' }, origin: 'web' },
  {
    path: '/settings/guide',
    screen: 'SettingsFeatureGuideListScreen',
    target: { kind: 'push', route: 'SettingsFeatureGuideList' },
    origin: 'web',
  },
  // 아래 둘이 **같은 `screen` 값을 갖는 것이 계약이다**([[ADR-125]] 결정 3) — 기능 설명 목록에서도,
  // 개발 노트 항목에서도 같은 상세가 열린다. 화면과 데이터는 한 벌이고 경로만 둘이다.
  {
    path: '/settings/guide/:guideId',
    screen: 'SettingsFeatureGuideScreen',
    target: { kind: 'push', route: 'SettingsFeatureGuide' },
    origin: 'web',
  },
  {
    path: '/settings/release-notes',
    screen: 'SettingsReleaseNotesScreen',
    target: { kind: 'push', route: 'SettingsReleaseNotes' },
    origin: 'web',
  },
  {
    path: '/settings/release-notes/:guideId',
    screen: 'SettingsFeatureGuideScreen',
    target: { kind: 'push', route: 'SettingsReleaseNoteGuide' },
    origin: 'web',
  },
  {
    path: '/settings/account-data',
    screen: 'SettingsAccountDataScreen',
    target: { kind: 'push', route: 'SettingsAccountData' },
    origin: 'web',
  },
  { path: '/settings/about', screen: 'SettingsAboutScreen', target: { kind: 'push', route: 'SettingsAbout' }, origin: 'web' },
  {
    path: '/settings/about/privacy',
    screen: 'SettingsPrivacyScreen',
    target: { kind: 'push', route: 'SettingsPrivacy' },
    origin: 'web',
  },
  // ── 여기부터 RN 에서 새로 생긴 화면 ([[ADR-132]] 결정 1·12 · [[ADR-144]] 결정 1) ──
  // 웹에는 없다. `path` 는 대조용이 아니라 이름표다. 탭 넷은 아직 «개발 진행중» 자리표시자이고,
  // 마지막 하나(캐릭터 관리)는 진짜 화면이다 — 웹뷰 앱에서는 같은 일을 설정의 모달이 한다.
  { path: '/today', screen: 'TodayScreen', target: { kind: 'tab', route: 'Today' }, origin: 'rn' },
  {
    path: '/profit/hunting',
    screen: 'HuntingProfitScreen',
    target: { kind: 'tab', route: 'HuntingProfit' },
    origin: 'rn',
  },
  { path: '/spend', screen: 'SpendScreen', target: { kind: 'tab', route: 'Spend' }, origin: 'rn' },
  { path: '/utility', screen: 'UtilityScreen', target: { kind: 'tab', route: 'Utility' }, origin: 'rn' },
  {
    path: '/settings/characters',
    screen: 'SettingsCharactersScreen',
    target: { kind: 'push', route: 'SettingsCharacters' },
    origin: 'rn',
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

/**
 * 탭 내비게이터가 그리는 화면 이름 여덟 — 표에서 파생한다.
 *
 * **라벨은 여기 없다.** 라벨은 그룹과 함께 `bar-model.ts` 의 `BAR_GROUPS` 가 갖는다 — 바가 라벨을
 * 두 층(그룹 이름 · 하위 이름)으로 쓰기 때문에, 여기에도 두면 같은 문구가 두 벌이 된다.
 */
export const TAB_ROUTE_NAMES: readonly TabRouteName[] = ROUTE_TABLE.flatMap((row) =>
  row.target.kind === 'tab' ? [row.target.route] : [],
)

/**
 * 처음 서 있는 탭 — **`/` 행과 갈렸다**([[ADR-132]] 결정 7).
 *
 * 표의 `/` 행은 여전히 `Content` 를 가리킨다. 그 행은 *"웹이 `/` 에서 무엇을 보여 줬는가"* 라는
 * 기록이고, *"이 앱이 어디서 시작하는가"* 와는 다른 축이기 때문이다. 둘이 갈린 것 자체가
 * [[ADR-132]] 의 산물이라 `routes.test.ts` 가 **양쪽을 함께** 고정한다 — 한쪽만 고치면 테스트가 운다.
 */
export const INITIAL_TAB_ROUTE: TabRouteName = 'Today'
