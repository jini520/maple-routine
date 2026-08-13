import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { maybeShowTabSwitchAd } from '@core/features/ads/tab-switch-ad'

import { BossProfitScreen } from '../app/boss-profit/BossProfitScreen'
import { BossScreen } from '../app/boss-scheduler/BossScreen'
import { ContentScreen } from '../app/content-scheduler/ContentScreen'
import { SettingsScreen } from '../app/settings/SettingsScreen'
import { ProfitIcon } from '../components/atoms/ProfitIcon/ProfitIcon'
import { ListChecksIcon, SettingsIcon, SwordsIcon } from '../lib/icons'
import { useThemeAppearance } from '../theme/context'
import { INITIAL_TAB_ROUTE, TAB_ITEMS, type TabParamList, type TabRouteName } from './routes'

const Tab = createBottomTabNavigator<TabParamList>()

/**
 * 진짜 화면이 들어온 탭. **여기 없는 이름은 아직 자리표시자다** — `RootNavigator` 의 같은 이름 표와
 * 짝이고, 비어 있는 자리가 곧 남은 일이다(step 7 수익 · 설정은 step 3 이 하위 페이지만 옮겼고
 * 본화면은 그 뒤다).
 */
const TAB_SCREENS = {
  Content: ContentScreen,
  Boss: BossScreen,
  Profit: BossProfitScreen,
  Settings: SettingsScreen,
} as const satisfies Record<TabRouteName, React.ComponentType>

/**
 * 탭 아이콘 — 웹 `TAB_ITEMS` 의 `Icon` 과 같은 넷이다(`app-capacitor/src/App.tsx`).
 *
 * **수익만 커스텀이다** — lucide 규격(24×24 · `strokeWidth` 2)을 지켜 그린 것이라 나머지 셋과
 * 굵기·크기가 맞는다([[ADR-066]] 결정 3). 그 결정이 명시적으로 금지한 것이 *"도메인 아이덴티티를
 * 임의로 고른 lucide 그림으로 대체하는 것"* 이라, 여기서 비슷한 아이콘으로 갈음하지 않는다.
 */
const TAB_ICONS = {
  Content: ListChecksIcon,
  Boss: SwordsIcon,
  Profit: ProfitIcon,
  Settings: SettingsIcon,
} as const satisfies Record<TabRouteName, React.ComponentType<{ color?: string; size?: number }>>

/**
 * 자리표시자 폴백이 **없다** — `TAB_SCREENS` 가 `Partial` 이 아니라 `Record<TabRouteName, …>` 라
 * 넷을 다 적지 않으면 타입이 거부한다. 예전에는 `Partial` + 폴백이었고, 그래서 `Settings` 를
 * 빠뜨렸을 때 **타입도 테스트도 통과한 채 설정 탭만 자리표시자**로 떴다(2026-08-13 실기기 관측).
 * 폴백을 없앤 것이 그 사고의 처방이다 — 빠진 자리를 런타임이 아니라 컴파일러가 말한다.
 */
function screenFor(name: TabRouteName): React.ComponentType<Record<string, never>> {
  return TAB_SCREENS[name] as React.ComponentType<Record<string, never>>
}

/**
 * 탭 넷 + 탭바.
 *
 * ## 탭바가 하위 페이지에서 사라지는 것은 여기가 아니라 **루트 스택**이 만든다
 *
 * [[ADR-120]] 결정 4 는 탭 화면과 탭바를 한 래퍼로 묶어 **함께 밀려 나가고 함께 어두워지게** 했다
 * (iOS `hidesBottomBarWhenPushed`). RN 에서 그 래퍼에 해당하는 것이 이 내비게이터 전체이고,
 * 하위 페이지는 탭 **안**이 아니라 이것 **위**로 push 된다(`RootNavigator`). 그래서 탭바를 숨기는
 * 코드가 따로 없다 — 구조가 그렇게 되어 있다.
 *
 * 탭 안에 스택을 두고 `tabBarStyle: { display: 'none' }` 으로 숨기는 배치도 가능하지만, 그러면
 * 탭바가 **함께 밀려 나가지 않고 그 자리에서 사라진다** — 결정 4 가 말한 "한 덩어리"가 깨진다.
 *
 * ## `backBehavior="none"`
 *
 * 기본값(`firstRoute`)이면 `/boss` 에서 뒤로가기를 눌렀을 때 `/content` 탭으로 간다. 웹뷰 앱은
 * 그러지 않았다 — 뒤로가기 처리는 **스택 깊이 하나**만 봤고(`use-system-back.ts` 의 `depth > 0`),
 * 깊이가 0 이면 어느 탭이든 [[ADR-120]] 결정 18 대로 백그라운드로 나갔다. 탭 사이를 뒤로가기로
 * 오가는 동작은 이 앱에 없던 것이라 기본값을 끈다(그 처리는 `use-root-back.ts`).
 *
 * ## 키보드가 뜨면 탭바를 숨긴다 (4단계 step 0)
 *
 * 웹 `AppShell` 은 `isKeyboardVisible` 로 `<BottomTabBar />` 를 **언마운트**했다(네이티브가 웹뷰를
 * 밀어 올리면 탭바가 키보드 바로 위에 얹혀, 입력 중엔 의미도 없고 시야만 가린다). RN 에서 같은
 * 일을 하는 것이 `tabBarHideOnKeyboard` 이고, 라이브러리가 자기 `Keyboard` 구독으로 판정한다
 * (iOS 는 `keyboardWillShow`, 안드로이드는 `keyboardDidShow` — 실측: `useIsKeyboardShown.tsx`).
 * 우리 어댑터(`rn-keyboard.ts`)는 양쪽 다 `did` 라 **iOS 에서 한 프레임 어긋나지만**, 하나로
 * 합치려면 셸의 값을 내비게이터까지 프롭으로 꿰어야 해서 그 대가가 어긋남보다 크다. 셸 쪽 구독이
 * 남는 이유는 토스트 하나다(`app/use-keyboard-visible.ts`).
 */
