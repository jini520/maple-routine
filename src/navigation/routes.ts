/**
 * 라우트 표. 화면 목록을 데이터로 두는 자리.
 *
 * 내비게이터를 손으로 적으면 화면 목록이 두 벌이 되고 하나를 빠뜨려도 아무 데서도 안 드러난다.
 * `RootNavigator` 가 이 표에서 파생된 이름 목록으로 화면을 그리고, 테스트가 표의 행 수와 그
 * 이름들이 실제로 열리는지를 함께 본다.
 *
 * `path` 는 RN 에서 안 쓰인다. 대조용으로 남긴다.
 *
 * ⚠️ **딥링크(`linking`)를 두지 말 것.** 설정을 두면 이 표가 문서에서 **동작**으로 바뀌어 없던
 * 진입 경로가 생긴다.
 */

import type { NavigatorScreenParams } from '@react-navigation/native'

/**
 * 탭 내비게이터의 화면 아홉. **그룹이 아니라 페이지다**.
 *
 * 아홉째가 `BossManage` 다. 하단바가 이미 스케줄 안의 자리들을 그리는데 그 목록에만 없었다.
 *
 * 바에 보이는 그룹(스케줄·가계부…)은 내비게이션 구조가 아니라 **바의 표현**이라 여기 없다.
 * 그 묶음은 `bar-model.ts` 의 표가 갖는다. 중첩 내비게이터를 두지 않은 이유도 같다. 하위 페이지들은
 * 서로 형제이고 전환에 스택도 애니메이션도 없다.
 *
 * 순서는 그룹 순서 → 그룹 안 순서 다. 바가 이 순서로 그리는 것은 아니지만(그건 `BAR_GROUPS`),
 * 표 둘이 같은 순서를 갖고 있으면 나중에 대조하기 쉽다.
 */
export type TabRouteName =
  | 'Today'
  | 'Content'
  | 'Boss'
  | 'BossManage'
  | 'Profit'
  | 'Cashbook'
  | 'Utility'
  | 'Settings'

export type TabParamList = {
  Today: undefined
  Content: undefined
  Boss: undefined
  BossManage: undefined
  Profit: undefined
  Cashbook: undefined
  Utility: undefined
  /**
   * `openPicker` 는 캐릭터 관리 피커를 **열어 둔 채로** 이 탭에 보내는 파라미터다. 보내는 쪽 셋: 보스 수익의 "캐릭터 선택하러 가기"와 컨텐츠·보스
   * 스케줄러의 빈 상태 CTA.
   *
   * **받는 쪽이 `Boss` 에서 여기로 옮겨왔다**. 피커를 여는 자리가 설정
   * 하나가 되면서 목적지도 함께 옮겼다. 열어 두고 보낸다는 계약 자체는 그대로다.
   *
   * **파라미터가 스택에 남는다.** 탭을 떠났다 돌아오면 그대로 살아 있으므로 화면이 `setParams` 로 지우는 일은
   * 그대로 필요하다(`SettingsScreen`).
   */
  Settings: { openPicker?: boolean } | undefined
}

/**
 * 층 스택의 화면. **그룹 층 하나 + 하위를 가진 그룹마다 하나**.
 *
 * 이 이름들이 곧 층 이다. 그룹 행에 서 있으면 `Groups` 한 단이고, 하위로 내려가면 그 그룹의
 * 화면이 그 위에 **push** 된다. 그래서 전환 애니메이션과 가장자리 스와이프가 공짜로 붙는다
 * (6 이 하위 페이지 열하나에 준 것과 같은 값이 같은 경로로 온다).
 *
 * 어느 그룹이 어느 층 화면을 갖는지는 `bar-model.ts` 의 `BAR_GROUPS` 가 든다. 여기 두면 두 벌이
 * 된다. 이름만 여기 있는 것은 `bar-model` 이 `routes` 를 읽지 그 반대가 아니기 때문이다.
 */
export type LayerRouteName = 'Groups' | 'ScheduleSubs' | 'LedgerSubs'

/** 그룹 층에 서는 화면. **하위가 없는 그룹의 페이지**들이다. */
export type GroupLayerParamList = {
  Today: undefined
  Utility: undefined
  Settings: { openPicker?: boolean } | undefined
}

export type ScheduleSubsParamList = {
  Content: undefined
  Boss: undefined
  BossManage: undefined
}

export type LedgerSubsParamList = {
  Profit: undefined
  Cashbook: undefined
}

