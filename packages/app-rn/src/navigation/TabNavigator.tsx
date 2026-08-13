import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

import { BossProfitScreen } from '../app/boss-profit/BossProfitScreen'
import { BossScreen } from '../app/boss-scheduler/BossScreen'
import { ContentScreen } from '../app/content-scheduler/ContentScreen'
import { HuntingProfitScreen } from '../app/hunting-profit/HuntingProfitScreen'
import { SettingsScreen } from '../app/settings/SettingsScreen'
import { SpendScreen } from '../app/spend/SpendScreen'
import { TodayScreen } from '../app/today/TodayScreen'
import { UtilityScreen } from '../app/utility/UtilityScreen'
import { BottomBar } from './BottomBar'
import { INITIAL_TAB_ROUTE, TAB_ROUTE_NAMES, type TabParamList, type TabRouteName } from './routes'

const Tab = createBottomTabNavigator<TabParamList>()

/**
 * 화면 여덟. **`Partial` 이 아니라 `Record` 인 것이 계약이다** — 하나를 빠뜨리면 타입이 거부한다.
 * 예전에는 `Partial` + 자리표시자 폴백이었고, 그래서 `Settings` 를 빠뜨렸을 때 **타입도 테스트도
 * 통과한 채 설정 탭만 자리표시자**로 떴다(2026-08-13 실기기 관측). 그 사고의 처방이 이 형태다.
 *
 * 넷은 아직 «개발 진행중» 껍데기이지만 **화면은 실재한다**([[ADR-132]] 결정 12) — 자리표시자 폴백을
 * 되살리는 것과 다르다. 폴백은 «빠뜨렸다» 를 감추고, 이쪽은 «아직 안 만들었다» 를 말한다.
 */
const TAB_SCREENS = {
  Today: TodayScreen,
  Content: ContentScreen,
  Boss: BossScreen,
  Profit: BossProfitScreen,
  HuntingProfit: HuntingProfitScreen,
  Spend: SpendScreen,
  Utility: UtilityScreen,
  Settings: SettingsScreen,
} as const satisfies Record<TabRouteName, React.ComponentType>

function screenFor(name: TabRouteName): React.ComponentType<Record<string, never>> {
  return TAB_SCREENS[name] as React.ComponentType<Record<string, never>>
}

/**
 * 탭 여덟 + 떠 있는 바([[ADR-132]]).
 *
 * ## 바가 그룹을 알고, 내비게이터는 페이지만 안다
 *
 * 화면 목록에 «스케줄»·«가계부» 가 없는 것이 결정 1이다 — 그 묶음은 내비게이션 구조가 아니라
 * 바의 표현이라 `bar-model.ts` 의 표가 갖는다. 그래서 여기서는 아무것도 중첩하지 않는다.
 *
 * ## `tabBarStyle` 이 없다
 *
 * `BottomBar` 가 스스로 `position: absolute` 로 뜨므로 라이브러리가 자리를 잡아 줄 것이 없다.
 * 콘텐츠 쪽 여백은 `ScreenScroll` 이 준다(`bottom-inset.ts` — 떠 있는 바의 몫 72dp).
 *
 * ## 탭바가 하위 페이지에서 사라지는 것은 여기가 아니라 **루트 스택**이 만든다
 *
 * [[ADR-120]] 결정 4 는 탭 화면과 탭바를 한 래퍼로 묶어 **함께 밀려 나가게** 했다. RN 에서 그
 * 래퍼가 이 내비게이터 전체이고, 하위 페이지는 탭 **안**이 아니라 이것 **위**로 push 된다.
 *
 * ## `backBehavior="none"`
 *
 * 기본값(`firstRoute`)도, [[ADR-132]] 가 검토한 `"history"` 도 아니다. `"history"` 는 **모든 탭
 * 전환**을 쌓아서 «유틸리티 → 설정 → ← → 유틸리티» 를 만드는데, 그것이 결정 4가 배제한 동작이다.
 * 기록은 우리가 «한 층 내려갈 때만» 든다(`bar-store.ts`).
 *
 * ## 광고 게이트는 `tabPress` 가 아니라 바에 있다
 *
 * 이제 그룹 이동·하위 이동·뒤로가기가 전부 탭 전환이라, `tabPress` 에 걸면 셋이 다 게이트를 탄다
 * ([[ADR-132]] 결정 9). 바가 **무엇을 눌렀는지** 알고 있으므로 그쪽이 판정 자리다
 * (`bar-model.ts` 의 `shouldGateAd`).
 */
export function TabNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      initialRouteName={INITIAL_TAB_ROUTE}
      backBehavior="none"
      tabBar={(props) => <BottomBar {...props} />}
      // 헤더는 앱이 직접 그린다(`PageHeader`, templates) — 라이브러리 헤더를 켜 두면 두 겹이 된다.
      screenOptions={{ headerShown: false }}
    >
      {TAB_ROUTE_NAMES.map((name) => (
        <Tab.Screen key={name} name={name} component={screenFor(name)} />
      ))}
    </Tab.Navigator>
  )
}