export function TabNavigator(): React.JSX.Element {
  const { definition } = useThemeAppearance()

  return (
    <Tab.Navigator
      initialRouteName={INITIAL_TAB_ROUTE}
      backBehavior="none"
      // 헤더는 앱이 직접 그린다(`PageHeader`, templates) — [[ADR-085]] 결정 1 의 `fixed` 헤더 +
      // 실측 spacer 가 그 자리에 온다. 라이브러리 헤더를 켜 두면 두 겹이 된다.
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        // 웹 `BottomTabBar` 의 값 그대로 — 활성 `text-primary-ink` · 비활성 `text-text-muted` ·
        // 바탕 `bg-surface` + `border-t border-border` · 라벨 `text-xs font-medium`.
        // `className` 이 아니라 값인 것은 라이브러리가 칠하는 자리라서다(`navigation-theme.ts` 와 같은 부류).
        tabBarActiveTintColor: definition.primaryInk,
        tabBarInactiveTintColor: definition.textMuted,
        tabBarStyle: { backgroundColor: definition.surface, borderTopColor: definition.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      }}
    >
      {TAB_ITEMS.map((tab) => {
        const Icon = TAB_ICONS[tab.route]

        return (
        <Tab.Screen
          key={tab.route}
          name={tab.route}
          component={screenFor(tab.route)}
          options={{
            title: tab.label,
            // 웹은 `h-5 w-5`(20) · `strokeWidth={1.5}`. 색은 라이브러리가 활성/비활성에 맞춰 넘긴다.
            tabBarIcon: ({ color }) => <Icon color={color} size={20} strokeWidth={1.5} />,
          }}
          // **탭 이동의 책임은 링크가 아니라 인터셉터에 있다** — 전면광고 게이트가 여기 걸린다
          // ([[ADR-090]] 결정 3, `docs/migration/parity-inventory.md` §1 «보존해야 할 라우팅 동작»).
          //
          // 웹에서 이것이 캡처 단계의 DOM 리스너였던 이유(iOS WKWebView 가 합성한 클릭이 React 를
          // 타지 않아 `<a href>` 기본 동작으로 문서가 통째로 리로드됐다, [[ADR-050]])는 RN 에 없다 —
          // 앵커도 문서도 없다. 남는 것은 **게이트를 어디에 거는가** 뿐이고, 그 자리가 `tabPress` 다.
          listeners={({ navigation }) => ({
            tabPress: () => {
              // 같은 탭을 다시 누른 것은 전환이 아니다([[ADR-090]]) — 웹의
              // `window.location.pathname !== href` 와 같은 판정이다.
              if (navigation.isFocused()) return

              // **막지 않는다**(`preventDefault()` 없음) — 이동은 기본 동작이 그대로 하고, 광고는
              // 그 뒤에 준비된 것이 있을 때만 뜬다. `await` 하지 않는 것도 같은 이유다: 첫 `await`
              // 까지가 동기라 화면 전환 dispatch 가 먼저 일어난다("광고는 이동을 지연시키지
              // 않는다", [[ADR-090]] 결정 3).
              void maybeShowTabSwitchAd()
            },
          })}
        />
        )
      })}
    </Tab.Navigator>
  )
}