export type LayerParamList = {
  Groups: NavigatorScreenParams<GroupLayerParamList> | undefined
  ScheduleSubs: NavigatorScreenParams<ScheduleSubsParamList> | undefined
  LedgerSubs: NavigatorScreenParams<LedgerSubsParamList> | undefined
}

/** 층 화면 셋. `Main` 이 이 목록으로 `<Stack.Screen>` 을 그린다. */
export const LAYER_ROUTE_NAMES: readonly LayerRouteName[] = ['Groups', 'ScheduleSubs', 'LedgerSubs']

/**
 * 기능 안내 상세가 받는 파라미터.
 *
 * `section` 은 파라미터 하나다. push 는 우리가 명시하므로 세그먼트로 둘 이유가 없다.
 */
export interface FeatureGuideParams {
  guideId: string
  section?: string
}

export type RootStackParamList = {
  Onboarding: undefined
  /**
   * 탭 레이어를 대신하는 화면 하나. **안에 층 스택과 바가 형제로 산다**.
   *
   * 이름이 `Tabs` 가 아닌 이유: 이제 이 자리는 탭 내비게이터가 아니라 **스택**이고, 탭은 그 스택의
   * 각 단 안에 있다. 하위 페이지 열하나는 여전히 이것 **위**로 밀려 들어와 `Main` 통째를 밀어낸다.
   * 바가 그 안에 있으므로(*"탭바가 아래 화면과 한 덩어리로 밀려 나간다"*)가
   * 구조로 그대로 성립한다.
   */
  Main: NavigatorScreenParams<LayerParamList> | undefined
  ContentManage: undefined
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
 * 아이템 분배 계산기. **유틸리티의 첫 도구다**.
   *
   * 이 자리가 유틸리티의 구조를 정한다: 도구는 유틸리티 화면 **안의 카드**가 아니라 루트 스택에
   * 쌓이는 하위 페이지이고, 뒤에 오는 도구들이 그대로 물려받는다.
   */
  UtilityItemSplit: undefined
  /**
 * 캐릭터 관리.
   * 두 층 + 드롭다운 + 순서 + 대표가 385px 모달 본문에 안 들어가 하위 페이지가 됐다.
   */
  SettingsCharacters: undefined
}

export type StackRouteName = Exclude<keyof RootStackParamList, 'Onboarding' | 'Main'>

/**
 * 한 경로가 RN 의 어느 자리로 갔는가.
 *
 * - `initial`. 처음 서 있는 탭.
 * - `root`. 루트 스택의 화면이되 탭이 아닌 것(온보딩). 탭과 **배타**로 그려진다(아래).
 * - `tab`. 탭 여덟(사냥 수익·지출을 걷고 가계부를 넣어 아홉에서 줄었다).
 * - `push`. 탭 위로 밀려 들어오는 하위 페이지. 루트 스택에 쌓인다.
 */
export type RouteTarget =
  | { readonly kind: 'initial'; readonly route: TabRouteName }
  | { readonly kind: 'root'; readonly route: 'Onboarding' }
  | { readonly kind: 'tab'; readonly route: TabRouteName }
  | { readonly kind: 'push'; readonly route: StackRouteName }

export interface RouteRow {
/** 대조용 경로 이름표. `origin: 'rn'` 이면 옛 앱에 없던 화면이다(아래). */
  readonly path: string
  /** 그 경로가 그리던 화면. parity-inventory §1 의 둘째 열. **두 행이 같은 값을 가질 수 있다.** */
  readonly screen: string
  readonly target: RouteTarget
  /**
   * 이 행이 **어디서 왔는가**.
   *
   * - `web`. 웹 앱에 실제로 있는 경로. 계획서 §1 과 대조되는 행이고 **17개로 고정**이다.
 * - `rn`. 이 앱에서 새로 생긴 화면. `path` 는 그 화면이 같은 규칙이었다면 가졌을
   *   경로이고 **대조가 아니라 이름표**다. 이 값으로 계획서를 검사하지 말 것(테스트가 갈라 본다).
   */
  readonly origin: 'web' | 'rn'
}

