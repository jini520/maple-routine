import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StackActions } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useMemo } from 'react'
import { View } from 'react-native'

import { BossProfitScreen } from '../app/boss-profit/BossProfitScreen'
import { BossManageScreen } from '../app/boss-scheduler/BossManageScreen'
import { BossScreen } from '../app/boss-scheduler/BossScreen'
import { CashbookScreen } from '../app/cashbook/CashbookScreen'
import { ContentScreen } from '../app/content-scheduler/ContentScreen'
import { SettingsScreen } from '../app/settings/SettingsScreen'
import { TodayScreen } from '../app/today/TodayScreen'
import { UtilityScreen } from '../app/utility/UtilityScreen'
import { BottomBarOverlayHost } from './BottomBarOverlay'
import { TAB_LAYER_PROPS } from './tab-layer-props'
import { BottomBar, type BarNavigation } from './BottomBar'
import { pageFromLayerState } from './current-page'
import { PUSH_SCREEN_OPTIONS } from './stack-presentation'
import {
  INITIAL_TAB_ROUTE,
  type GroupLayerParamList,
  type LayerParamList,
  type LayerRouteName,
  type LedgerSubsParamList,
  type ScheduleSubsParamList,
  type TabRouteName,
} from './routes'

const Layer = createNativeStackNavigator<LayerParamList>()
const GroupTabs = createBottomTabNavigator<GroupLayerParamList>()
const ScheduleTabs = createBottomTabNavigator<ScheduleSubsParamList>()
const LedgerTabs = createBottomTabNavigator<LedgerSubsParamList>()

/**
 * 층 안의 화면들은 **탭이다**. 그래서 옆걸음에 전환이 없고 서로 언마운트하지 않는다
 * 바는 이 내비게이터들이 그리지 않는다(`tabBar` 가 아무것도 안 낸다);
 * 층 스택의 `layout` 이 한 벌만 그린다.
 *
 * `backBehavior="none"` 은 가 정한 그대로다. `"history"` 는 **모든 탭 전환**을 쌓아서
 * 결정 4 가 배제한 동작을 만든다. 층을 오르내리는 일은 이제 바깥 스택이 진다.
 */

function GroupLayer(): React.JSX.Element {
  return (
    <GroupTabs.Navigator initialRouteName={INITIAL_TAB_ROUTE} {...TAB_LAYER_PROPS}>
      <GroupTabs.Screen name="Today" component={TodayScreen} />
      <GroupTabs.Screen name="Utility" component={UtilityScreen} />
      <GroupTabs.Screen name="Settings" component={SettingsScreen} />
    </GroupTabs.Navigator>
  )
}

function ScheduleLayer(): React.JSX.Element {
  return (
    <ScheduleTabs.Navigator {...TAB_LAYER_PROPS}>
      <ScheduleTabs.Screen name="Content" component={ContentScreen} />
      <ScheduleTabs.Screen name="Boss" component={BossScreen} />
      {/* 헤더 버튼으로만 열리던 화면이 셋째 하위가 됐다. */}
      <ScheduleTabs.Screen name="BossManage" component={BossManageScreen} />
    </ScheduleTabs.Navigator>
  )
}

function LedgerLayer(): React.JSX.Element {
  return (
    <LedgerTabs.Navigator {...TAB_LAYER_PROPS}>
      <LedgerTabs.Screen name="Profit" component={BossProfitScreen} />
      {/* 껍데기 둘(사냥 수익·지출)이 있던 자리. 가계부 하나로 합쳐졌다. */}
      <LedgerTabs.Screen name="Cashbook" component={CashbookScreen} />
    </LedgerTabs.Navigator>
  )
}

const LAYER_SCREENS = {
  Groups: GroupLayer,
  ScheduleSubs: ScheduleLayer,
  LedgerSubs: LedgerLayer,
} as const satisfies Record<LayerRouteName, React.ComponentType>

/**
 * 탭 레이어를 대신하는 화면 하나. **층 스택 + 그 위에 뜬 바**.
 *
 * ## 층이 스택이면 제스처와 전환이 공짜다
 *
 * 그룹 행 → 하위 행이 **진짜 push** 라 `animation`·`gestureEnabled` 가 하위 페이지 열하나와 같은
 * 값을 같은 경로로 받는다. 예전에는 이 이동이 형제 탭 전환이라 되돌아갈
 * 단이 없었고, 그래서 바가 `history` 를 손으로 들고 iOS 가장자리 스와이프는 **가로챌 자리가 아예
 * 없었다**(#240).
 *
 * ## 바는 왜 `layout` 안에 있나
 *
 * `layout` 은 내비게이터의 **내용 전체**를 감싼다. 화면 하나가 아니다. 그래서 여기 둔 바는
 * 층이 밀려도 **안 움직이고**, 층 스택의 `state`·`navigation` 을 그대로 받는다(키를 겨냥하거나
 * 바깥에서 상태를 훑을 일이 없다).
 *
 * 그리고 하위 페이지 열하나는 이 `Main` **통째**를 밀어내므로 바가 함께 나간다.
 * (*"탭바가 아래 화면과 한 덩어리로 밀려 나간다"*)가 구조로 성립한다. 바를 앱
 * 층으로 끌어올렸다면 하위 페이지에서는 언제 숨기나 라는 판정이 새로 생기고 그 결정이 깨진다.
 */