/**
 * 웹 17행 + RN 5행. **행 수와 내용을 테스트가 고정한다**. 화면이 늘면 계획서와 여기가 함께 움직여야 한다.
 *
 * `/settings/about/privacy` 가 계획서 표(`/settings/privacy`)와 다른 것은 **계획서 쪽이 낡았기
 * 때문**이다. 이 구현 중에 경로를 `about` 의 **자식**으로 정정했고
 * (`/settings/privacy` 로 두면 about 이 즉시 사라진 자리에 처방침이 밀려 들어와 밀려 나가는 화면
 * 없이 배경만 바뀌는 프레임이 보인다). 이 앱에서
 * 스택이 2단이 되는 자리는 여기뿐이다. 계획서 표도 함께 고쳤다.
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
  // **`origin: 'web'` 인데 `push` 가 아닌 행은 이것뿐이다.** 스케줄 그룹의 셋째 하위 탭이다.
  { path: '/boss/manage', screen: 'BossManageScreen', target: { kind: 'tab', route: 'BossManage' }, origin: 'web' },

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
  // 아래 둘이 **같은 `screen` 값을 갖는 것이 계약이다**. 기능 설명 목록에서도,
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
  // ── 여기부터 RN 에서 새로 생긴 화면 ──
  // `path` 는 대조용이 아니라 이름표다. 탭 셋은 전부 진짜 화면이 됐다. today 는
  // 위젯 격자·유틸리티는 도구 목록·가계부는 캘린더다.
  // 하위 페이지 둘도 진짜 화면이다. 캐릭터 관리는 웹뷰 앱에서 설정의 모달이 하던 일이고,
  // 아이템 분배 계산기는 새로 생긴 도구다.
  { path: '/today', screen: 'TodayScreen', target: { kind: 'tab', route: 'Today' }, origin: 'rn' },
  // 사냥 수익(`/profit/hunting`)·지출(`/spend`) 두 행이 **여기 있었다.** 둘은 자리를 예약하던
  // **개발 진행중** 자리표시자였고, 그 자리가 가계부로 정해지면서 삭제됐다
  // 되살릴 근거는 그 ADR 과 git 이 들고 있다.
  { path: '/cashbook', screen: 'CashbookScreen', target: { kind: 'tab', route: 'Cashbook' }, origin: 'rn' },
  { path: '/utility', screen: 'UtilityScreen', target: { kind: 'tab', route: 'Utility' }, origin: 'rn' },
  {
    path: '/utility/item-split',
    screen: 'ItemSplitScreen',
    target: { kind: 'push', route: 'UtilityItemSplit' },
    origin: 'rn',
  },
  {
    path: '/settings/characters',
    screen: 'SettingsCharactersScreen',
    target: { kind: 'push', route: 'SettingsCharacters' },
    origin: 'rn',
  },
]

/** 하위 페이지 이름. `RootNavigator` 가 이 목록으로 `<Stack.Screen>` 을 그린다. */
export const STACK_ROUTE_NAMES: readonly StackRouteName[] = ROUTE_TABLE.flatMap((row) =>
  row.target.kind === 'push' ? [row.target.route] : [],
)

/** 기능 안내 상세를 가리키는 두 라우트. 같은 컴포넌트가 그린다. */
export const FEATURE_GUIDE_ROUTE_NAMES = [
  'SettingsFeatureGuide',
  'SettingsReleaseNoteGuide',
] as const satisfies readonly StackRouteName[]

/**
 * 탭 내비게이터가 그리는 화면 이름 아홉. 표에서 파생한다.
 *
 * **라벨은 여기 없다.** 라벨은 그룹과 함께 `bar-model.ts` 의 `BAR_GROUPS` 가 갖는다. 바가 라벨을
 * 두 층(그룹 이름 · 하위 이름)으로 쓰기 때문에, 여기에도 두면 같은 문구가 두 벌이 된다.
 */
export const TAB_ROUTE_NAMES: readonly TabRouteName[] = ROUTE_TABLE.flatMap((row) =>
  row.target.kind === 'tab' ? [row.target.route] : [],
)

/**
 * 처음 서 있는 탭. **`/` 행과 갈렸다**.
 *
 * 타입이 `TabRouteName` 이 아니라 **`keyof GroupLayerParamList`** 인 것이 의 산물이다.
 * 앱은 탭 여덟 중 하나 가 아니라 **그룹 층의 첫 화면**에서 시작한다. 하위 층은 push 로만 열리므로
 * 여기에 하위 페이지를 적을 수 있으면 앱을 켰는데 스택이 한 단 깊은 상태가 표현돼 버린다.
 *
 * 표의 `/` 행은 여전히 `Content` 를 가리킨다. 그것과 **이 앱이 어디서 시작하는가** 는 다른 축이라
 * `routes.test.ts` 가 양쪽을 함께 고정한다. 한쪽만 고치면 테스트가 운다.
 */
export const INITIAL_TAB_ROUTE: keyof GroupLayerParamList = 'Today'