export function Main(): React.JSX.Element {
  return (
    <Layer.Navigator
      // **벽지는 여기가 아니라 탭 쪽이다**. 이 스택의 화면은 셋 다 탭 내비게이터이고,
      // 그 탭들이 자기 화면을 불투명하게 칠하므로 여기 깐 벽지는 어차피 덮인다. 벽지를 두 겹
      // 마운트하지 않도록 `TAB_LAYER_PROPS` 한 곳에만 둔다.
      layout={({ children, state, navigation }) => (
        <View className="flex-1">
          {children}
          <ConnectedBottomBar state={state} navigation={navigation} />
          {/* 바 **뒤**가 곧 바 **위**다. 화면이 소유한 오버레이가 여기 뜬다.
              같은 상자라 하위 페이지가 `Main` 을 밀어낼 때 바와 함께 나간다. */}
          <BottomBarOverlayHost />
        </View>
      )}
      // 루트 스택과 **같은 상수**다. 그래서 **다른 하위 페이지처럼 열린다** 가 우연이 아니다.
      screenOptions={PUSH_SCREEN_OPTIONS}
    >
      {(Object.keys(LAYER_SCREENS) as LayerRouteName[]).map((name) => (
        <Layer.Screen key={name} name={name} component={LAYER_SCREENS[name]} />
      ))}
    </Layer.Navigator>
  )
}

interface ConnectedBottomBarProps {
  state: { index?: number; routes: readonly { name: string }[] }
  navigation: {
    navigate: (...args: never[]) => void
    dispatch: (action: ReturnType<typeof StackActions.popTo>) => void
    goBack: () => void
  }
}

/**
 * 층 스택의 `state`·`navigation` 을 바가 아는 두 가지로 옮긴다.
 *
 * 바는 **내비게이션을 두 메서드로만** 안다(`BarNavigation`). 층 화면 이름과 중첩 파라미터 모양은
 * 여기서 끝나므로, 구조를 바꿀 때 바가 함께 움직이지 않는다.
 */
function ConnectedBottomBar({ state, navigation }: ConnectedBottomBarProps): React.JSX.Element | null {
  const page = pageFromLayerState(state)

  const layerNames = state.routes.map((route) => route.name)
  const topLayer = layerNames[state.index ?? layerNames.length - 1]
  /** 의존성으로 쓸 수 있게 배열을 한 문자열로 접는다. 층 이름은 짧고 개수도 셋뿐이다. */
  const layerKey = layerNames.join('|')

  const barNavigation: BarNavigation = useMemo(
    () => ({
      openLayer: (layer: LayerRouteName, target: TabRouteName) => {
        // **같은 층이 스택에 두 번 서지 않는다**. 이미 아래에 있으면 그리로
        // 되돌아간다. react-navigation 7 부터 `navigate` 는 되돌아가지 않고 한 단 더 쌓으므로
        // (그 몫이 `popTo` 로 갈라졌다) 우리가 갈래를 정해 줘야 한다.
        //
        // 되돌아간 **뒤에** 안쪽 탭을 지정한다. `popTo` 의 파라미터는 그 라우트에 얹힐 뿐이고,
        // 이미 마운트된 중첩 내비게이터의 탭을 바꾸지는 않는다.
        if (layer !== topLayer && layerKey.split('|').includes(layer)) {
          navigation.dispatch(StackActions.popTo(layer))
        }
        // 층 이름이 유니온이라 `navigate` 의 파라미터가 하나로 안 좁혀진다. 좁히려면 갈래마다 손으로
        // 적어야 하고 그러면 층 표가 두 벌이 된다. `RootNavigator.screenFor` 와 같은 대가다.
        ;(navigation.navigate as (name: string, params: { screen: string }) => void)(layer, {
          screen: target,
        })
      },
      goBack: () => navigation.goBack(),
    }),
    [navigation, topLayer, layerKey],
  )

  return <BottomBar page={page} navigation={barNavigation} />
}
